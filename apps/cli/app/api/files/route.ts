import { NextResponse } from "next/server";
import { getDiffStats } from "@/lib/git";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? undefined;
  const mode = searchParams.get("mode") === "uncommitted" ? ("uncommitted" as const) : undefined;
  const whitespace = searchParams.get("ws") === "ignore" ? ("ignore" as const) : undefined;
  try {
    const result = await getDiffStats(base, mode, whitespace);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
