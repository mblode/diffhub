import { performance } from "node:perf_hooks";
import { preloadPatchDiff } from "@pierre/diffs/ssr";
import type { DiffTheme } from "./diff-colors";
import { getDiffUnsafeCSS } from "./diff-colors";

type DiffLayout = "split" | "stacked";
type ThemeType = "light" | "dark";

export interface PrerenderedDiffHtml {
  split?: { dark?: string; light?: string };
  stacked?: { dark?: string; light?: string };
}

const getPrerenderOptions = (layout: DiffLayout, themeType: ThemeType) => ({
  diffStyle: layout === "split" ? ("split" as const) : ("unified" as const),
  disableFileHeader: true,
  disableLineNumbers: false,
  enableGutterUtility: true,
  expansionLineCount: 20,
  hunkSeparators: "line-info" as const,
  lineDiffType: "word-alt" as const,
  lineHoverHighlight: "disabled" as const,
  maxLineDiffLength: 500,
  overflow: "wrap" as const,
  theme: { dark: "github-dark", light: "github-light" } as const,
  themeType,
  unsafeCSS: getDiffUnsafeCSS(themeType as DiffTheme),
});

let prerenderTotalMs = 0;
let prerenderCount = 0;

// @pierre/diffs: preloadPatchDiff builds a new DiffHunksRenderer per call, but
// the Shiki highlighter itself is a module-level singleton in
// node_modules/@pierre/diffs/dist/highlighter/shared_highlighter.js:11 via
// `highlighter ??= createHighlighter(...)`. The renderer calls
// `getSharedHighlighter` (DiffHunksRenderer.js:133), so no fresh highlighter is
// spawned per file — per-call cost is tokenization + theme/language attach, not
// highlighter construction. No upstream fix needed here.
export const preloadPatchHtmlByLayout = async (patch: string): Promise<PrerenderedDiffHtml> => {
  const startedAt = performance.now();
  const [splitLight, splitDark, stackedLight, stackedDark] = await Promise.all([
    preloadPatchDiff({ options: getPrerenderOptions("split", "light"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("split", "dark"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("stacked", "light"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("stacked", "dark"), patch }),
  ]);
  prerenderTotalMs += performance.now() - startedAt;
  prerenderCount += 1;

  return {
    split: { dark: splitDark.prerenderedHTML, light: splitLight.prerenderedHTML },
    stacked: { dark: stackedDark.prerenderedHTML, light: stackedLight.prerenderedHTML },
  };
};

export const preloadSingleVariant = async (
  patch: string,
  layout: DiffLayout,
  theme: ThemeType,
): Promise<string> => {
  const startedAt = performance.now();
  const result = await preloadPatchDiff({
    options: getPrerenderOptions(layout, theme),
    patch,
  });
  prerenderTotalMs += performance.now() - startedAt;
  prerenderCount += 1;
  return result.prerenderedHTML;
};

const PRERENDER_CACHE_MAX = 500;
const prerenderCache = new Map<string, string>();
let cacheHits = 0;
let cacheMisses = 0;

const lruGet = (key: string): string | undefined => {
  const value = prerenderCache.get(key);
  if (value !== undefined) {
    prerenderCache.delete(key);
    prerenderCache.set(key, value);
    cacheHits += 1;
    return value;
  }
  cacheMisses += 1;
  return undefined;
};

const lruSet = (key: string, value: string): void => {
  if (prerenderCache.has(key)) {
    prerenderCache.delete(key);
  }
  prerenderCache.set(key, value);
  if (prerenderCache.size > PRERENDER_CACHE_MAX) {
    const oldest = prerenderCache.keys().next().value;
    if (oldest !== undefined) {
      prerenderCache.delete(oldest);
    }
  }
};

export const getOrPrerenderByReviewKey = async (
  reviewKey: string,
  patch: string,
  layout: DiffLayout,
  theme: ThemeType,
): Promise<string> => {
  const cacheKey = `${reviewKey}:${layout}:${theme}`;
  const cached = lruGet(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const html = await preloadSingleVariant(patch, layout, theme);
  lruSet(cacheKey, html);
  return html;
};

export const getAndResetPrerenderCacheStats = (): { hits: number; misses: number } => {
  const stats = { hits: cacheHits, misses: cacheMisses };
  cacheHits = 0;
  cacheMisses = 0;
  return stats;
};

export const getAndResetPrerenderTimings = (): { totalMs: number; count: number } => {
  const timings = { count: prerenderCount, totalMs: prerenderTotalMs };
  prerenderTotalMs = 0;
  prerenderCount = 0;
  return timings;
};
