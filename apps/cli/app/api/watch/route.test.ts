import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { watchSnapshotRef, waitForFileWatchMock } = vi.hoisted(() => ({
  waitForFileWatchMock: vi.fn<() => Promise<"change" | "timeout">>(() =>
    Promise.resolve("timeout"),
  ),
  watchSnapshotRef: { current: { changedAt: 0, revision: 2 } },
}));

vi.mock(import("@/lib/file-watch"), () => ({
  ensureFileWatch: vi.fn<() => void>(),
  getFileWatchSnapshot: () => watchSnapshotRef.current,
  waitForFileWatch: waitForFileWatchMock,
}));

describe("/api/watch", () => {
  beforeEach(() => {
    watchSnapshotRef.current = { changedAt: 0, revision: 2 };
    waitForFileWatchMock.mockClear();
  });

  it("marks mismatched requested revisions as changed", async () => {
    const response = await GET(new Request("http://localhost/api/watch?revision=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      changed: true,
      changedAt: 0,
      ok: true,
      revision: 2,
    });
    expect(waitForFileWatchMock).not.toHaveBeenCalled();
  });

  it("does not mark the initial revision snapshot as changed", async () => {
    const response = await GET(new Request("http://localhost/api/watch"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      changed: false,
      changedAt: 0,
      ok: true,
      revision: 2,
    });
  });
});
