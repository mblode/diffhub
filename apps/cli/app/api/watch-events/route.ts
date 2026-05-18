import { NextResponse } from "next/server";
import { getConfiguredRepoPath } from "@/lib/repo-path";
import { publishExternalRepoChange } from "@/lib/repo-watch";
import type { RepoWatchFsEvent } from "@/lib/repo-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WATCH_EVENTS = new Set<RepoWatchFsEvent>(["add", "addDir", "change", "unlink", "unlinkDir"]);

interface WatchEventPayload {
  event?: unknown;
  path?: unknown;
}

const readPayload = async (request: Request): Promise<WatchEventPayload> => {
  try {
    const payload = (await request.json()) as WatchEventPayload;
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
};

const getWatchEvent = (value: unknown): RepoWatchFsEvent =>
  typeof value === "string" && WATCH_EVENTS.has(value as RepoWatchFsEvent)
    ? (value as RepoWatchFsEvent)
    : "change";

export const POST = async (request: Request): Promise<Response> => {
  if (process.env.DIFFHUB_EXTERNAL_WATCHER !== "1") {
    return NextResponse.json({ error: "External watcher is not enabled" }, { status: 404 });
  }

  const expectedToken = process.env.DIFFHUB_WATCH_TOKEN;
  const providedToken = request.headers.get("x-diffhub-watch-token");
  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await readPayload(request);
  publishExternalRepoChange(getConfiguredRepoPath(), {
    event: getWatchEvent(payload.event),
    path: typeof payload.path === "string" ? payload.path : null,
  });

  return NextResponse.json({ ok: true });
};
