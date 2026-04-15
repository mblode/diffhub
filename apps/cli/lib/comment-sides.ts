import type { AnnotationSide } from "@pierre/diffs";

export type CommentSide = "left" | "right";

export const isCommentSide = (value: unknown): value is CommentSide =>
  value === "left" || value === "right";

export const parseCommentSide = (value: unknown): CommentSide | null => {
  if (isCommentSide(value)) {
    return value;
  }

  if (value === "deletions") {
    return "left";
  }

  if (value === "additions") {
    return "right";
  }

  return null;
};

export const toCommentSide = (side: AnnotationSide): CommentSide =>
  side === "deletions" ? "left" : "right";

export const toAnnotationSide = (side: CommentSide): AnnotationSide =>
  side === "left" ? "deletions" : "additions";
