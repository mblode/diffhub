import { preloadPatchDiff } from "@pierre/diffs/ssr";

export type DiffLayout = "split" | "stacked";
export type ThemeType = "light" | "dark";

export interface PrerenderedDiffHtml {
  split: { dark: string; light: string };
  stacked: { dark: string; light: string };
}

const getPrerenderOptions = (layout: DiffLayout, themeType: ThemeType) => ({
  diffStyle: layout === "split" ? ("split" as const) : ("unified" as const),
  disableFileHeader: true,
  disableLineNumbers: false,
  expansionLineCount: 20,
  hunkSeparators: "line-info" as const,
  lineDiffType: "char" as const,
  maxLineDiffLength: 500,
  overflow: "scroll" as const,
  theme: { dark: "github-dark", light: "github-light" } as const,
  themeType,
  unsafeCSS: `[data-diff-span] { border-radius: 0; }`,
});

export const preloadPatchHtmlByLayout = async (patch: string): Promise<PrerenderedDiffHtml> => {
  const [splitLight, splitDark, stackedLight, stackedDark] = await Promise.all([
    preloadPatchDiff({ options: getPrerenderOptions("split", "light"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("split", "dark"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("stacked", "light"), patch }),
    preloadPatchDiff({ options: getPrerenderOptions("stacked", "dark"), patch }),
  ]);

  return {
    split: { dark: splitDark.prerenderedHTML, light: splitLight.prerenderedHTML },
    stacked: { dark: stackedDark.prerenderedHTML, light: stackedLight.prerenderedHTML },
  };
};
