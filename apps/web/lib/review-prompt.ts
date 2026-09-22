/**
 * The landing page demo's copy of the CLI's "Copy & clear comments" output.
 *
 * The source of truth is `apps/cli/lib/export-comments.ts`. This app is
 * deployed standalone and does not depend on the CLI package, so the format is
 * restated here and `review-prompt.test.ts` runs both against the same
 * comments. If the CLI format changes, that test fails before the demo starts
 * showing a prompt the product no longer writes.
 *
 * No imports: the demo is a client island and this stays a leaf module.
 */

export type ReviewTag = "[must-fix]" | "[suggestion]" | "[nit]" | "[question]" | "";

export type ReviewSide = "left" | "right";

export interface ReviewComment {
  body: string;
  file: string;
  /** 0 is a file-level comment, which carries no line or side. */
  lineNumber: number;
  side: ReviewSide;
  tag: ReviewTag;
}

export const formatReviewPrompt = (comments: readonly ReviewComment[]): string => {
  if (comments.length === 0) {
    return "No comments.";
  }
  const lines = comments.map((c) => {
    const tag = c.tag ? `${c.tag} ` : "";
    const loc = c.lineNumber > 0 ? `:${c.lineNumber}` : "";
    const side = c.lineNumber > 0 ? ` (${c.side === "left" ? "old" : "new"} side)` : "";
    return `- ${tag}**${c.file}${loc}**${side}: ${c.body}`;
  });
  return `## Code Review Comments\n\nPlease address the following:\n\n${lines.join("\n")}`;
};
