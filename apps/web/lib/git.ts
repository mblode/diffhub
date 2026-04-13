import { simpleGit, type SimpleGit } from "simple-git";
import { readFileSync } from "fs";

const REPO_POINTER = "/tmp/cmux-diff-active-repo";

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
  const g = git();
  // Prefer remote tracking branch so diffs show unpushed commits
  // even when you're already on main locally.
  const remotes = await g.branch(["-r"]);
  for (const name of ["main", "master", "develop", "dev"]) {
    if (remotes.all.includes(`origin/${name}`)) return `origin/${name}`;
  }
  // Fall back to local branch
  const local = await g.branchLocal();
  for (const name of ["main", "master", "develop", "dev"]) {
    if (local.all.includes(name)) return name;
  }
  return "origin/main";
}

export async function getMergeBase(baseBranch: string): Promise<string> {
  const g = git();
  const mb = await g.raw(["merge-base", "HEAD", baseBranch]);
  return mb.trim();
}

export interface DiffResult {
  patch: string;
  baseBranch: string;
  mergeBase: string;
  branch: string;
}

export async function getDiff(base?: string): Promise<DiffResult> {
  const g = git();
  const baseBranch = base ?? (await getBaseBranch());
  const mergeBase = await getMergeBase(baseBranch);
  // Compare working tree to merge-base: covers committed + staged + unstaged
  // in one clean patch with no duplicate file entries.
  const patch = await g.diff([mergeBase]);
  const branch = (await g.revparse(["--abbrev-ref", "HEAD"])).trim();
  return { patch, baseBranch, mergeBase, branch };
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
}
