import type { NextRequest } from "next/server";
import { fetchPrDiff, parseRepoParams } from "@/lib/github";

export const runtime = "nodejs";

const textResponse = (body: string, status: number): Response =>
  new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status,
  });

// Streams a GitHub PR's raw unified diff (text/plain) so the client viewer can
// parse and render files as the patch arrives. The browser only ever calls this
// same-origin route; GitHub is reached server-side with Next's data cache.
export const GET = async (request: NextRequest): Promise<Response> => {
  const { searchParams } = request.nextUrl;
  const params = parseRepoParams({
    number: searchParams.get("number") ?? "",
    owner: searchParams.get("owner") ?? "",
    repo: searchParams.get("repo") ?? "",
  });

  if (params === null) {
    return textResponse("Invalid repository or pull request reference.", 400);
  }

  try {
    const result = await fetchPrDiff(params);
    if (!result.ok) {
      return textResponse(result.error.message, result.error.status === 404 ? 404 : 502);
    }
    return textResponse(result.diff, 200);
  } catch (error) {
    console.error("[diffhub] /api/github-diff failed", { error });
    return textResponse("Failed to load this diff.", 502);
  }
};
