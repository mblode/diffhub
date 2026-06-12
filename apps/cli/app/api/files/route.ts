import { NextResponse } from "next/server";
import { getDiffStats, invalidateGitCache, parseDiffScope } from "@/lib/git";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? undefined;
  const scope = parseDiffScope(searchParams.get("mode")) ?? undefined;
  const whitespace = searchParams.get("ws") === "ignore" ? ("ignore" as const) : undefined;
  const shouldRefresh = searchParams.get("refresh") === "1";
  try {
    if (shouldRefresh) {
      invalidateGitCache();
    }
    const result = await getDiffStats(base, scope, whitespace);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
