import { NextResponse } from "next/server";
import { addComment, deleteComment, readComments } from "@/lib/comments";
import type { CommentTag } from "@/lib/comments";

const VALID_SIDES = new Set(["left", "right"] as const);
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
  if (typeof data.lineNumber !== "number" || !Number.isFinite(data.lineNumber)) {
    return NextResponse.json({ error: "lineNumber must be a number" }, { status: 400 });
  }
  if (typeof data.body !== "string" || !data.body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (typeof data.side !== "string" || !VALID_SIDES.has(data.side as "left" | "right")) {
    return NextResponse.json({ error: "side must be 'left' or 'right'" }, { status: 400 });
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
      file: data.file,
      lineNumber: data.lineNumber,
      side: data.side as "left" | "right",
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

export const DELETE = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await deleteComment(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
