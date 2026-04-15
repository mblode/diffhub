import { readFileSync } from "node:fs";

export const REPO_POINTER = "/tmp/diffhub-active-repo";

const readRepoPathFromPointer = (): string | null => {
  try {
    const repoPath = readFileSync(REPO_POINTER, "utf-8").trim();
    if (repoPath) {
      return repoPath;
    }
  } catch {
    // empty
  }

  return null;
};

export const getConfiguredRepoPath = (): string => {
  if (process.env.DIFFHUB_REPO) {
    return process.env.DIFFHUB_REPO;
  }

  const pointedRepoPath = readRepoPathFromPointer();
  if (pointedRepoPath) {
    return pointedRepoPath;
  }

  return process.cwd();
};
