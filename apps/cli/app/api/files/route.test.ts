import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffScope } from "@/lib/git";

interface DiffStatsPayload {
  baseBranch: string;
  branch: string;
  deletions: number;
  files: [];
  fingerprint: string;
  generation: string;
  insertions: number;
}

const gitMock = vi.hoisted(() => ({
  getDiffStats: vi.fn<() => Promise<DiffStatsPayload>>(() =>
    Promise.resolve({
      baseBranch: "origin/main",
      branch: "feature/live-watch",
      deletions: 0,
      files: [],
      fingerprint: "fingerprint-1",
      generation: "generation-1",
      insertions: 0,
    }),
  ),
  invalidateGitCache: vi.fn<() => void>(),
}));

const DIFF_SCOPES = new Set(["all", "committed", "staged", "unstaged", "touched"]);

vi.mock(import("@/lib/git"), () => ({
  getDiffStats: gitMock.getDiffStats,
  invalidateGitCache: gitMock.invalidateGitCache,
  parseDiffScope: (value: string | null | undefined): DiffScope | null =>
    value !== null && value !== undefined && DIFF_SCOPES.has(value) ? (value as DiffScope) : null,
}));

describe("/api/files", () => {
  beforeEach(() => {
    gitMock.getDiffStats.mockClear();
    gitMock.invalidateGitCache.mockClear();
  });

  it("returns diff stats without invalidating cache by default", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/files"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generation).toBe("generation-1");
    expect(gitMock.invalidateGitCache).not.toHaveBeenCalled();
    expect(gitMock.getDiffStats).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it("invalidates cache when refresh is requested", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/files?refresh=1"));

    expect(response.status).toBe(200);
    expect(gitMock.invalidateGitCache).toHaveBeenCalledOnce();
    expect(gitMock.getDiffStats).toHaveBeenCalledWith(undefined, undefined, undefined);
  });
});
