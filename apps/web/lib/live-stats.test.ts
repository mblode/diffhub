import { cacheLife } from "next/cache";
import { afterEach, expect, test, vi } from "vitest";

import { fetchGithubStars, fetchNpmWeeklyDownloads } from "./live-stats";

// `cacheLife` only runs inside a Next "use cache" scope; here the directive is
// an inert string, so record the profile each call picks instead.
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const respond = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(Response.json(body, { status })));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(cacheLife).mockClear();
});

test("reads stars and weekly downloads, cached for a day", async () => {
  const github = respond({ stargazers_count: 24 });
  vi.stubGlobal("fetch", github);
  expect(await fetchGithubStars("mblode/diffhub")).toBe(24);
  expect(github).toHaveBeenCalledWith(
    "https://api.github.com/repos/mblode/diffhub",
    expect.objectContaining({ next: { revalidate: 86_400 } }),
  );

  vi.stubGlobal("fetch", respond({ downloads: 22, package: "diffhub" }));
  expect(await fetchNpmWeeklyDownloads("diffhub")).toBe(22);
  expect(cacheLife).toHaveBeenCalledWith("days");
  expect(cacheLife).not.toHaveBeenCalledWith("minutes");
});

test("fails closed on errors, bad status and bad shapes", async () => {
  vi.stubGlobal("fetch", respond({ message: "rate limited" }, 403));
  expect(await fetchGithubStars("mblode/diffhub")).toBeNull();

  vi.stubGlobal("fetch", respond({ downloads: "22" }));
  expect(await fetchNpmWeeklyDownloads("diffhub")).toBeNull();

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline"))),
  );
  expect(await fetchGithubStars("mblode/diffhub")).toBeNull();
  expect(await fetchNpmWeeklyDownloads("diffhub")).toBeNull();
  // A failure is retried within minutes rather than pinned for a day.
  expect(cacheLife).toHaveBeenCalledWith("minutes");
  expect(cacheLife).not.toHaveBeenCalledWith("days");
});
