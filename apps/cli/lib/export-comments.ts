import type { Comment } from "./comments";

export const exportCommentsAsPrompt = (comments: Comment[]): string => {
  if (comments.length === 0) {
    return "No comments.";
  }
  const lines = comments.map((c) => {
    const tag = c.tag ? `${c.tag} ` : "";
    const loc = c.lineNumber > 0 ? `:${c.lineNumber}` : "";
    return `- ${tag}**${c.file}${loc}**: ${c.body}`;
  });
  return `## Code Review Comments\n\nPlease address the following:\n\n${lines.join("\n")}`;
};
