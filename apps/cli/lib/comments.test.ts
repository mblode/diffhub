import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addComment, deleteComment, readComments } from "./comments";

import { exportCommentsAsPrompt } from "./export-comments";

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

describe("review prompt export", () => {
  it("distinguishes old and new code at the same file and line", () => {
    const common = {
      body: "Keep the validation",
      createdAt: "2026-09-05",
      file: "src/save.ts",
      lineNumber: 12,
      tag: "[must-fix]" as const,
    };
    const prompt = exportCommentsAsPrompt([
      { ...common, id: "old", side: "left" },
      { ...common, id: "new", side: "right" },
    ]);
    expect(prompt).toContain("[must-fix] **src/save.ts:12** (old side): Keep the validation");
    expect(prompt).toContain("[must-fix] **src/save.ts:12** (new side): Keep the validation");
  });

  it("keeps file comments free of a misleading line or side", () => {
    expect(
      exportCommentsAsPrompt([
        {
          body: "Split this module",
          createdAt: "2026-09-05",
          file: "src/save.ts",
          id: "file",
          lineNumber: 0,
          side: "right",
          tag: "",
        },
      ]),
    ).toContain("**src/save.ts**: Split this module");
    expect(exportCommentsAsPrompt([])).toBe("No comments.");
  });
});
