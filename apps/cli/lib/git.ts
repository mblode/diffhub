import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeferred } from "./deferred";
import { resolveRepoFilePath } from "./git-paths";
import { getConfiguredRepoPath, REPO_POINTER } from "./repo-path";

// TTL cache — avoids spawning git subprocesses on every poll
interface GitRuntimeState {
  cache: Map<string, { value: unknown; expires: number }>;
  gitCommandQueue: Promise<void>;
  lastPointerMtime: number;
  serverBootId: string;
}

const getGitRuntimeState = (): GitRuntimeState => {
  const globalScope = globalThis as typeof globalThis & {
    __diffhubGitRuntimeState?: GitRuntimeState;
  };

  if (!globalScope.__diffhubGitRuntimeState) {
    const bootSeed = process.env.DIFFHUB_SERVER_BOOT_ID;
    globalScope.__diffhubGitRuntimeState = {
      cache: new Map<string, { value: unknown; expires: number }>(),
      gitCommandQueue: Promise.resolve(),
      lastPointerMtime: 0,
      serverBootId:
        bootSeed ??
        createHash("sha1").update(`${process.pid}:${Date.now()}:${Math.random()}`).digest("hex"),
    };
  }

  return globalScope.__diffhubGitRuntimeState;
};

const gitRuntimeState = getGitRuntimeState();
const { cache } = gitRuntimeState;
const MAX_GIT_OUTPUT_BYTES = 20 * 1024 * 1024;
const PREFERRED_BASE_BRANCHES = ["main", "master", "develop", "dev"] as const;
const SNAPSHOT_TTL_MS = 500;
const isDebugLogging = process.env.DIFFHUB_DEBUG === "1";

const isCmuxRuntime = (): boolean => process.env.DIFFHUB_CMUX === "1";
const usesExternalSnapshotWriter = (): boolean =>
  process.env.DIFFHUB_EXTERNAL_SNAPSHOT_WRITER === "1";

const getSnapshotCachePrefix = (repoPath: string): string =>
  `diffhub-snapshot-${createHash("sha1").update(repoPath).digest("hex")}-`;

const getSnapshotCachePath = (
  repoPath: string,
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
): string => {
  const cacheKey = JSON.stringify({
    base: base ?? "",
    mode: mode ?? "",
    whitespace: whitespace ?? "",
  });
  const suffix = createHash("sha1").update(cacheKey).digest("hex");
  return join(tmpdir(), `${getSnapshotCachePrefix(repoPath)}${suffix}.json`);
};

export const clearGitMemoryCache = (repoPath?: string): void => {
  if (!repoPath) {
    cache.clear();
    return;
  }

  const repoSegment = `:${repoPath}`;
  for (const key of cache.keys()) {
    if (key.includes(repoSegment)) {
      cache.delete(key);
    }
  }
};

export const invalidateGitCache = (repoPath?: string): void => {
  clearGitMemoryCache(repoPath);

  if (!isCmuxRuntime() || usesExternalSnapshotWriter()) {
    return;
  }

  if (!repoPath) {
    for (const entry of readdirSync(tmpdir())) {
      if (entry.startsWith("diffhub-snapshot-")) {
        rmSync(join(tmpdir(), entry), { force: true });
      }
    }
    return;
  }

  const prefix = getSnapshotCachePrefix(repoPath);
  for (const entry of readdirSync(tmpdir())) {
    if (entry.startsWith(prefix)) {
      rmSync(join(tmpdir(), entry), { force: true });
    }
  }
};

const bustCacheIfRepoChanged = (): void => {
  try {
    const mtime = statSync(REPO_POINTER).mtimeMs;
    if (mtime !== gitRuntimeState.lastPointerMtime) {
      gitRuntimeState.lastPointerMtime = mtime;
      if (usesExternalSnapshotWriter()) {
        clearGitMemoryCache();
      } else {
        invalidateGitCache();
      }
    }
  } catch {
    // empty
  }
};

const cached = async <T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> => {
  bustCacheIfRepoChanged();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  cache.set(key, { expires: Date.now() + ttlMs, value });
  return value;
};

const getRepoPath = (): string => getConfiguredRepoPath();

const runGitUnqueued = async (args: string[]): Promise<string> => {
  const startedAt = Date.now();
  if (isDebugLogging) {
    console.info("[diffhub] git command start", { args });
  }

  try {
    const { promise, reject, resolve } = createDeferred<string>();
    {
      const child = spawn("git", args, {
        cwd: getRepoPath(),
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let outputBytes = 0;
      let settled = false;

      const finish = (handler: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        handler();
      };

      const appendChunk = (chunks: Buffer[], chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        outputBytes += buffer.length;
        if (outputBytes > MAX_GIT_OUTPUT_BYTES) {
          child.kill("SIGKILL");
          finish(() => {
            reject(
              new Error(
                `git ${args.join(" ")} failed: output exceeded ${MAX_GIT_OUTPUT_BYTES} bytes`,
              ),
            );
          });
          return;
        }
        chunks.push(buffer);
      };

      child.stdout.on("data", (chunk) => {
        appendChunk(stdoutChunks, chunk);
      });
      child.stderr.on("data", (chunk) => {
        appendChunk(stderrChunks, chunk);
      });
      child.on("error", (error) => {
        finish(() => reject(error));
      });
      child.on("close", (code) => {
        const stdoutText = Buffer.concat(stdoutChunks).toString("utf-8");
        const stderrText = Buffer.concat(stderrChunks).toString("utf-8").trim();
        if (code === 0) {
          finish(() => resolve(stdoutText));
          return;
        }

        finish(() => {
          reject(
            Object.assign(
              new Error(
                stderrText || `git ${args.join(" ")} failed with exit code ${code ?? "unknown"}`,
              ),
              {
                code,
                status: code ?? undefined,
                stderr: stderrText,
              },
            ),
          );
        });
      });
    }
    const stdout = await promise;

    if (isDebugLogging) {
      console.info("[diffhub] git command success", {
        args,
        durationMs: Date.now() - startedAt,
      });
    }

    return stdout;
  } catch (error) {
    const execError = error as {
      code?: number | string;
      message: string;
      status?: number;
      stderr?: Buffer | string;
    };
    const stderr =
      typeof execError.stderr === "string"
        ? execError.stderr.trim()
        : execError.stderr?.toString("utf-8").trim() || "";
    console.error("[diffhub] git command failed", {
      args,
      code: execError.code,
      durationMs: Date.now() - startedAt,
      error,
      status: execError.status,
      stderr: stderr || null,
    });

    if (error instanceof Error && !stderr) {
      throw error;
    }

    throw new Error(stderr || `git ${args.join(" ")} failed: ${execError.message}`, {
      cause: error,
    });
  }
};

const runGit = async (args: string[]): Promise<string> => {
  let releaseQueue!: VoidFunction;
  // oxlint-disable-next-line promise/avoid-new
  const gate = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  const previous = gitRuntimeState.gitCommandQueue;
  gitRuntimeState.gitCommandQueue = gate;
  await previous;

  try {
    return await runGitUnqueued(args);
  } finally {
    releaseQueue();
  }
};

const splitGitLines = (output: string): string[] =>
  output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const parseDiffStats = (
  raw: string,
): { files: DiffFileStat[]; insertions: number; deletions: number } => {
  const files: DiffFileStat[] = [];
  let insertions = 0;
  let deletions = 0;
  let cursor = 0;

  while (cursor < raw.length) {
    const insertionsEnd = raw.indexOf("\t", cursor);
    if (insertionsEnd === -1) {
      break;
    }

    const deletionsEnd = raw.indexOf("\t", insertionsEnd + 1);
    if (deletionsEnd === -1) {
      throw new Error("Malformed git diff --numstat output");
    }

    const rawInsertions = raw.slice(cursor, insertionsEnd);
    const rawDeletions = raw.slice(insertionsEnd + 1, deletionsEnd);
    cursor = deletionsEnd + 1;

    let file = "";
    if (raw[cursor] === "\0") {
      cursor += 1;

      const oldPathEnd = raw.indexOf("\0", cursor);
      if (oldPathEnd === -1) {
        throw new Error("Malformed git diff --numstat rename output");
      }

      cursor = oldPathEnd + 1;
      const newPathEnd = raw.indexOf("\0", cursor);
      if (newPathEnd === -1) {
        throw new Error("Malformed git diff --numstat rename output");
      }

      file = raw.slice(cursor, newPathEnd);
      cursor = newPathEnd + 1;
    } else {
      const fileEnd = raw.indexOf("\0", cursor);
      if (fileEnd === -1) {
        throw new Error("Malformed git diff --numstat output");
      }

      file = raw.slice(cursor, fileEnd);
      cursor = fileEnd + 1;
    }

    const binary = rawInsertions === "-" || rawDeletions === "-";
    const fileInsertions = binary ? 0 : Number.parseInt(rawInsertions, 10) || 0;
    const fileDeletions = binary ? 0 : Number.parseInt(rawDeletions, 10) || 0;

    files.push({
      binary,
      changes: fileInsertions + fileDeletions,
      deletions: fileDeletions,
      file,
      insertions: fileInsertions,
    });

    insertions += fileInsertions;
    deletions += fileDeletions;
  }

  return { deletions, files, insertions };
};

const splitPatchByFile = (patch: string): Map<string, string> => {
  const patches = new Map<string, string>();
  const headerPattern = /^diff --git a\/(.+?) b\/(.+)$/gm;
  const entries: { file: string; start: number }[] = [];

  let match = headerPattern.exec(patch);
  while (match) {
    entries.push({ file: match[2], start: match.index });
    match = headerPattern.exec(patch);
  }

  for (const [index, entry] of entries.entries()) {
    const nextStart = entries[index + 1]?.start ?? patch.length;
    const filePatch = patch.slice(entry.start, nextStart).trimEnd();
    patches.set(entry.file, filePatch ? `${filePatch}\n` : "");
  }

  return patches;
};

const getBaseBranch = (): Promise<string> => {
  const repoPath = getRepoPath();
  return cached(`baseBranch:${repoPath}`, 30_000, async () => {
    const remoteBranches = splitGitLines(
      await runGit(["branch", "-r", "--format=%(refname:short)"]),
    );
    for (const name of PREFERRED_BASE_BRANCHES) {
      if (remoteBranches.includes(`origin/${name}`)) {
        return `origin/${name}`;
      }
    }

    const localBranches = splitGitLines(await runGit(["branch", "--format=%(refname:short)"]));
    for (const name of PREFERRED_BASE_BRANCHES) {
      if (localBranches.includes(name)) {
        return name;
      }
    }

    return "origin/main";
  });
};

const getMergeBase = (baseBranch: string): Promise<string> => {
  const repoPath = getRepoPath();
  return cached(`mergeBase:${repoPath}:${baseBranch}`, 30_000, async () => {
    const mb = await runGit(["merge-base", "HEAD", baseBranch]);
    return mb.trim();
  });
};

interface DiffResult {
  patch: string;
  baseBranch: string;
  fingerprint: string;
  mergeBase: string;
  branch: string;
  generation: string;
  reviewKey: string;
}

type WhitespaceMode = "ignore";

const addWhitespaceArgs = (args: string[], whitespace?: WhitespaceMode): string[] =>
  whitespace === "ignore" ? ["-w", ...args] : args;

interface SnapshotMetadata {
  bootId: string;
  createdAt: number;
  repoPath: string;
}

interface DiffSnapshot extends DiffStatsResult {
  fullPatch: string;
  mergeBase: string;
  metadata: SnapshotMetadata;
  patchByFile: Map<string, string>;
}

interface SerializedDiffSnapshot extends DiffStatsResult {
  fullPatch: string;
  mergeBase: string;
  metadata: SnapshotMetadata;
  patchByFile: Record<string, string>;
}

const createSnapshotGeneration = (bootId: string, fingerprint: string, mergeBase: string): string =>
  createHash("sha1").update(`${bootId}:${fingerprint}:${mergeBase}`).digest("hex");

const createReviewKey = (patch: string): string => createHash("sha1").update(patch).digest("hex");

const readSnapshotFromDisk = (
  repoPath: string,
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): DiffSnapshot | null => {
  if (!isCmuxRuntime()) {
    return null;
  }

  const snapshotPath = getSnapshotCachePath(repoPath, base, mode, whitespace);
  try {
    const raw = readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw) as SerializedDiffSnapshot;
    const ageMs = Date.now() - snapshot.metadata.createdAt;
    if (
      (expectedGeneration !== undefined && snapshot.generation !== expectedGeneration) ||
      snapshot.metadata.bootId !== gitRuntimeState.serverBootId ||
      snapshot.metadata.repoPath !== repoPath
    ) {
      if (isDebugLogging) {
        console.info("[diffhub] snapshot cache stale", {
          ageMs,
          expectedBootId: gitRuntimeState.serverBootId,
          expectedGeneration: expectedGeneration ?? null,
          repoPath,
          snapshotBootId: snapshot.metadata.bootId,
          snapshotGeneration: snapshot.generation,
          snapshotRepoPath: snapshot.metadata.repoPath,
          source: "disk",
        });
      }
      rmSync(snapshotPath, { force: true });
      return null;
    }

    if (isDebugLogging) {
      console.info("[diffhub] snapshot cache hit", {
        ageMs: Date.now() - snapshot.metadata.createdAt,
        generation: snapshot.generation,
        repoPath,
        source: "disk",
      });
    }
    return {
      ...snapshot,
      patchByFile: new Map(Object.entries(snapshot.patchByFile)),
    };
  } catch {
    return null;
  }
};

const waitForSnapshotFromDisk = async (
  repoPath: string,
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<DiffSnapshot | null> => {
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline) {
    const snapshot = readSnapshotFromDisk(repoPath, base, mode, whitespace, expectedGeneration);
    if (snapshot) {
      return snapshot;
    }

    // oxlint-disable-next-line promise/avoid-new
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  return null;
};

const writeSnapshotToDisk = (
  repoPath: string,
  base: string | undefined,
  mode: "uncommitted" | undefined,
  whitespace: WhitespaceMode | undefined,
  snapshot: DiffSnapshot,
): void => {
  if (!isCmuxRuntime()) {
    return;
  }

  const serialized: SerializedDiffSnapshot = {
    ...snapshot,
    patchByFile: Object.fromEntries(snapshot.patchByFile),
  };
  writeFileSync(
    getSnapshotCachePath(repoPath, base, mode, whitespace),
    JSON.stringify(serialized),
    "utf-8",
  );
  if (isDebugLogging) {
    console.info("[diffhub] snapshot cache wrote", {
      generation: snapshot.generation,
      repoPath,
      source: "disk",
    });
  }
};

const getDiffSnapshot = (
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<DiffSnapshot> => {
  const repoPath = getRepoPath();
  return cached(
    `snapshot:${repoPath}:${base ?? ""}:${mode ?? ""}:${whitespace ?? ""}:${expectedGeneration ?? ""}`,
    SNAPSHOT_TTL_MS,
    async () => {
      const diskSnapshot = readSnapshotFromDisk(
        repoPath,
        base,
        mode,
        whitespace,
        expectedGeneration,
      );
      if (diskSnapshot) {
        return diskSnapshot;
      }

      if (usesExternalSnapshotWriter()) {
        const awaitedSnapshot = await waitForSnapshotFromDisk(
          repoPath,
          base,
          mode,
          whitespace,
          expectedGeneration,
        );
        if (awaitedSnapshot) {
          return awaitedSnapshot;
        }
        console.warn("[diffhub] external snapshot unavailable, recomputing inline", {
          expectedGeneration: expectedGeneration ?? null,
          mode: mode ?? "all",
          repoPath,
          whitespace: whitespace ?? "default",
        });
      }

      const branchRaw = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = branchRaw.trim();
      const baseBranch =
        mode === "uncommitted"
          ? "HEAD"
          : (base ?? process.env.DIFFHUB_BASE ?? (await getBaseBranch()));
      const mergeBase = mode === "uncommitted" ? "HEAD" : await getMergeBase(baseBranch);
      const diffArgs = addWhitespaceArgs([mergeBase], whitespace);

      const [fullPatch, rawSummary] = await Promise.all([
        runGit(["diff", ...diffArgs]),
        runGit(["diff", "--numstat", "-z", "-M", ...diffArgs]),
      ]);
      const fingerprint = createHash("sha1").update(fullPatch).digest("hex");
      const summary = parseDiffStats(rawSummary);
      const createdAt = Date.now();
      const generation = createSnapshotGeneration(
        gitRuntimeState.serverBootId,
        fingerprint,
        mergeBase,
      );

      const snapshot: DiffSnapshot = {
        baseBranch,
        branch,
        deletions: summary.deletions,
        files: summary.files,
        fingerprint,
        fullPatch,
        generation,
        insertions: summary.insertions,
        mergeBase,
        metadata: {
          bootId: gitRuntimeState.serverBootId,
          createdAt,
          repoPath,
        },
        patchByFile: splitPatchByFile(fullPatch),
      };

      if (isDebugLogging) {
        console.info("[diffhub] snapshot cache miss", {
          generation,
          repoPath,
          source: "recomputed",
        });
      }
      writeSnapshotToDisk(repoPath, base, mode, whitespace, snapshot);
      return snapshot;
    },
  );
};

export const getDiffForFile = async (
  file: string,
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<DiffResult> => {
  const snapshot = await getDiffSnapshot(base, mode, whitespace, expectedGeneration);
  const patch = snapshot.patchByFile.get(file) ?? "";
  return {
    baseBranch: snapshot.baseBranch,
    branch: snapshot.branch,
    fingerprint: snapshot.fingerprint,
    generation: snapshot.generation,
    mergeBase: snapshot.mergeBase,
    patch,
    reviewKey: createReviewKey(patch),
  };
};

interface MultiFileDiffResult extends DiffStatsResult {
  mergeBase: string;
  patchByFile: Record<string, string>;
  reviewKeyByFile: Record<string, string>;
}

export const getMultiFileDiff = async (
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<MultiFileDiffResult> => {
  const snapshot = await getDiffSnapshot(base, mode, whitespace, expectedGeneration);
  const patchByFile = Object.fromEntries(snapshot.patchByFile);
  const reviewKeyByFile = Object.fromEntries(
    Object.entries(patchByFile).map(([file, patch]) => [file, createReviewKey(patch)]),
  );

  return {
    baseBranch: snapshot.baseBranch,
    branch: snapshot.branch,
    deletions: snapshot.deletions,
    files: snapshot.files,
    fingerprint: snapshot.fingerprint,
    generation: snapshot.generation,
    insertions: snapshot.insertions,
    mergeBase: snapshot.mergeBase,
    patchByFile,
    reviewKeyByFile,
  };
};

export interface DiffFileStat {
  file: string;
  changes: number;
  insertions: number;
  deletions: number;
  binary: boolean;
}

interface DiffStatsResult {
  files: DiffFileStat[];
  insertions: number;
  deletions: number;
  branch: string;
  baseBranch: string;
  fingerprint: string;
  generation: string;
}

export const getDiffStats = async (
  base?: string,
  mode?: "uncommitted",
  whitespace?: WhitespaceMode,
): Promise<DiffStatsResult> => {
  const snapshot = await getDiffSnapshot(base, mode, whitespace);
  return {
    baseBranch: snapshot.baseBranch,
    branch: snapshot.branch,
    deletions: snapshot.deletions,
    files: snapshot.files,
    fingerprint: snapshot.fingerprint,
    generation: snapshot.generation,
    insertions: snapshot.insertions,
  };
};

export const primeGitSnapshots = async (): Promise<void> => {
  const results = await Promise.allSettled([
    getDiffStats(),
    getDiffStats(undefined, "uncommitted"),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[diffhub] failed to prime diff snapshot", { error: result.reason });
    }
  }
};

/**
 * Return the content of a file at a specific git ref.
 * Pass "WORKING_TREE" to read the current working-tree copy.
 * Returns an empty string if the file doesn't exist at that ref (new/deleted files).
 */
export const getFileAtRef = (filePath: string, ref: string): Promise<string> => {
  const repoPath = getRepoPath();
  if (ref === "WORKING_TREE") {
    try {
      return Promise.resolve(readFileSync(resolveRepoFilePath(repoPath, filePath), "utf-8"));
    } catch {
      // empty
      return Promise.resolve("");
    }
  }
  return cached(`file:${repoPath}:${ref}:${filePath}`, 30_000, async () => {
    try {
      return await runGit(["show", `${ref}:${filePath}`]);
    } catch {
      // empty
      return "";
    }
  });
};

/** Discard all uncommitted changes to a file (staged + working tree). */
export const discardFile = async (file: string): Promise<void> => {
  // restore --staged --worktree handles both staged and unstaged changes
  await runGit(["restore", "--staged", "--worktree", "--", file]);
};
