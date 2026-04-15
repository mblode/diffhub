import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isCommentSide } from "./comment-sides";
import { getGitDirectory } from "./git-paths";
import { getConfiguredRepoPath } from "./repo-path";
import type { CommentSide } from "./comment-sides";

const COMMENTS_FILENAME = "diffhub-comments.json";
let mutationQueue = Promise.resolve(null);

const getCommentsPath = (): string =>
  join(getGitDirectory(getConfiguredRepoPath()), COMMENTS_FILENAME);

export type CommentTag = "[must-fix]" | "[suggestion]" | "[nit]" | "[question]" | "";

export interface Comment {
  id: string;
  file: string;
  lineNumber: number;
  side: CommentSide;
  body: string;
  tag: CommentTag;
  createdAt: string;
}

const isCommentTag = (value: unknown): value is CommentTag =>
  value === "" ||
  value === "[must-fix]" ||
  value === "[suggestion]" ||
  value === "[nit]" ||
  value === "[question]";

const isComment = (value: unknown): value is Comment => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const comment = value as Record<string, unknown>;
  return (
    typeof comment.body === "string" &&
    typeof comment.createdAt === "string" &&
    typeof comment.file === "string" &&
    typeof comment.id === "string" &&
    typeof comment.lineNumber === "number" &&
    isCommentSide(comment.side) &&
    isCommentTag(comment.tag)
  );
};

export const readComments = (): Comment[] => {
  const path = getCommentsPath();
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!Array.isArray(parsed) || parsed.some((comment) => !isComment(comment))) {
    throw new Error("Comment store is corrupted");
  }

  return parsed;
};

const saveComments = (comments: Comment[]): void => {
  const path = getCommentsPath();
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, JSON.stringify(comments, null, 2));
  renameSync(tempPath, path);
};

const mutateComments = <T>(updater: (comments: Comment[]) => T): Promise<T> => {
  const runUpdate = (): T => {
    const comments = readComments();
    const result = updater(comments);
    saveComments(comments);
    return result;
  };

  // oxlint-disable-next-line promise/prefer-await-to-then
  const nextMutation = mutationQueue.then(runUpdate, runUpdate);
  // oxlint-disable-next-line promise/prefer-await-to-then
  mutationQueue = nextMutation.then(
    () => null,
    () => null,
  );
  return nextMutation;
};

export const addComment = (data: Omit<Comment, "id" | "createdAt">): Promise<Comment> =>
  mutateComments((comments) => {
    const comment: Comment = {
      ...data,
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
    };
    comments.push(comment);
    return comment;
  });

export const deleteComment = (id: string): Promise<void> =>
  mutateComments((comments) => {
    const index = comments.findIndex((comment) => comment.id === id);
    if (index !== -1) {
      comments.splice(index, 1);
    }
  });
