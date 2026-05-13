import { NextResponse } from "next/server";
import { parseCommentSide } from "@/lib/comment-sides";
import {
  addComment,
  addReply,
  clearComments,
  deleteComment,
  readComments,
  setCommentResolved,
} from "@/lib/comments";
import type { CommentTag } from "@/lib/comments";

const VALID_TAGS = new Set<CommentTag>(["[must-fix]", "[suggestion]", "[nit]", "[question]", ""]);

export const GET = () => {
  try {
    return NextResponse.json(readComments());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};

export const POST = async (request: Request) => {
  const data = (await request.json()) as Record<string, unknown>;

  if (typeof data.file !== "string" || !data.file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (
    typeof data.lineNumber !== "number" ||
    !Number.isFinite(data.lineNumber) ||
    !Number.isInteger(data.lineNumber) ||
    data.lineNumber < 1
  ) {
    return NextResponse.json({ error: "lineNumber must be a positive integer" }, { status: 400 });
  }
  if (typeof data.body !== "string" || !data.body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const side = parseCommentSide(data.side);
  if (side === null) {
    return NextResponse.json(
      { error: "side must be 'left', 'right', 'deletions', or 'additions'" },
      { status: 400 },
    );
  }
  if (data.tag !== undefined && typeof data.tag !== "string") {
    return NextResponse.json({ error: "invalid tag" }, { status: 400 });
  }
  if (!VALID_TAGS.has((data.tag ?? "") as CommentTag)) {
    return NextResponse.json({ error: "invalid tag" }, { status: 400 });
  }

  try {
    const comment = await addComment({
      body: data.body,
      createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
      diffHunkHeader: typeof data.diffHunkHeader === "string" ? data.diffHunkHeader : undefined,
      file: data.file,
      lineNumber: data.lineNumber,
      side,
      tag: (data.tag ?? "") as CommentTag,
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};

export const PATCH = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const data = (await request.json()) as Record<string, unknown>;
  const { action } = data;

  try {
    if (action === "resolve" || action === "unresolve") {
      const comment = await setCommentResolved(id, action === "resolve");
      if (!comment) {
        return NextResponse.json({ error: "comment not found" }, { status: 404 });
      }
      return NextResponse.json(comment);
    }

    if (action === "reply") {
      if (typeof data.body !== "string" || !data.body.trim()) {
        return NextResponse.json({ error: "body is required" }, { status: 400 });
      }
      const comment = await addReply(id, data.body.trim());
      if (!comment) {
        return NextResponse.json({ error: "comment not found" }, { status: 404 });
      }
      return NextResponse.json(comment);
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};

export const DELETE = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const clearAll = searchParams.get("all") === "1";
  const id = searchParams.get("id");
  if (!clearAll && !id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    if (clearAll) {
      await clearComments();
    } else if (id) {
      await deleteComment(id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
