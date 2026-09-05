import type { Comment } from "./comment-types";

export const exportCommentsAsPrompt = (comments: Comment[]): string => {
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
