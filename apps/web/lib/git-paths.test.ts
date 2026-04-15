import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidRepoFilePathError, getGitDirectory, resolveRepoFilePath } from "./git-paths";

const tempPaths: string[] = [];

const createTempDir = (): string => {
  const tempPath = mkdtempSync(join(tmpdir(), "diffhub-git-paths-"));
  tempPaths.push(tempPath);
  return tempPath;
};

describe("git-paths", () => {
  afterEach(() => {
    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("resolves a real .git directory", () => {
    const repoPath = createTempDir();
    const gitPath = join(repoPath, ".git");

    mkdirSync(gitPath);

    expect(getGitDirectory(repoPath)).toBe(gitPath);
  });

  it("resolves a worktree .git pointer file", () => {
    const repoPath = createTempDir();
    const actualGitDir = join(repoPath, ".worktrees", "feature");

    mkdirSync(actualGitDir, { recursive: true });
    writeFileSync(join(repoPath, ".git"), "gitdir: .worktrees/feature\n");

    expect(getGitDirectory(repoPath)).toBe(actualGitDir);
  });

  it("rejects paths outside the repository root", () => {
    const repoPath = createTempDir();

    expect(() => resolveRepoFilePath(repoPath, "../secret.txt")).toThrow(InvalidRepoFilePathError);
  });
});
