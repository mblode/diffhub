import { NextResponse } from "next/server";
import { getDiffForFile, getMultiFileDiff, isLargeDiffFile } from "@/lib/git";
import type { PrerenderedDiffHtml } from "@/lib/diff-prerender";

type DiffMode = "uncommitted" | undefined;
type WhitespaceMode = "ignore" | undefined;

const PRERENDER_TIMEOUT_MS = 3000;

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

interface DiffRequestContext {
  base?: string;
  file?: string;
  generation?: string;
  mode?: DiffMode;
  whitespace?: WhitespaceMode;
}

const getLogContext = ({ base, file, generation, mode, whitespace }: DiffRequestContext) => ({
  base: base ?? null,
  file: file ?? null,
  mode: mode ?? "all",
  requestedGeneration: generation ?? null,
  whitespace: whitespace ?? "default",
});

const preloadPrerenderedHtml = async ({
  file,
  mode,
  patch,
}: {
  file?: string;
  mode?: DiffMode;
  patch: string;
}) => {
  if (process.env.DIFFHUB_DISABLE_PRERENDER === "1" || !file || !patch) {
    return;
  }

  try {
    const { preloadPatchHtmlByLayout } = await import("@/lib/diff-prerender");
    return await withTimeout(
      preloadPatchHtmlByLayout(patch),
      PRERENDER_TIMEOUT_MS,
      `prerender ${file}`,
    );
  } catch (error) {
    console.error("[diffhub] failed to prerender diff HTML", {
      error: error instanceof Error ? error.message : String(error),
      file,
      mode,
      patchBytes: patch.length,
    });
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
  const startedAt = Date.now();
  const logContext = getLogContext({ base, file, generation, mode, whitespace });

  console.info("[diffhub] /api/diff request", logContext);

  try {
    if (file) {
      const result = await getDiffForFile(file, base, mode, whitespace, generation);
      const prerenderedHTML = await preloadPrerenderedHtml({ file, mode, patch: result.patch });

      console.info("[diffhub] /api/diff response", {
        durationMs: Date.now() - startedAt,
        generation: result.generation,
        hasPrerenderedHTML: Boolean(prerenderedHTML),
        patchLength: result.patch.length,
        ...logContext,
      });

      return NextResponse.json({
        ...result,
        ...(prerenderedHTML ? { prerenderedHTML } : {}),
      });
    }

    const result = await getMultiFileDiff(base, mode, whitespace, generation);

    // Prerender the first few files for instant display
    const MAX_PRERENDER_FILES = 4;
    let prerenderedHTMLByFile: Record<string, PrerenderedDiffHtml> | undefined;
    let prerenderFailedFileCount = 0;

    if (process.env.DIFFHUB_DISABLE_PRERENDER !== "1") {
      try {
        const { preloadPatchHtmlByLayout } = await import("@/lib/diff-prerender");
        const fileStatMap = new Map(result.files.map((s) => [s.file, s]));
        const filesToPrerender = Object.entries(result.patchByFile)
          .filter(([f, patch]) => {
            if (!patch) {
              return false;
            }
            const stat = fileStatMap.get(f);
            if (stat && isLargeDiffFile(stat, patch.length)) {
              return false;
            }
            return true;
          })
          .slice(0, MAX_PRERENDER_FILES);

        const prerenderResults = await Promise.all(
          filesToPrerender.map(async ([f, patch]) => {
            try {
              const html = await withTimeout(
                preloadPatchHtmlByLayout(patch),
                PRERENDER_TIMEOUT_MS,
                `prerender ${f}`,
              );
              return { file: f, html };
            } catch (error) {
              console.error("[diffhub] prerender file failed", {
                error: error instanceof Error ? error.message : String(error),
                file: f,
                patchBytes: patch.length,
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

    console.info("[diffhub] /api/diff response", {
      durationMs: Date.now() - startedAt,
      generation: result.generation,
      hasPrerenderedHTML: Boolean(prerenderedHTMLByFile),
      patchCount: Object.keys(result.patchByFile).length,
      patchLength: null,
      prerenderFailedFileCount,
      prerenderedFileCount: prerenderedHTMLByFile ? Object.keys(prerenderedHTMLByFile).length : 0,
      ...logContext,
    });

    const { patchByFile, reviewKeyByFile, ...payload } = result;

    return NextResponse.json({
      ...payload,
      patchesByFile: patchByFile,
      reviewKeysByFile: reviewKeyByFile,
      ...(prerenderedHTMLByFile ? { prerenderedHTMLByFile } : {}),
    });
  } catch (error) {
    console.error("[diffhub] /api/diff failed", { error, ...logContext });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
