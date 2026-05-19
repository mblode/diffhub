import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addComment,
  addReply,
  clearCommentCache,
  deleteComment,
  readComments,
  setCommentResolved,
} from "./comments";

const tempPaths: string[] = [];

const createTempRepo = (): string => {
  const repoPath = mkdtempSync(join(tmpdir(), "diffhub-comments-store-"));
  mkdirSync(join(repoPath, ".git"));
  tempPaths.push(repoPath);
  return repoPath;
};

describe("comments store", () => {
  beforeEach(() => {
    process.env.DIFFHUB_REPO = createTempRepo();
    process.env.DIFFHUB_USER = "Store Tester";
  });

  afterEach(() => {
    delete process.env.DIFFHUB_AUTO_RESOLVE_STALE;
    delete process.env.DIFFHUB_USER;
    delete process.env.DIFFHUB_REPO;
    clearCommentCache();

    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("returns an empty list when the comment store is missing", () => {
    expect(readComments()).toStrictEqual([]);
  });

  it("throws when the comment store is corrupted", () => {
    writeFileSync(join(process.env.DIFFHUB_REPO as string, ".git", "diffhub-comments.json"), "{}");

    expect(() => readComments()).toThrow("Comment store is corrupted");
  });

  it("serializes queued writes and persists deletions", async () => {
    mkdirSync(join(process.env.DIFFHUB_REPO as string, "src"));
    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/a.ts"), "first\n");
    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/b.ts"), "one\nsecond\n");
    clearCommentCache();

    const [firstComment, secondComment] = await Promise.all([
      addComment({
        body: "First comment",
        file: "src/a.ts",
        lineNumber: 1,
        side: "left",
        tag: "",
      }),
      addComment({
        body: "Second comment",
        file: "src/b.ts",
        lineNumber: 2,
        side: "right",
        tag: "[question]",
      }),
    ]);

    expect(
      readComments()
        .map((comment) => comment.body)
        .toSorted(),
    ).toStrictEqual(["First comment", "Second comment"]);

    await deleteComment(firstComment.id);

    expect(readComments()).toStrictEqual([secondComment]);
  });

  it("resolves, unresolves, and appends replies", async () => {
    const comment = await addComment({
      body: "Needs work",
      file: "src/a.ts",
      lineNumber: 1,
      side: "right",
      tag: "",
    });

    await setCommentResolved(comment.id, true);
    expect(readComments()).toMatchObject([
      {
        resolved: true,
        resolvedAt: expect.any(String),
        resolvedBy: "Store Tester",
      },
    ]);

    await addReply(comment.id, "Fixed now");
    expect(readComments()).toMatchObject([
      {
        replies: [{ at: expect.any(String), body: "Fixed now", by: "Store Tester" }],
        resolved: true,
      },
    ]);

    await setCommentResolved(comment.id, false);
    const [unresolved] = readComments();
    expect(unresolved).toMatchObject({ resolved: false });
    expect(unresolved?.resolvedAt).toBeUndefined();
    expect(unresolved?.resolvedBy).toBeUndefined();
  });

  it("marks deleted anchored files stale", async () => {
    mkdirSync(join(process.env.DIFFHUB_REPO as string, "src"));
    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/a.ts"), "before\ntarget\nafter\n");
    clearCommentCache();

    await addComment({
      body: "Needs work",
      file: "src/a.ts",
      lineNumber: 2,
      side: "right",
      tag: "",
    });

    unlinkSync(join(process.env.DIFFHUB_REPO as string, "src/a.ts"));
    clearCommentCache();

    expect(readComments()).toMatchObject([{ lineNumber: 2, staleness: "stale" }]);
  });

  it("moves anchors near the original line and by unique context", async () => {
    mkdirSync(join(process.env.DIFFHUB_REPO as string, "src"));
    writeFileSync(
      join(process.env.DIFFHUB_REPO as string, "src/a.ts"),
      ["alpha", "before", "target", "after", "omega"].join("\n"),
    );
    clearCommentCache();

    await addComment({
      body: "Needs work",
      file: "src/a.ts",
      lineNumber: 3,
      side: "right",
      tag: "",
    });

    writeFileSync(
      join(process.env.DIFFHUB_REPO as string, "src/a.ts"),
      ["one", "two", "three", "alpha", "before", "target", "after", "omega"].join("\n"),
    );
    clearCommentCache();
    expect(readComments()).toMatchObject([
      { lineNumber: 6, rebasedFromLine: 3, staleness: "moved" },
    ]);

    writeFileSync(
      join(process.env.DIFFHUB_REPO as string, "src/a.ts"),
      ["target", "noise", "alpha", "before", "target", "after", "omega"].join("\n"),
    );
    clearCommentCache();
    expect(readComments()).toMatchObject([
      { lineNumber: 5, rebasedFromLine: 6, staleness: "moved" },
    ]);
  });

  it("moves a first-line anchor to the nearest matching line", async () => {
    mkdirSync(join(process.env.DIFFHUB_REPO as string, "src"));
    writeFileSync(
      join(process.env.DIFFHUB_REPO as string, "src/a.ts"),
      ["target", "same", "same"].join("\n"),
    );
    clearCommentCache();

    await addComment({
      body: "Needs work",
      file: "src/a.ts",
      lineNumber: 1,
      side: "right",
      tag: "",
    });

    writeFileSync(
      join(process.env.DIFFHUB_REPO as string, "src/a.ts"),
      ["same", "target", "same", "target"].join("\n"),
    );
    clearCommentCache();

    expect(readComments()).toMatchObject([
      { lineNumber: 2, rebasedFromLine: 1, staleness: "moved" },
    ]);
  });

  it("auto-resolves stale transitions when enabled", async () => {
    mkdirSync(join(process.env.DIFFHUB_REPO as string, "src"));
    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/a.ts"), "before\ntarget\nafter\n");
    clearCommentCache();

    await addComment({
      body: "Needs work",
      file: "src/a.ts",
      lineNumber: 2,
      side: "right",
      tag: "",
    });

    process.env.DIFFHUB_AUTO_RESOLVE_STALE = "1";
    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/a.ts"), "replacement\ncontent\n");
    clearCommentCache();

    expect(readComments()).toMatchObject([
      {
        resolved: true,
        resolvedBy: "diffhub:auto-stale",
        staleness: "stale",
      },
    ]);
  });

  it("does not auto-resolve a new comment on a missing working-tree file", async () => {
    process.env.DIFFHUB_AUTO_RESOLVE_STALE = "1";

    await addComment({
      body: "Deleted file note",
      file: "src/deleted.ts",
      lineNumber: 1,
      side: "left",
      tag: "",
    });

    expect(readComments()).toMatchObject([
      {
        resolved: false,
        staleness: "stale",
      },
    ]);
  });

  it("auto-resolves a missing-file anchor after the file appears and later turns stale", async () => {
    process.env.DIFFHUB_AUTO_RESOLVE_STALE = "1";

    await addComment({
      body: "Deleted file note",
      file: "src/deleted.ts",
      lineNumber: 1,
      side: "left",
      tag: "",
    });

    mkdirSync(join(process.env.DIFFHUB_REPO as string, "src"));
    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/deleted.ts"), "\n");
    clearCommentCache();
    expect(readComments()).toMatchObject([
      {
        anchor: { createdFromMissingFile: false },
        resolved: false,
        staleness: "fresh",
      },
    ]);

    writeFileSync(join(process.env.DIFFHUB_REPO as string, "src/deleted.ts"), "replacement\n");
    clearCommentCache();

    expect(readComments()).toMatchObject([
      {
        resolved: true,
        resolvedBy: "diffhub:auto-stale",
        staleness: "stale",
      },
    ]);
  });

  it("persists cleanup of corrupted rebasedFromLine values", () => {
    const commentsPath = join(process.env.DIFFHUB_REPO as string, ".git", "diffhub-comments.json");
    writeFileSync(
      commentsPath,
      JSON.stringify([
        {
          anchor: {
            afterContext: [],
            beforeContext: [],
            fileSha: "",
            lineContent: "",
          },
          body: "Corrupt metadata",
          createdAt: "2026-05-13T00:00:00.000Z",
          file: "src/a.ts",
          id: "corrupt-1",
          lineNumber: 1,
          rebasedFromLine: "not-a-number",
          replies: [],
          resolved: false,
          side: "right",
          staleness: "stale",
          tag: "",
        },
      ]),
    );

    expect(readComments()[0]?.rebasedFromLine).toBeUndefined();
    const persisted = JSON.parse(readFileSync(commentsPath, "utf-8")) as Record<string, unknown>[];
    expect(persisted[0]?.rebasedFromLine).toBeUndefined();
  });
});
