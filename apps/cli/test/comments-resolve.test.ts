import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addComment,
  addReply,
  clearCommentCache,
  readComments,
  setCommentResolved,
} from "../lib/comments";

const tempPaths: string[] = [];

const createTempRepo = (): string => {
  const repoPath = mkdtempSync(join(tmpdir(), "diffhub-comments-resolve-"));
  mkdirSync(join(repoPath, ".git"));
  tempPaths.push(repoPath);
  return repoPath;
};

const writeSource = (contents: string): void => {
  writeFileSync(join(process.env.DIFFHUB_REPO as string, "src.ts"), contents);
  clearCommentCache();
};

describe("comment resolution and replies", () => {
  beforeEach(() => {
    process.env.DIFFHUB_REPO = createTempRepo();
    process.env.DIFFHUB_USER = "Reviewer";
    writeSource(["before", "target", "after"].join("\n"));
  });

  afterEach(() => {
    delete process.env.DIFFHUB_AUTO_RESOLVE_STALE;
    delete process.env.DIFFHUB_REPO;
    delete process.env.DIFFHUB_USER;
    clearCommentCache();

    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("resolve sets audit fields and unresolve clears them", async () => {
    const comment = await addComment({
      body: "Needs work",
      file: "src.ts",
      lineNumber: 2,
      side: "right",
      tag: "",
    });

    await setCommentResolved(comment.id, true);
    expect(readComments()).toMatchObject([
      {
        resolved: true,
        resolvedAt: expect.any(String),
        resolvedBy: "Reviewer",
      },
    ]);

    await setCommentResolved(comment.id, false);
    const [unresolved] = readComments();
    expect(unresolved).toMatchObject({ resolved: false });
    expect(unresolved?.resolvedBy).toBeUndefined();
    expect(unresolved?.resolvedAt).toBeUndefined();
  });

  it("appends replies without changing resolution state", async () => {
    const comment = await addComment({
      body: "Needs work",
      file: "src.ts",
      lineNumber: 2,
      side: "right",
      tag: "",
    });

    await addReply(comment.id, "Fixed in the next commit");

    expect(readComments()).toMatchObject([
      {
        replies: [
          {
            at: expect.any(String),
            body: "Fixed in the next commit",
            by: "Reviewer",
          },
        ],
        resolved: false,
      },
    ]);
  });

  it("auto-resolves stale transitions only when explicitly enabled", async () => {
    const comment = await addComment({
      body: "Needs work",
      file: "src.ts",
      lineNumber: 2,
      side: "right",
      tag: "",
    });

    process.env.DIFFHUB_AUTO_RESOLVE_STALE = "1";
    writeSource(["replacement", "content"].join("\n"));

    expect(readComments()).toMatchObject([
      {
        id: comment.id,
        resolved: true,
        resolvedBy: "diffhub:auto-stale",
        staleness: "stale",
      },
    ]);
  });
});
