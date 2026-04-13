import { NextResponse } from "next/server";
import { getDiff, getDiffForFile } from "@/lib/git";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? undefined;
  const file = searchParams.get("file") ?? undefined;
  const mode = searchParams.get("mode") === "uncommitted" ? ("uncommitted" as const) : undefined;
  try {
    const result = file ? await getDiffForFile(file, base, mode) : await getDiff(base, mode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
};
