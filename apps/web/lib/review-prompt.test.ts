import { expect, test } from "vitest";

import { exportCommentsAsPrompt } from "../../cli/lib/export-comments";
import { formatReviewPrompt } from "./review-prompt";
import type { ReviewComment } from "./review-prompt";

const comments: ReviewComment[] = [
  {
    body: "Should file-level comments name a side too?",
    file: "apps/cli/lib/export-comments.ts",
    lineNumber: 10,
    side: "right",
    tag: "[question]",
  },
  {
    body: "Keep the old format working for saved comments.",
    file: "apps/cli/lib/export-comments.ts",
    lineNumber: 10,
    side: "left",
    tag: "[must-fix]",
  },
  {
    body: "Add a changeset.",
    file: "apps/cli/lib/export-comments.ts",
    lineNumber: 0,
    side: "right",
    tag: "",
  },
];

test("the landing demo writes the same prompt as the CLI", () => {
  const cli = exportCommentsAsPrompt(
    comments.map((comment, index) => ({
      ...comment,
      createdAt: "2026-09-22T00:00:00.000Z",
      id: String(index),
    })),
  );

  expect(formatReviewPrompt(comments)).toBe(cli);
  expect(formatReviewPrompt([])).toBe(exportCommentsAsPrompt([]));
});

test("line comments name the side, file-level comments do not", () => {
  const prompt = formatReviewPrompt(comments);

  expect(prompt).toContain(
    "- [question] **apps/cli/lib/export-comments.ts:10** (new side): Should file-level comments name a side too?",
  );
  expect(prompt).toContain("- [must-fix] **apps/cli/lib/export-comments.ts:10** (old side):");
  expect(prompt).toContain("- **apps/cli/lib/export-comments.ts**: Add a changeset.");
});
