import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addComment, deleteComment, readComments } from "./comments";

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
  });

  afterEach(() => {
    delete process.env.DIFFHUB_REPO;

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

    expect(readComments().map((comment) => comment.body)).toStrictEqual([
      "First comment",
      "Second comment",
    ]);

    await deleteComment(firstComment.id);

    expect(readComments()).toStrictEqual([secondComment]);
  });
});
