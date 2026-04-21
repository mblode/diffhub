import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { NextResponse } from "next/server";
import { getDiffForFile, getMultiFileDiff, isLargeDiffFile } from "@/lib/git";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";

type DiffMode = "uncommitted" | undefined;
type WhitespaceMode = "ignore" | undefined;
type DiffLayout = "split" | "stacked";
type ThemeType = "light" | "dark";

const PRERENDER_TIMEOUT_MS = 3000;
const PRERENDER_CONCURRENCY = Math.min(8, Math.max(2, cpus().length * 2));

const pLimit = async <T>(concurrency: number, tasks: (() => Promise<T>)[]): Promise<T[]> => {
  const results = Array.from({ length: tasks.length }) as T[];
  let next = 0;
  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= tasks.length) {
        return;
      }
      results[index] = await tasks[index]();
    }
  };
  const workerCount = Math.min(concurrency, tasks.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return results;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  // oxlint-disable-next-line promise/avoid-new
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const parseLayout = (value: string | null): DiffLayout =>
  value === "stacked" ? "stacked" : "split";

const parseTheme = (value: string | null): ThemeType => (value === "light" ? "light" : "dark");

interface DiffRequestContext {
  base?: string;
  file?: string;
  generation?: string;
  layout: DiffLayout;
  mode?: DiffMode;
  theme: ThemeType;
  whitespace?: WhitespaceMode;
}

const getLogContext = ({
  base,
  file,
  generation,
  layout,
  mode,
  theme,
  whitespace,
}: DiffRequestContext) => ({
  base: base ?? null,
  file: file ?? null,
  layout,
  mode: mode ?? "all",
  requestedGeneration: generation ?? null,
  theme,
  whitespace: whitespace ?? "default",
});

const wrapSingleVariant = (
  layout: DiffLayout,
  theme: ThemeType,
  html: string,
): PrerenderedDiffHtml => ({ [layout]: { [theme]: html } });

const preloadPrerenderedHtml = async ({
  file,
  layout,
  mode,
  patch,
  reviewKey,
  theme,
}: {
  file?: string;
  layout: DiffLayout;
  mode?: DiffMode;
  patch: string;
  reviewKey: string;
  theme: ThemeType;
}): Promise<PrerenderedDiffHtml | undefined> => {
  if (process.env.DIFFHUB_DISABLE_PRERENDER === "1" || !file || !patch) {
    return;
  }

  try {
    const { getOrPrerenderByReviewKey } = await import("@/lib/diff-prerender");
    const html = await withTimeout(
      getOrPrerenderByReviewKey(reviewKey, patch, layout, theme),
      PRERENDER_TIMEOUT_MS,
      `prerender ${file}`,
    );
    return wrapSingleVariant(layout, theme, html);
  } catch (error) {
    console.error("[diffhub] failed to prerender diff HTML", {
      error: error instanceof Error ? error.message : String(error),
      file,
      layout,
      mode,
      patchBytes: patch.length,
      theme,
    });
  }
};

const readPrerenderCacheStats = async (): Promise<{ hits: number; misses: number }> => {
  try {
    const { getAndResetPrerenderCacheStats } = await import("@/lib/diff-prerender");
    return getAndResetPrerenderCacheStats();
  } catch {
    return { hits: 0, misses: 0 };
  }
};

const readPrerenderTimings = async (): Promise<{ totalMs: number; count: number }> => {
  try {
    const { getAndResetPrerenderTimings } = await import("@/lib/diff-prerender");
    return getAndResetPrerenderTimings();
  } catch {
    return { count: 0, totalMs: 0 };
  }
};

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? undefined;
  const file = searchParams.get("file") ?? undefined;
  const generation = searchParams.get("generation") ?? undefined;
  const mode: DiffMode =
    searchParams.get("mode") === "uncommitted" ? ("uncommitted" as const) : undefined;
  const whitespace: WhitespaceMode =
    searchParams.get("ws") === "ignore" ? ("ignore" as const) : undefined;
  const layout = parseLayout(searchParams.get("layout"));
  const theme = parseTheme(searchParams.get("theme"));
  const startedAt = Date.now();
  const logContext = getLogContext({ base, file, generation, layout, mode, theme, whitespace });

  console.info("[diffhub] /api/diff request", logContext);

  try {
    if (file) {
      const gitStart = performance.now();
      const result = await getDiffForFile(file, base, mode, whitespace, generation);
      const gitMs = Math.round(performance.now() - gitStart);

      const prerenderStart = performance.now();
      const prerenderedHTML = await preloadPrerenderedHtml({
        file,
        layout,
        mode,
        patch: result.patch,
        reviewKey: result.reviewKey,
        theme,
      });
      const prerenderMs = Math.round(performance.now() - prerenderStart);

      const cacheStats = await readPrerenderCacheStats();
      const timings = await readPrerenderTimings();
      const prerenderAvgMs = timings.count > 0 ? Math.round(timings.totalMs / timings.count) : 0;

      const serializeStart = performance.now();
      const response = NextResponse.json({
        ...result,
        ...(prerenderedHTML ? { prerenderedHTML } : {}),
      });
      const serializeMs = Math.round(performance.now() - serializeStart);

      console.info("[diffhub] /api/diff response", {
        durationMs: Date.now() - startedAt,
        generation: result.generation,
        gitMs,
        hasPrerenderedHTML: Boolean(prerenderedHTML),
        patchLength: result.patch.length,
        prerenderAvgMs,
        prerenderCacheHits: cacheStats.hits,
        prerenderCacheMisses: cacheStats.misses,
        prerenderMs,
        serializeMs,
        splitMs: 0,
        ...logContext,
      });

      return response;
    }

    const gitStart = performance.now();
    const result = await getMultiFileDiff(base, mode, whitespace, generation);
    const gitMs = Math.round(performance.now() - gitStart);

    // Prerender every small/medium file so @pierre/diffs skips async syntax
    // highlighting on the client. WebKit has no overflow-anchor, so any
    // post-paint DOM mutation above the viewport shifts scroll position.
    let prerenderedHTMLByFile: Record<string, PrerenderedDiffHtml> | undefined;
    let prerenderFailedFileCount = 0;

    const splitStart = performance.now();
    const fileStatMap = new Map(result.files.map((s) => [s.file, s]));
    const filesToPrerender =
      process.env.DIFFHUB_DISABLE_PRERENDER === "1"
        ? []
        : Object.entries(result.patchByFile).filter(([f, patch]) => {
            if (!patch) {
              return false;
            }
            const stat = fileStatMap.get(f);
            if (stat && isLargeDiffFile(stat, patch.length)) {
              return false;
            }
            return true;
          });
    const splitMs = Math.round(performance.now() - splitStart);

    const prerenderStart = performance.now();
    if (filesToPrerender.length > 0) {
      try {
        const { getOrPrerenderByReviewKey } = await import("@/lib/diff-prerender");

        const prerenderResults = await pLimit(
          PRERENDER_CONCURRENCY,
          filesToPrerender.map(([f, patch]) => async () => {
            const reviewKey = result.reviewKeyByFile[f] ?? "";
            try {
              const html = await withTimeout(
                getOrPrerenderByReviewKey(reviewKey, patch, layout, theme),
                PRERENDER_TIMEOUT_MS,
                `prerender ${f}`,
              );
              return { file: f, html: wrapSingleVariant(layout, theme, html) };
            } catch (error) {
              console.error("[diffhub] prerender file failed", {
                error: error instanceof Error ? error.message : String(error),
                file: f,
                layout,
                patchBytes: patch.length,
                theme,
              });
              return null;
            }
          }),
        );

        prerenderFailedFileCount = prerenderResults.filter((r) => r === null).length;

        const entries = prerenderResults.filter(Boolean) as {
          file: string;
          html: PrerenderedDiffHtml;
        }[];
        if (entries.length > 0) {
          prerenderedHTMLByFile = Object.fromEntries(entries.map((e) => [e.file, e.html]));
        }
      } catch (error) {
        console.error("[diffhub] failed to prerender multi-file diff HTML", { error });
      }
    }
    const prerenderMs = Math.round(performance.now() - prerenderStart);

    const cacheStats = await readPrerenderCacheStats();
    const timings = await readPrerenderTimings();
    const prerenderAvgMs = timings.count > 0 ? Math.round(timings.totalMs / timings.count) : 0;

    const { patchByFile, reviewKeyByFile, ...payload } = result;

    const serializeStart = performance.now();
    const response = NextResponse.json({
      ...payload,
      patchesByFile: patchByFile,
      reviewKeysByFile: reviewKeyByFile,
      ...(prerenderedHTMLByFile ? { prerenderedHTMLByFile } : {}),
    });
    const serializeMs = Math.round(performance.now() - serializeStart);

    console.info("[diffhub] /api/diff response", {
      durationMs: Date.now() - startedAt,
      generation: result.generation,
      gitMs,
      hasPrerenderedHTML: Boolean(prerenderedHTMLByFile),
      patchCount: Object.keys(result.patchByFile).length,
      patchLength: null,
      prerenderAvgMs,
      prerenderCacheHits: cacheStats.hits,
      prerenderCacheMisses: cacheStats.misses,
      prerenderConcurrency: PRERENDER_CONCURRENCY,
      prerenderFailedFileCount,
      prerenderMs,
      prerenderedFileCount: prerenderedHTMLByFile ? Object.keys(prerenderedHTMLByFile).length : 0,
      serializeMs,
      splitMs,
      ...logContext,
    });

    return response;
  } catch (error) {
    console.error("[diffhub] /api/diff failed", { error, ...logContext });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
