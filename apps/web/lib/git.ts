import { simpleGit } from "simple-git";
import type { SimpleGit } from "simple-git";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_POINTER = "/tmp/diffr-active-repo";

// TTL cache — avoids spawning git subprocesses on every poll
const cache = new Map<string, { value: unknown; expires: number }>();
let lastPointerMtime = 0;

const bustCacheIfRepoChanged = () => {
  try {
    const mtime = statSync(REPO_POINTER).mtimeMs;
    if (mtime !== lastPointerMtime) {
      lastPointerMtime = mtime;
      cache.clear();
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

const getRepoPath = (): string => {
  // Temp file from diffr-point takes priority (dev workflow)
  try {
    const p = readFileSync(REPO_POINTER, "utf-8").trim();
    if (p) {
      return p;
    }
  } catch {
    // empty
  }
  // Fallback: env var (set by CLI in production, or .env.local)
  return process.env.DIFFR_REPO ?? process.cwd();
};

const git = (): SimpleGit => simpleGit(getRepoPath());

export const getBaseBranch = (): Promise<string> => {
  const repoPath = getRepoPath();
  return cached(`baseBranch:${repoPath}`, 30_000, async () => {
    const g = git();
    const remotes = await g.branch(["-r"]);
    for (const name of ["main", "master", "develop", "dev"]) {
      if (remotes.all.includes(`origin/${name}`)) {
        return `origin/${name}`;
      }
    }
    const local = await g.branchLocal();
    for (const name of ["main", "master", "develop", "dev"]) {
      if (local.all.includes(name)) {
        return name;
      }
    }
    return "origin/main";
  });
};

export const getMergeBase = (baseBranch: string): Promise<string> => {
  const repoPath = getRepoPath();
  return cached(`mergeBase:${repoPath}:${baseBranch}`, 30_000, async () => {
    const g = git();
    const mb = await g.raw(["merge-base", "HEAD", baseBranch]);
    return mb.trim();
  });
};

export interface DiffResult {
  patch: string;
  baseBranch: string;
  mergeBase: string;
  branch: string;
}

export const getDiff = (base?: string, mode?: "uncommitted"): Promise<DiffResult> => {
  const repoPath = getRepoPath();
  return cached(`diff:${repoPath}:${base ?? ""}:${mode ?? ""}`, 2000, async () => {
    const g = git();
    const raw = await g.revparse(["--abbrev-ref", "HEAD"]);
    const branch = raw.trim();
    if (mode === "uncommitted") {
      const patch = await g.diff(["HEAD"]);
      return { baseBranch: "HEAD", branch, mergeBase: "HEAD", patch };
    }
    const baseBranch = base ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    const patch = await g.diff([mergeBase]);
    return { baseBranch, branch, mergeBase, patch };
  });
};

export const getDiffForFile = (
  file: string,
  base?: string,
  mode?: "uncommitted",
): Promise<DiffResult> => {
  const repoPath = getRepoPath();
  return cached(`diff:${repoPath}:${base ?? ""}:${mode ?? ""}:${file}`, 2000, async () => {
    const g = git();
    const raw = await g.revparse(["--abbrev-ref", "HEAD"]);
    const branch = raw.trim();
    if (mode === "uncommitted") {
      const patch = await g.diff(["HEAD", "--", file]);
      return { baseBranch: "HEAD", branch, mergeBase: "HEAD", patch };
    }
    const baseBranch = base ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    const patch = await g.diff([mergeBase, "--", file]);
    return { baseBranch, branch, mergeBase, patch };
  });
};

export interface DiffFileStat {
  file: string;
  changes: number;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface DiffStatsResult {
  files: DiffFileStat[];
  insertions: number;
  deletions: number;
  branch: string;
  baseBranch: string;
}

export const getDiffStats = (base?: string, mode?: "uncommitted"): Promise<DiffStatsResult> => {
  const repoPath = getRepoPath();
  return cached(`stats:${repoPath}:${base ?? ""}:${mode ?? ""}`, 2000, async () => {
    const g = git();
    const raw = await g.revparse(["--abbrev-ref", "HEAD"]);
    const branch = raw.trim();
    if (mode === "uncommitted") {
      const baseBranch = "HEAD";
      const summary = await g.diffSummary(["HEAD"]);
      return {
        baseBranch,
        branch,
        deletions: summary.deletions,
        files: summary.files as DiffFileStat[],
        insertions: summary.insertions,
      };
    }
    const baseBranch = base ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    const summary = await g.diffSummary([mergeBase]);
    return {
      baseBranch,
      branch,
      deletions: summary.deletions,
      files: summary.files as DiffFileStat[],
      insertions: summary.insertions,
    };
  });
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
      return Promise.resolve(readFileSync(join(repoPath, filePath), "utf-8"));
    } catch {
      // empty
      return Promise.resolve("");
    }
  }
  return cached(`file:${repoPath}:${ref}:${filePath}`, 30_000, async () => {
    try {
      return await git().show([`${ref}:${filePath}`]);
    } catch {
      // empty
      return "";
    }
  });
};

/** Discard all uncommitted changes to a file (staged + working tree). */
export const discardFile = async (file: string): Promise<void> => {
  const g = git();
  // restore --staged --worktree handles both staged and unstaged changes
  await g.raw(["restore", "--staged", "--worktree", "--", file]);
};
