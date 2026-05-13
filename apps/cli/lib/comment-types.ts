import type { CommentSide } from "./comment-sides";

export type CommentTag = "[must-fix]" | "[suggestion]" | "[nit]" | "[question]" | "";
export type CommentStaleness = "fresh" | "moved" | "stale";

export interface CommentAnchor {
  fileSha: string;
  lineContent: string;
  beforeContext: string[];
  afterContext: string[];
  createdFromMissingFile?: boolean;
  diffHunkHeader?: string;
}

export interface CommentReply {
  body: string;
  by?: string;
  at: string;
}

export interface Comment {
  id: string;
  file: string;
  lineNumber: number;
  side: CommentSide;
  body: string;
  tag: CommentTag;
  createdAt: string;
  createdBy?: string;
  anchor: CommentAnchor;
  staleness: CommentStaleness;
  rebasedFromLine?: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: CommentReply[];
}
