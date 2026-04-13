import { simpleGit, type SimpleGit } from "simple-git";
import { readFileSync, statSync } from "fs";

const REPO_POINTER = "/tmp/cmux-diff-active-repo";

// TTL cache — avoids spawning git subprocesses on every poll
const cache = new Map<string, { value: unknown; expires: number }>();
let lastPointerMtime = 0;

function bustCacheIfRepoChanged() {
  try {
    const mtime = statSync(REPO_POINTER).mtimeMs;
    if (mtime !== lastPointerMtime) {
      lastPointerMtime = mtime;
      cache.clear();
    }
  } catch {}
}

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  bustCacheIfRepoChanged();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

function getRepoPath(): string {
  // Temp file from cmux-diff-point takes priority (dev workflow)
  try {
    const p = readFileSync(REPO_POINTER, "utf-8").trim();
    if (p) return p;
  } catch {}
  // Fallback: env var (set by CLI in production, or .env.local)
  return process.env.CMUX_DIFF_REPO ?? process.cwd();
}

function git(): SimpleGit {
  return simpleGit(getRepoPath());
}

export async function getBaseBranch(): Promise<string> {
  const repoPath = getRepoPath();
  return cached(`baseBranch:${repoPath}`, 30_000, async () => {
    const g = git();
    const remotes = await g.branch(["-r"]);
    for (const name of ["main", "master", "develop", "dev"]) {
      if (remotes.all.includes(`origin/${name}`)) return `origin/${name}`;
    }
    const local = await g.branchLocal();
    for (const name of ["main", "master", "develop", "dev"]) {
      if (local.all.includes(name)) return name;
    }
    return "origin/main";
  });
}

export async function getMergeBase(baseBranch: string): Promise<string> {
  const repoPath = getRepoPath();
  return cached(`mergeBase:${repoPath}:${baseBranch}`, 30_000, async () => {
    const g = git();
    const mb = await g.raw(["merge-base", "HEAD", baseBranch]);
    return mb.trim();
  });
}

export interface DiffResult {
  patch: string;
  baseBranch: string;
  mergeBase: string;
  branch: string;
}

export async function getDiff(base?: string): Promise<DiffResult> {
  const repoPath = getRepoPath();
  return cached(`diff:${repoPath}:${base ?? ""}`, 2_000, async () => {
    const g = git();
    const baseBranch = base ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    const patch = await g.diff([mergeBase]);
    const branch = (await g.revparse(["--abbrev-ref", "HEAD"])).trim();
    return { patch, baseBranch, mergeBase, branch };
  });
}

export async function getDiffForFile(file: string, base?: string): Promise<DiffResult> {
  const repoPath = getRepoPath();
  return cached(`diff:${repoPath}:${base ?? ""}:${file}`, 2_000, async () => {
    const g = git();
    const baseBranch = base ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    const patch = await g.diff([mergeBase, "--", file]);
    const branch = (await g.revparse(["--abbrev-ref", "HEAD"])).trim();
    return { patch, baseBranch, mergeBase, branch };
  });
}

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

export async function getDiffStats(base?: string): Promise<DiffStatsResult> {
  const repoPath = getRepoPath();
  return cached(`stats:${repoPath}:${base ?? ""}`, 2_000, async () => {
    const g = git();
    const baseBranch = base ?? (await getBaseBranch());
    const mergeBase = await getMergeBase(baseBranch);
    const branch = (await g.revparse(["--abbrev-ref", "HEAD"])).trim();
    const summary = await g.diffSummary([mergeBase]);
    return {
      files: summary.files as DiffFileStat[],
      insertions: summary.insertions,
      deletions: summary.deletions,
      branch,
      baseBranch,
    };
  });
}
