import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let counter = 0;

type MockFn = (args: {
  patch: string;
  options?: { diffStyle?: string; themeType?: string };
}) => Promise<{ patch: string; prerenderedHTML: string }>;

vi.mock(import("@pierre/diffs/ssr"), () => ({
  preloadPatchDiff: vi.fn<MockFn>(({ patch, options }) => {
    counter += 1;
    return Promise.resolve({
      patch,
      prerenderedHTML: `html:${options?.diffStyle ?? ""}:${options?.themeType ?? ""}:${counter}`,
    });
  }),
}));

const loadModule = async () => {
  vi.resetModules();
  counter = 0;
  return await import("./diff-prerender");
};

describe("getOrPrerenderByReviewKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("caches results per (reviewKey, layout, theme) tuple independently", async () => {
    const { getOrPrerenderByReviewKey, getAndResetPrerenderCacheStats } = await loadModule();
    const { preloadPatchDiff } = await import("@pierre/diffs/ssr");
    const preloadSpy = vi.mocked(preloadPatchDiff);

    const patch = "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n";
    const reviewKey = "gen:abc";

    const splitDark1 = await getOrPrerenderByReviewKey(reviewKey, patch, "split", "dark");
    const splitDark2 = await getOrPrerenderByReviewKey(reviewKey, patch, "split", "dark");
    expect(splitDark1).toBe(splitDark2);
    expect(preloadSpy).toHaveBeenCalledOnce();

    const splitLight = await getOrPrerenderByReviewKey(reviewKey, patch, "split", "light");
    expect(splitLight).not.toBe(splitDark1);
    expect(preloadSpy).toHaveBeenCalledTimes(2);

    const stackedDark = await getOrPrerenderByReviewKey(reviewKey, patch, "stacked", "dark");
    expect(stackedDark).not.toBe(splitDark1);
    expect(stackedDark).not.toBe(splitLight);
    expect(preloadSpy).toHaveBeenCalledTimes(3);

    const stackedLight = await getOrPrerenderByReviewKey(reviewKey, patch, "stacked", "light");
    expect(stackedLight).not.toBe(stackedDark);
    expect(preloadSpy).toHaveBeenCalledTimes(4);

    const stats = getAndResetPrerenderCacheStats();
    expect(stats).toStrictEqual({ hits: 1, misses: 4 });
  });

  it("differentiates cache entries across reviewKeys", async () => {
    const { getOrPrerenderByReviewKey } = await loadModule();
    const { preloadPatchDiff } = await import("@pierre/diffs/ssr");
    const preloadSpy = vi.mocked(preloadPatchDiff);

    const patch = "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n";

    await getOrPrerenderByReviewKey("gen:a", patch, "split", "dark");
    await getOrPrerenderByReviewKey("gen:b", patch, "split", "dark");

    expect(preloadSpy).toHaveBeenCalledTimes(2);
  });
});
