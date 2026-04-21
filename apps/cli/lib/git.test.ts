import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tempPaths: string[] = [];
const originalEnv = {
  DIFFHUB_DEBUG: process.env.DIFFHUB_DEBUG,
  DIFFHUB_REPO: process.env.DIFFHUB_REPO,
};

const runGit = (repoPath: string, args: string[]): string =>
  execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

const createRepo = (): string => {
  const repoPath = mkdtempSync(join(tmpdir(), "diffhub-git-"));
  tempPaths.push(repoPath);

  runGit(repoPath, ["init"]);
  runGit(repoPath, ["branch", "-M", "main"]);
  runGit(repoPath, ["config", "user.email", "test@example.com"]);
  runGit(repoPath, ["config", "user.name", "Diffhub Test"]);

  writeFileSync(join(repoPath, "notes.txt"), "before\n", "utf-8");
  runGit(repoPath, ["add", "notes.txt"]);
  runGit(repoPath, ["commit", "-m", "initial"]);
  runGit(repoPath, ["checkout", "-b", "feature/logging"]);

  writeFileSync(join(repoPath, "notes.txt"), "before\nafter\n", "utf-8");

  return repoPath;
};

const loadGitModule = async () => {
  vi.resetModules();
  delete (
    globalThis as typeof globalThis & {
      __diffhubGitRuntimeState?: unknown;
    }
  ).__diffhubGitRuntimeState;
  return await import("./git");
};

describe("git snapshot logging", () => {
  beforeEach(() => {
    delete process.env.DIFFHUB_DEBUG;
    delete process.env.DIFFHUB_REPO;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.DIFFHUB_DEBUG = originalEnv.DIFFHUB_DEBUG;
    process.env.DIFFHUB_REPO = originalEnv.DIFFHUB_REPO;

    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("stays quiet by default when recomputing a snapshot", async () => {
    const repoPath = createRepo();
    process.env.DIFFHUB_REPO = repoPath;

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getDiffStats } = await loadGitModule();

    const result = await getDiffStats();

    expect(result.files).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ file: "notes.txt" })]),
    );
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("emits snapshot miss logs when debug logging is enabled", async () => {
    const repoPath = createRepo();
    process.env.DIFFHUB_DEBUG = "1";
    process.env.DIFFHUB_REPO = repoPath;

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getDiffStats } = await loadGitModule();

    await getDiffStats();

    expect(infoSpy.mock.calls).toContainEqual([
      "[diffhub] snapshot cache miss",
      expect.objectContaining({
        generation: expect.any(String),
        repoPath,
        source: "recomputed",
      }),
    ]);
  });

  it("deduplicates concurrent getDiffStats calls into a single compute", async () => {
    const repoPath = createRepo();
    process.env.DIFFHUB_DEBUG = "1";
    process.env.DIFFHUB_REPO = repoPath;

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getDiffStats } = await loadGitModule();

    const [first, second] = await Promise.all([getDiffStats(), getDiffStats()]);

    expect(first).toStrictEqual(second);

    const missCalls = infoSpy.mock.calls.filter(
      ([message, payload]) =>
        message === "[diffhub] snapshot cache miss" &&
        (payload as { source?: string } | undefined)?.source === "recomputed",
    );
    expect(missCalls).toHaveLength(1);
  });
});
