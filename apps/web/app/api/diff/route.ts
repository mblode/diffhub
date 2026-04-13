import { NextResponse } from "next/server";
import { getDiff, getDiffForFile } from "@/lib/git";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? undefined;
  const file = searchParams.get("file") ?? undefined;
  try {
    const result = file ? await getDiffForFile(file, base) : await getDiff(base);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
