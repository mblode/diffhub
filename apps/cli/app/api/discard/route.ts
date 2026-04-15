import { NextResponse } from "next/server";
import { discardFile } from "@/lib/git";

export const POST = async (request: Request) => {
  const { file } = (await request.json()) as { file?: string };
  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  try {
    await discardFile(file);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
