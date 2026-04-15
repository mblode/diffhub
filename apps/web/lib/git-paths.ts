import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const GITDIR_PREFIX = "gitdir:";

export class InvalidRepoFilePathError extends Error {
  constructor(filePath: string) {
    super(`Invalid repo-relative path: ${filePath}`);
    this.name = "InvalidRepoFilePathError";
  }
}

export const getGitDirectory = (repoPath: string): string => {
  const gitPath = join(repoPath, ".git");
  if (!existsSync(gitPath)) {
    return gitPath;
  }

  if (lstatSync(gitPath).isDirectory()) {
    return gitPath;
  }

  const gitPointer = readFileSync(gitPath, "utf-8").trim();
  if (!gitPointer.startsWith(GITDIR_PREFIX)) {
    return gitPath;
  }

  const relativeGitDir = gitPointer.slice(GITDIR_PREFIX.length).trim();
  return resolve(dirname(gitPath), relativeGitDir);
};

export const resolveRepoFilePath = (repoPath: string, filePath: string): string => {
  if (!filePath || isAbsolute(filePath)) {
    throw new InvalidRepoFilePathError(filePath);
  }

  const resolvedPath = resolve(repoPath, filePath);
  const relativePath = relative(repoPath, resolvedPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new InvalidRepoFilePathError(filePath);
  }

  return resolvedPath;
};
