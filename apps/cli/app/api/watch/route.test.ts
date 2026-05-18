import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WATCH_STREAM_EVENTS } from "@/lib/watch-stream";
import type { RepoWatchEvent, RepoWatchListener } from "@/lib/repo-watch";

const repoPathMock = vi.hoisted(() => ({
  repoPath: "/tmp/diffhub-watch-route-repo",
}));

const watchMock = vi.hoisted(() => {
  const listeners = new Set<RepoWatchListener>();

  const state = {
    emit(event: RepoWatchEvent) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    isRepoWatchDisabled: vi.fn<() => boolean>(() => false),
    listeners,
    reset() {
      listeners.clear();
      state.isRepoWatchDisabled.mockReset();
      state.isRepoWatchDisabled.mockReturnValue(false);
      state.subscribeRepoChanges.mockClear();
      state.unsubscribe.mockClear();
    },
    subscribeRepoChanges: vi.fn<(repoPath: string, listener: RepoWatchListener) => VoidFunction>(
      (_repoPath: string, listener: RepoWatchListener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          state.unsubscribe();
        };
      },
    ),
    unsubscribe: vi.fn<() => void>(),
  };
  return state;
});

vi.mock(import("@/lib/repo-path"), () => ({
  getConfiguredRepoPath: () => repoPathMock.repoPath,
}));

vi.mock(import("@/lib/repo-watch"), () => ({
  isRepoWatchDisabled: watchMock.isRepoWatchDisabled,
  subscribeRepoChanges: watchMock.subscribeRepoChanges,
}));

const readChunk = async (response: Response): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Missing response body");
  }

  const { value } = await reader.read();
  await reader.cancel();
  return new TextDecoder().decode(value);
};

describe("/api/watch", () => {
  beforeEach(() => {
    watchMock.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an event-stream response and sends a ready event", async () => {
    const { GET } = await import("./route");
    const response = GET(new Request("http://localhost/api/watch"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
    await expect(readChunk(response)).resolves.toContain(`event: ${WATCH_STREAM_EVENTS.READY}`);
    expect(watchMock.subscribeRepoChanges).toHaveBeenCalledWith(
      repoPathMock.repoPath,
      expect.any(Function),
    );
  });

  it("sends change events from the repo watcher", async () => {
    const { GET } = await import("./route");
    const response = GET(new Request("http://localhost/api/watch"));
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Missing response body");
    }

    await reader.read();
    watchMock.emit({
      createdAt: "2026-05-18T00:00:00.000Z",
      event: "change",
      id: 1,
      path: "/tmp/repo/src/a.ts",
      repoPath: repoPathMock.repoPath,
      type: "change",
    });

    const { value } = await reader.read();
    await reader.cancel();
    const text = new TextDecoder().decode(value);

    expect(text).toContain(`event: ${WATCH_STREAM_EVENTS.CHANGE}`);
    expect(text).toContain('"id":1');
    expect(text).not.toContain(repoPathMock.repoPath);
    expect(text).not.toContain("/tmp/repo/src/a.ts");
  });

  it("unsubscribes when the request aborts", async () => {
    const { GET } = await import("./route");
    const controller = new AbortController();

    GET(new Request("http://localhost/api/watch", { signal: controller.signal }));
    controller.abort();
    await Promise.resolve();

    expect(watchMock.unsubscribe).toHaveBeenCalledOnce();
    expect(watchMock.listeners.size).toBe(0);
  });

  it("does not open a stream when watching is disabled", async () => {
    watchMock.isRepoWatchDisabled.mockReturnValue(true);
    const { GET } = await import("./route");

    const response = GET(new Request("http://localhost/api/watch"));

    expect(response.status).toBe(204);
    expect(watchMock.subscribeRepoChanges).not.toHaveBeenCalled();
  });
});
