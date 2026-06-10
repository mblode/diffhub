import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeferred } from "./deferred";
import type { DiffFileStat } from "./diff-file-stat";
import { resolveRepoFilePath } from "./git-paths";
import { getConfiguredRepoPath, REPO_POINTER } from "./repo-path";

// TTL cache — avoids spawning git subprocesses on every poll
interface GitRuntimeState {
  cache: Map<string, { value: unknown; expires: number }>;
  inflight: Map<string, Promise<DiffSnapshot>>;
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
      inflight: new Map<string, Promise<DiffSnapshot>>(),
      lastPointerMtime: 0,
      serverBootId:
        bootSeed ??
        createHash("sha1").update(`${process.pid}:${Date.now()}:${Math.random()}`).digest("hex"),
    };
  }

  return globalScope.__diffhubGitRuntimeState;
};

const gitRuntimeState = getGitRuntimeState();
const { cache, inflight } = gitRuntimeState;
const MAX_GIT_OUTPUT_BYTES = 20 * 1024 * 1024;
const PREFERRED_BASE_BRANCHES = ["main", "master", "develop", "dev"] as const;
const SNAPSHOT_TTL_MS = 15_000;
const isDebugLogging = process.env.DIFFHUB_DEBUG === "1";

export const isCmuxRuntime = (): boolean => process.env.DIFFHUB_CMUX === "1";
const usesExternalSnapshotWriter = (): boolean =>
  process.env.DIFFHUB_EXTERNAL_SNAPSHOT_WRITER === "1";

const getSnapshotCachePrefix = (repoPath: string): string =>
  `diffhub-snapshot-${createHash("sha1").update(repoPath).digest("hex")}-`;

const getSnapshotCachePath = (
  repoPath: string,
  base?: string,
  scope?: DiffScope,
  whitespace?: WhitespaceMode,
): string => {
  const cacheKey = JSON.stringify({
    base: base ?? "",
    scope: scope ?? "",
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

interface RunGitOptions {
  // Exit codes (besides 0) to treat as success and resolve with stdout. Used by
  // `git diff --no-index`, which exits 1 whenever the two inputs differ — the
  // expected outcome when diffing an untracked file against /dev/null.
  allowExitCodes?: number[];
}

const runGitUnqueued = async (args: string[], options: RunGitOptions = {}): Promise<string> => {
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
        if (code === 0 || (code !== null && options.allowExitCodes?.includes(code))) {
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

const runGit = async (args: string[], options: RunGitOptions = {}): Promise<string> => {
  let releaseQueue!: VoidFunction;
  // oxlint-disable-next-line promise/avoid-new
  const gate = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  const previous = gitRuntimeState.gitCommandQueue;
  gitRuntimeState.gitCommandQueue = gate;
  await previous;

  try {
    return await runGitUnqueued(args, options);
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

/**
 * Diff scope selected in the StatusBar dropdown. Each value maps to a distinct
 * `git diff` range (see {@link resolveDiff}); "all" and "touched" additionally
 * fold in untracked files via {@link getUntrackedDiff}.
 *
 *   all       → merge-base(base, HEAD) vs working tree   (+ untracked)
 *   committed → merge-base(base, HEAD) vs HEAD
 *   staged    → HEAD vs index            (git diff --cached)
 *   unstaged  → index vs working tree    (git diff)
 *   touched   → HEAD vs working tree     (git diff HEAD, + untracked)
 */
export type DiffScope = "all" | "committed" | "staged" | "unstaged" | "touched";

export const DIFF_SCOPES = ["all", "committed", "staged", "unstaged", "touched"] as const;

// Validate a raw `?mode=` query value, returning null for unknown scopes so the
// route can reply 400 instead of silently falling back.
export const parseDiffScope = (value: string | null | undefined): DiffScope | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return (DIFF_SCOPES as readonly string[]).includes(value) ? (value as DiffScope) : null;
};

const DEFAULT_SCOPE: DiffScope = "touched";
const SCOPES_WITH_UNTRACKED: ReadonlySet<DiffScope> = new Set<DiffScope>(["all", "touched"]);

interface ResolvedDiff {
  // Arguments appended after `git diff -M [-w]` to select the range.
  range: string[];
  includeUntracked: boolean;
  baseBranch: string;
  mergeBase: string;
  branch: string;
}

// Translate a scope into the concrete git-diff range plus the branch metadata
// the StatusBar surfaces. Only "all"/"committed" resolve a base branch; the
// working-tree scopes have no meaningful base comparison, so they report HEAD.
const WORKING_TREE_RANGES: Record<"staged" | "unstaged" | "touched", string[]> = {
  staged: ["--cached"],
  touched: ["HEAD"],
  unstaged: [],
};

const resolveDiff = async (scope: DiffScope, base?: string): Promise<ResolvedDiff> => {
  const branchRaw = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = branchRaw.trim();
  const includeUntracked = SCOPES_WITH_UNTRACKED.has(scope);

  if (scope === "all" || scope === "committed") {
    const baseBranch = base ?? process.env.DIFFHUB_BASE ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    return {
      baseBranch,
      branch,
      includeUntracked,
      mergeBase,
      range: scope === "committed" ? [mergeBase, "HEAD"] : [mergeBase],
    };
  }

  return {
    baseBranch: "HEAD",
    branch,
    includeUntracked,
    mergeBase: "HEAD",
    range: WORKING_TREE_RANGES[scope],
  };
};

// `/dev/null` is the canonical "empty" side for synthesising a new-file patch.
// Untracked files only run on macOS/Linux dev machines; git also accepts this
// path on Windows.
const NULL_DEVICE = "/dev/null";

const listUntrackedFiles = async (): Promise<string[]> => {
  const raw = await runGit(["ls-files", "--others", "--exclude-standard", "-z"]);
  return raw.split("\0").filter(Boolean);
};

const buildUntrackedStat = (file: string, patch: string): DiffFileStat => {
  if (/^Binary files /m.test(patch)) {
    return { binary: true, changes: 0, deletions: 0, file, insertions: 0 };
  }
  let insertions = 0;
  for (const line of patch.split("\n")) {
    // Count added content lines; skip the "+++ b/file" header line.
    if (line.startsWith("+") && !line.startsWith("+++")) {
      insertions += 1;
    }
  }
  return { binary: false, changes: insertions, deletions: 0, file, insertions };
};

interface UntrackedDiff {
  files: DiffFileStat[];
  patchByFile: Map<string, string>;
}

// Synthesise "new file" patches for untracked files by diffing each against
// /dev/null. `--no-index` rewrites both header sides to the real path, so the
// output slots into splitPatchByFile/the stream parser like any added file.
const getUntrackedDiff = async (): Promise<UntrackedDiff> => {
  const untrackedFiles = await listUntrackedFiles();
  const patchByFile = new Map<string, string>();
  const files: DiffFileStat[] = [];

  for (const file of untrackedFiles) {
    const patch = await runGit(["diff", "--no-index", "-M", "--", NULL_DEVICE, file], {
      allowExitCodes: [1],
    });
    // Empty/identical files produce no diff (exit 0, empty stdout) — nothing to render.
    if (!patch.trim()) {
      continue;
    }
    patchByFile.set(file, patch.endsWith("\n") ? patch : `${patch}\n`);
    files.push(buildUntrackedStat(file, patch));
  }

  return { files, patchByFile };
};

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
  scope?: DiffScope,
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): DiffSnapshot | null => {
  if (!isCmuxRuntime()) {
    return null;
  }

  const snapshotPath = getSnapshotCachePath(repoPath, base, scope, whitespace);
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
      // avoid thrash; next write will overwrite
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
  scope?: DiffScope,
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<DiffSnapshot | null> => {
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline) {
    const snapshot = readSnapshotFromDisk(repoPath, base, scope, whitespace, expectedGeneration);
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
  scope: DiffScope | undefined,
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
    getSnapshotCachePath(repoPath, base, scope, whitespace),
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
  scope: DiffScope = DEFAULT_SCOPE,
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<DiffSnapshot> => {
  const repoPath = getRepoPath();
  const cacheKey = `snapshot:${repoPath}:${base ?? ""}:${scope}:${whitespace ?? ""}:${expectedGeneration ?? ""}`;
  return cached(cacheKey, SNAPSHOT_TTL_MS, () => {
    const existing = inflight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const compute = (async (): Promise<DiffSnapshot> => {
      try {
        const diskSnapshot = readSnapshotFromDisk(
          repoPath,
          base,
          scope,
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
            scope,
            whitespace,
            expectedGeneration,
          );
          if (awaitedSnapshot) {
            return awaitedSnapshot;
          }
          console.warn("[diffhub] external snapshot unavailable, recomputing inline", {
            expectedGeneration: expectedGeneration ?? null,
            repoPath,
            scope,
            whitespace: whitespace ?? "default",
          });
        }

        const resolved = await resolveDiff(scope, base);
        const rangeArgs = addWhitespaceArgs(resolved.range, whitespace);

        const [trackedPatch, rawSummary, untracked] = await Promise.all([
          runGit(["diff", "-M", ...rangeArgs]),
          runGit(["diff", "--numstat", "-z", "-M", ...rangeArgs]),
          resolved.includeUntracked
            ? getUntrackedDiff()
            : Promise.resolve<UntrackedDiff>({ files: [], patchByFile: new Map() }),
        ]);

        const fullPatch = untracked.patchByFile.size
          ? [trackedPatch, ...untracked.patchByFile.values()].join("")
          : trackedPatch;
        const fingerprint = createHash("sha1").update(fullPatch).digest("hex");
        const summary = parseDiffStats(rawSummary);
        const files = [...summary.files, ...untracked.files];
        const insertions =
          summary.insertions + untracked.files.reduce((total, file) => total + file.insertions, 0);
        const createdAt = Date.now();
        const generation = createSnapshotGeneration(
          gitRuntimeState.serverBootId,
          fingerprint,
          resolved.mergeBase,
        );

        const snapshot: DiffSnapshot = {
          baseBranch: resolved.baseBranch,
          branch: resolved.branch,
          deletions: summary.deletions,
          files,
          fingerprint,
          fullPatch,
          generation,
          insertions,
          mergeBase: resolved.mergeBase,
          metadata: {
            bootId: gitRuntimeState.serverBootId,
            createdAt,
            repoPath,
          },
          patchByFile: new Map([...splitPatchByFile(trackedPatch), ...untracked.patchByFile]),
        };

        if (isDebugLogging) {
          console.info("[diffhub] snapshot cache miss", {
            generation,
            repoPath,
            source: "recomputed",
          });
        }
        writeSnapshotToDisk(repoPath, base, scope, whitespace, snapshot);
        return snapshot;
      } finally {
        inflight.delete(cacheKey);
      }
    })();

    inflight.set(cacheKey, compute);
    return compute;
  });
};

interface StreamDiffPatchOptions {
  base?: string;
  scope?: DiffScope;
  whitespace?: WhitespaceMode;
  signal?: AbortSignal;
}

/**
 * Stream the raw unified git patch as a web ReadableStream without buffering the
 * whole output in memory. This is the streaming counterpart to
 * {@link getDiffSnapshot}'s `runGit(["diff", ...diffArgs])` call and produces
 * byte-identical output, just incrementally.
 *
 * Unlike the buffered helpers, this path intentionally skips the
 * MAX_GIT_OUTPUT_BYTES cap — the entire point is to handle arbitrarily large
 * diffs by streaming git's stdout straight to the client.
 */
export const streamDiffPatch = async (
  options: StreamDiffPatchOptions = {},
): Promise<ReadableStream<Uint8Array>> => {
  const { base, scope = DEFAULT_SCOPE, whitespace, signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const repoPath = getRepoPath();
  const resolved = await resolveDiff(scope, base);
  const args = ["diff", "-M", ...addWhitespaceArgs(resolved.range, whitespace)];

  // Untracked files have no git object to stream, so synthesise their patches up
  // front and flush them after the tracked diff closes. They're typically few
  // and small relative to the tracked diff, so buffering them is fine.
  let untrackedBytes: Uint8Array | null = null;
  if (resolved.includeUntracked) {
    const untracked = await getUntrackedDiff();
    untrackedBytes = new TextEncoder().encode([...untracked.patchByFile.values()].join(""));
  }

  if (isDebugLogging) {
    console.info("[diffhub] git stream start", { args });
  }

  let child: ReturnType<typeof spawn> | null = null;
  let settled = false;
  let onAbort: (() => void) | null = null;

  const cleanup = () => {
    if (onAbort) {
      signal?.removeEventListener("abort", onAbort);
      onAbort = null;
    }
  };

  return new ReadableStream<Uint8Array>({
    cancel() {
      settled = true;
      cleanup();
      child?.kill("SIGKILL");
    },
    pull() {
      // The consumer drained the queue and wants more — resume the source we
      // paused for backpressure. Safe to call when already flowing or ended.
      child?.stdout?.resume();
    },
    start(controller) {
      child = spawn("git", args, {
        cwd: repoPath,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const activeChild = child;
      const stderrChunks: Buffer[] = [];

      onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        activeChild.kill("SIGKILL");
        cleanup();
        controller.error(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      activeChild.stdout?.on("data", (chunk: Buffer) => {
        if (settled) {
          return;
        }
        controller.enqueue(new Uint8Array(chunk));
        // Apply backpressure: once the consumer is behind, stop pulling bytes
        // off git's stdout until `pull()` resumes the stream. Without this the
        // whole patch could accumulate in the queue for a slow consumer.
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          activeChild.stdout?.pause();
        }
      });

      activeChild.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      activeChild.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        controller.error(error);
      });

      activeChild.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (code === 0) {
          if (untrackedBytes?.length) {
            controller.enqueue(untrackedBytes);
          }
          controller.close();
          return;
        }
        const stderrText = Buffer.concat(stderrChunks).toString("utf-8").trim();
        controller.error(
          new Error(
            stderrText || `git ${args.join(" ")} failed with exit code ${code ?? "unknown"}`,
          ),
        );
      });
    },
  });
};

export const getDiffForFile = async (
  file: string,
  base?: string,
  scope?: DiffScope,
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<DiffResult> => {
  const snapshot = await getDiffSnapshot(base, scope, whitespace, expectedGeneration);
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
  scope?: DiffScope,
  whitespace?: WhitespaceMode,
  expectedGeneration?: string,
): Promise<MultiFileDiffResult> => {
  const snapshot = await getDiffSnapshot(base, scope, whitespace, expectedGeneration);
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

export type { DiffFileStat } from "./diff-file-stat";
export {
  LARGE_FILE_CHANGES_THRESHOLD,
  LARGE_FILE_PATCH_BYTES_THRESHOLD,
  isLargeDiffFile,
} from "./diff-file-stat";

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
  scope?: DiffScope,
  whitespace?: WhitespaceMode,
): Promise<DiffStatsResult> => {
  const snapshot = await getDiffSnapshot(base, scope, whitespace);
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
  // Warm the default scope plus the committed (base-branch) view, which is the
  // other one most likely to be opened first.
  const results = await Promise.allSettled([
    getDiffStats(undefined, DEFAULT_SCOPE),
    getDiffStats(undefined, "committed"),
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
