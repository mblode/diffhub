import { preloadPatchDiff } from "@pierre/diffs/ssr";

export type DiffLayout = "split" | "stacked";

export interface PrerenderedDiffHtml {
  split: string;
  stacked: string;
}

const getPrerenderOptions = (layout: DiffLayout) => ({
  diffStyle: layout === "split" ? ("split" as const) : ("unified" as const),
  disableFileHeader: true,
  disableLineNumbers: false,
  expansionLineCount: 20,
  hunkSeparators: "line-info" as const,
  lineDiffType: "char" as const,
  maxLineDiffLength: 500,
  overflow: "scroll" as const,
  theme: { dark: "github-dark", light: "github-light" } as const,
  unsafeCSS: `[data-diff-span] { border-radius: 0; }`,
});

export const preloadPatchHtmlByLayout = async (patch: string): Promise<PrerenderedDiffHtml> => {
  const [split, stacked] = await Promise.all([
    preloadPatchDiff({ options: getPrerenderOptions("split"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("stacked"), patch }),
  ]);

  return {
    split: split.prerenderedHTML,
    stacked: stacked.prerenderedHTML,
  };
};
