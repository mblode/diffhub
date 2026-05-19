import { NextResponse } from "next/server";
import { parseCommentSide } from "@/lib/comment-sides";
import {
  addComment,
  addReply,
  clearComments,
  deleteComment,
  importComments,
  readComments,
  setCommentResolved,
} from "@/lib/comments";
import type { CommentTag } from "@/lib/comments";

const VALID_TAGS = new Set<CommentTag>(["[must-fix]", "[suggestion]", "[nit]", "[question]", ""]);

interface ParsedCommentPayload {
  body: string;
  createdBy?: string;
  diffHunkHeader?: string;
  externalId?: string;
  file: string;
  lineNumber: number;
  side: "left" | "right";
  tag: CommentTag;
}

type ParseResult =
  | { ok: true; value: ParsedCommentPayload }
  | { error: string; ok: false; status: number };

const parseCommentPayload = (data: Record<string, unknown>, prefix = ""): ParseResult => {
  const field = (name: string) => (prefix ? `${prefix}.${name}` : name);

  if (typeof data.file !== "string" || !data.file) {
    return { error: `${field("file")} is required`, ok: false, status: 400 };
  }
  if (
    typeof data.lineNumber !== "number" ||
    !Number.isFinite(data.lineNumber) ||
    !Number.isInteger(data.lineNumber) ||
    data.lineNumber < 1
  ) {
    return {
      error: `${field("lineNumber")} must be a positive integer`,
      ok: false,
      status: 400,
    };
  }
  if (typeof data.body !== "string" || !data.body) {
    return { error: `${field("body")} is required`, ok: false, status: 400 };
  }
  const side = parseCommentSide(data.side);
  if (side === null) {
    return {
      error: `${field("side")} must be 'left', 'right', 'deletions', or 'additions'`,
      ok: false,
      status: 400,
    };
  }
  if (data.tag !== undefined && typeof data.tag !== "string") {
    return { error: `${field("tag")} is invalid`, ok: false, status: 400 };
  }
  if (!VALID_TAGS.has((data.tag ?? "") as CommentTag)) {
    return { error: `${field("tag")} is invalid`, ok: false, status: 400 };
  }
  if (data.createdBy !== undefined && typeof data.createdBy !== "string") {
    return { error: `${field("createdBy")} is invalid`, ok: false, status: 400 };
  }
  if (data.diffHunkHeader !== undefined && typeof data.diffHunkHeader !== "string") {
    return { error: `${field("diffHunkHeader")} is invalid`, ok: false, status: 400 };
  }
  if (data.externalId !== undefined && typeof data.externalId !== "string") {
    return { error: `${field("externalId")} is invalid`, ok: false, status: 400 };
  }

  return {
    ok: true,
    value: {
      body: data.body,
      createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
      diffHunkHeader: typeof data.diffHunkHeader === "string" ? data.diffHunkHeader : undefined,
      externalId: typeof data.externalId === "string" ? data.externalId : undefined,
      file: data.file,
      lineNumber: data.lineNumber,
      side,
      tag: (data.tag ?? "") as CommentTag,
    },
  };
};

export const GET = (request?: Request) => {
  try {
    const readOnly =
      request === undefined ? false : new URL(request.url).searchParams.get("readonly") === "1";
    return NextResponse.json(readComments({ persistChanges: !readOnly }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};

export const POST = async (request: Request) => {
  const data = (await request.json()) as Record<string, unknown>;

  if (Array.isArray(data.comments)) {
    const parsedComments: ParsedCommentPayload[] = [];
    for (let index = 0; index < data.comments.length; index += 1) {
      const rawComment = data.comments[index];
      if (typeof rawComment !== "object" || rawComment === null || Array.isArray(rawComment)) {
        return NextResponse.json(
          { error: `comments[${index}] must be an object` },
          { status: 400 },
        );
      }
      const parsed = parseCommentPayload(
        rawComment as Record<string, unknown>,
        `comments[${index}]`,
      );
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }
      parsedComments.push(parsed.value);
    }

    try {
      const result = await importComments(parsedComments);
      return NextResponse.json(
        {
          comments: result.comments,
          created: result.created.length,
          existing: result.existing.length,
        },
        { status: result.created.length > 0 ? 201 : 200 },
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      );
    }
  }

  const parsed = parseCommentPayload(data);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const comment = await addComment(parsed.value);
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
