import { getConfiguredRepoPath } from "@/lib/repo-path";
import { isRepoWatchDisabled, subscribeRepoChanges } from "@/lib/repo-watch";
import { WATCH_STREAM_EVENTS } from "@/lib/watch-stream";
import type { RepoWatchEvent } from "@/lib/repo-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();

const encodeSseEvent = (event: string, data: unknown): Uint8Array =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const encodeSseComment = (comment: string): Uint8Array => encoder.encode(`: ${comment}\n\n`);

export const GET = (request: Request): Response => {
  if (isRepoWatchDisabled()) {
    return new Response(null, { status: 204 });
  }

  const repoPath = getConfiguredRepoPath();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let unsubscribe: VoidFunction | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const cleanup = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    request.signal.removeEventListener("abort", cleanup);
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    unsubscribe?.();
    unsubscribe = null;
    try {
      controllerRef?.close();
    } catch {
      // The stream may already be closing because the client disconnected.
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cleanup();
    },
    start(controller) {
      controllerRef = controller;
      const send = (event: string, data: unknown): void => {
        if (closed) {
          return;
        }
        controller.enqueue(encodeSseEvent(event, data));
      };

      const sendChange = (event: RepoWatchEvent): void => {
        send(event.type === "error" ? WATCH_STREAM_EVENTS.ERROR : WATCH_STREAM_EVENTS.CHANGE, {
          createdAt: event.createdAt,
          id: event.id,
        });
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      unsubscribe = subscribeRepoChanges(repoPath, sendChange);
      send(WATCH_STREAM_EVENTS.READY, {});

      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encodeSseComment("keep-alive"));
        }
      }, HEARTBEAT_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
};
