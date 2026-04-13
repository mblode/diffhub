import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const getCommentsPath = (): string => {
  const repoPath = process.env.DIFFR_REPO ?? process.cwd();
  return join(repoPath, ".git", "diffr-comments.json");
};

export type CommentTag = "[must-fix]" | "[suggestion]" | "[nit]" | "[question]" | "";

export interface Comment {
  id: string;
  file: string;
  lineNumber: number;
  side: "left" | "right";
  body: string;
  tag: CommentTag;
  createdAt: string;
}

export const readComments = (): Comment[] => {
  const path = getCommentsPath();
  if (!existsSync(path)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Comment[];
  } catch {
    // empty
    return [];
  }
};

const saveComments = (comments: Comment[]): void => {
  writeFileSync(getCommentsPath(), JSON.stringify(comments, null, 2));
};

export const addComment = (data: Omit<Comment, "id" | "createdAt">): Comment => {
  const comments = readComments();
  const comment: Comment = {
    ...data,
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
  comments.push(comment);
  saveComments(comments);
  return comment;
};

export const deleteComment = (id: string): void => {
  saveComments(readComments().filter((c) => c.id !== id));
};
