import type { NextRequest } from "next/server";
import { parseDiffScope, streamDiffPatch } from "@/lib/git";

// git / child_process require the Node.js runtime.
export const runtime = "nodejs";

type WhitespaceMode = "ignore" | undefined;

const CACHE_CONTROL = "no-store";

interface TextResponseInit {
  status?: number;
}

// Centralizes the text/plain response headers shared by the streaming patch and
// the small error bodies. Diff responses are intentionally not cached so a
// watcher refresh always reflects the latest working tree.
const createTextResponse = (
  body: string | ReadableStream<Uint8Array>,
  { status = 200 }: TextResponseInit = {},
): Response =>
  new Response(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Content-Type": "text/plain; charset=utf-8",
    },
    status,
  });

// Streams the raw unified git patch (text/plain) so the client can parse and
// render files as bytes arrive instead of waiting for the full patch.
//
// Query params:
//   - mode=<scope>  → all | committed | staged | unstaged | touched
//                     (default: the server default scope when omitted)
//   - ws=ignore     → pass `-w` to git diff (ignore whitespace changes)
export const GET = async (request: NextRequest): Promise<Response> => {
  const { searchParams } = request.nextUrl;
  const base = searchParams.get("base") ?? undefined;
  const rawMode = searchParams.get("mode");
  const rawWs = searchParams.get("ws");

  const scope = rawMode === null ? undefined : (parseDiffScope(rawMode) ?? "invalid");
  if (scope === "invalid") {
    return createTextResponse(`Invalid mode parameter: ${rawMode}`, { status: 400 });
  }

  if (rawWs !== null && rawWs !== "ignore") {
    return createTextResponse(`Invalid ws parameter: ${rawWs}`, { status: 400 });
  }

  const whitespace: WhitespaceMode = rawWs === "ignore" ? "ignore" : undefined;

  try {
    const stream = await streamDiffPatch({
      base,
      scope,
      signal: request.signal,
      whitespace,
    });
    return createTextResponse(stream);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Client disconnected before the stream opened; nothing to send.
      return createTextResponse("", { status: 499 });
    }
    console.error("[diffhub] /api/diff failed", { error });
    return createTextResponse(error instanceof Error ? error.message : "Internal server error", {
      status: 500,
    });
  }
};
