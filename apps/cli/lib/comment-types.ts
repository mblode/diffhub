import type { CommentSide } from "./comment-sides";

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
