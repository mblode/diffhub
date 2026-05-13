import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addComment, clearCommentCache, readComments } from "../lib/comments";

const tempPaths: string[] = [];

const createTempRepo = (): string => {
  const repoPath = mkdtempSync(join(tmpdir(), "diffhub-comments-anchor-"));
  mkdirSync(join(repoPath, ".git"));
  tempPaths.push(repoPath);
  return repoPath;
};

const writeSource = (contents: string): void => {
  writeFileSync(join(process.env.DIFFHUB_REPO as string, "src.ts"), contents);
  clearCommentCache();
};

describe("comment content anchors", () => {
  beforeEach(() => {
    process.env.DIFFHUB_REPO = createTempRepo();
    writeSource(["alpha", "before", "target", "after", "omega"].join("\n"));
  });

  afterEach(() => {
    delete process.env.DIFFHUB_REPO;
    clearCommentCache();

    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("keeps an exact line match fresh", async () => {
    await addComment({
      body: "Check target",
      file: "src.ts",
      lineNumber: 3,
      side: "right",
      tag: "",
    });

    expect(readComments()).toMatchObject([
      {
        anchor: {
          afterContext: ["after", "omega"],
          beforeContext: ["alpha", "before"],
          lineContent: "target",
        },
        lineNumber: 3,
        staleness: "fresh",
      },
    ]);
  });

  it("rebases a shifted line near its original location", async () => {
    await addComment({
      body: "Check target",
      file: "src.ts",
      lineNumber: 3,
      side: "right",
      tag: "",
    });

    writeSource(
      ["one", "two", "three", "four", "five", "alpha", "before", "target", "after"].join("\n"),
    );

    expect(readComments()).toMatchObject([
      {
        lineNumber: 8,
        rebasedFromLine: 3,
        staleness: "moved",
      },
    ]);
  });

  it("marks a full rewrite stale", async () => {
    await addComment({
      body: "Check target",
      file: "src.ts",
      lineNumber: 3,
      side: "right",
      tag: "",
    });

    writeSource(["completely", "different", "file"].join("\n"));

    expect(readComments()).toMatchObject([{ lineNumber: 3, staleness: "stale" }]);
  });

  it("marks deleted files stale", async () => {
    await addComment({
      body: "Check target",
      file: "src.ts",
      lineNumber: 3,
      side: "right",
      tag: "",
    });

    unlinkSync(join(process.env.DIFFHUB_REPO as string, "src.ts"));
    clearCommentCache();

    expect(readComments()).toMatchObject([{ lineNumber: 3, staleness: "stale" }]);
  });

  it("migrates legacy comments by deriving an anchor from current file contents", () => {
    writeFileSync(
      join(process.env.DIFFHUB_REPO as string, ".git", "diffhub-comments.json"),
      JSON.stringify([
        {
          body: "Legacy comment",
          createdAt: "2026-05-13T00:00:00.000Z",
          file: "src.ts",
          id: "legacy-1",
          lineNumber: 3,
          side: "right",
          tag: "",
        },
      ]),
    );

    expect(readComments()).toMatchObject([
      {
        anchor: { lineContent: "target" },
        replies: [],
        resolved: false,
        staleness: "fresh",
      },
    ]);
  });
});
