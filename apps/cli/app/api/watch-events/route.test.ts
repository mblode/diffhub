import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoWatchFsEvent } from "@/lib/repo-watch";

const repoPathMock = vi.hoisted(() => ({
  repoPath: "/tmp/diffhub-watch-events-route-repo",
}));

const watchMock = vi.hoisted(() => ({
  publishExternalRepoChange:
    vi.fn<(repoPath: string, change?: { event: RepoWatchFsEvent; path: string | null }) => void>(),
}));

vi.mock(import("@/lib/repo-path"), () => ({
  getConfiguredRepoPath: () => repoPathMock.repoPath,
}));

vi.mock(import("@/lib/repo-watch"), () => ({
  publishExternalRepoChange: watchMock.publishExternalRepoChange,
}));

const originalEnv = {
  DIFFHUB_EXTERNAL_WATCHER: process.env.DIFFHUB_EXTERNAL_WATCHER,
  DIFFHUB_WATCH_TOKEN: process.env.DIFFHUB_WATCH_TOKEN,
};

describe("/api/watch-events", () => {
  beforeEach(() => {
    process.env.DIFFHUB_EXTERNAL_WATCHER = "1";
    process.env.DIFFHUB_WATCH_TOKEN = "test-token";
    watchMock.publishExternalRepoChange.mockClear();
  });

  afterEach(() => {
    if (originalEnv.DIFFHUB_EXTERNAL_WATCHER === undefined) {
      delete process.env.DIFFHUB_EXTERNAL_WATCHER;
    } else {
      process.env.DIFFHUB_EXTERNAL_WATCHER = originalEnv.DIFFHUB_EXTERNAL_WATCHER;
    }
    if (originalEnv.DIFFHUB_WATCH_TOKEN === undefined) {
      delete process.env.DIFFHUB_WATCH_TOKEN;
    } else {
      process.env.DIFFHUB_WATCH_TOKEN = originalEnv.DIFFHUB_WATCH_TOKEN;
    }
    vi.restoreAllMocks();
  });

  it("publishes authenticated external watch events", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/watch-events", {
        body: JSON.stringify({ event: "unlink", path: "/tmp/repo/src/a.ts" }),
        headers: {
          "content-type": "application/json",
          "x-diffhub-watch-token": "test-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(watchMock.publishExternalRepoChange).toHaveBeenCalledExactlyOnceWith(
      repoPathMock.repoPath,
      {
        event: "unlink",
        path: "/tmp/repo/src/a.ts",
      },
    );
  });

  it("rejects unauthenticated watch events", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/watch-events", {
        body: JSON.stringify({ event: "change" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(watchMock.publishExternalRepoChange).not.toHaveBeenCalled();
  });

  it("is unavailable unless the external watcher mode is enabled", async () => {
    delete process.env.DIFFHUB_EXTERNAL_WATCHER;
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/watch-events", {
        headers: {
          "x-diffhub-watch-token": "test-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect(watchMock.publishExternalRepoChange).not.toHaveBeenCalled();
  });
});
