import { preloadPatchDiff } from "@pierre/diffs/ssr";
import type { DiffTheme } from "./diff-colors";
import { getDiffUnsafeCSS } from "./diff-colors";

type DiffLayout = "split" | "stacked";
type ThemeType = "light" | "dark";

export interface PrerenderedDiffHtml {
  split: { dark: string; light: string };
  stacked: { dark: string; light: string };
}

const getPrerenderOptions = (layout: DiffLayout, themeType: ThemeType) => ({
  diffStyle: layout === "split" ? ("split" as const) : ("unified" as const),
  disableFileHeader: true,
  disableLineNumbers: false,
  enableGutterUtility: true,
  expansionLineCount: 20,
  hunkSeparators: "line-info" as const,
  lineDiffType: "word" as const,
  lineHoverHighlight: "line" as const,
  maxLineDiffLength: 500,
  overflow: "wrap" as const,
  theme: { dark: "github-dark", light: "github-light" } as const,
  themeType,
  unsafeCSS: getDiffUnsafeCSS(themeType as DiffTheme),
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
