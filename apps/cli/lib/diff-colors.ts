/**
 * Theme-specific color values for @pierre/diffs.
 *
 * These must be inlined (not CSS variable references) because the library
 * renders inside Shadow DOM. CSS variables defined on :root don't pierce
 * the Shadow DOM boundary, but variables set on the host element with
 * actual values do.
 *
 * Values taken verbatim from @primer/primitives@11.7.1 functional themes
 * (dist/css/functional/themes/{light,dark}.css):
 *   --fgColor-success, --fgColor-danger
 *   --diffBlob-{addition,deletion}{Line,Num,Word}-bgColor
 *   --bgColor-{success,danger}-muted
 */
export const DIFF_COLORS = {
  dark: {
    addition: "#3fb950",
    deletion: "#f85149",
  },
  light: {
    addition: "#1a7f37",
    deletion: "#d1242f",
  },
} as const;

export type DiffTheme = keyof typeof DIFF_COLORS;

const DIFF_BG_COLORS = {
  dark: {
    additionBg: "#2ea04326",
    additionBgNumber: "#3fb9504d",
    additionEmphasis: "#2ea04366",
    deletionBg: "#f851491a",
    deletionBgNumber: "#f851494d",
    deletionEmphasis: "#f8514966",
  },
  light: {
    additionBg: "#dafbe1",
    additionBgNumber: "#aceebb",
    additionEmphasis: "#aceebb",
    deletionBg: "#ffebe9",
    deletionBgNumber: "#ffcecb",
    deletionEmphasis: "#ffcecb",
  },
} as const;

/**
 * Generates the unsafeCSS string for @pierre/diffs with theme-specific colors.
 * This CSS is injected into the Shadow DOM's @layer unsafe.
 *
 * We override ALL color-related CSS variables to ensure consistent styling:
 * - Base colors (used for character-level emphasis)
 * - Line backgrounds
 * - Line number backgrounds
 * - Emphasis backgrounds (character-level diff highlights)
 */
export const getDiffUnsafeCSS = (theme: DiffTheme) => {
  const colors = DIFF_COLORS[theme];
  const bgColors = DIFF_BG_COLORS[theme];

  return `
    [data-diff-span] { border-radius: 0; }
    :host {
      /* Base colors for additions/deletions */
      --diffs-addition-color-override: ${colors.addition};
      --diffs-deletion-color-override: ${colors.deletion};

      /* Line background colors */
      --diffs-bg-addition-override: ${bgColors.additionBg};
      --diffs-bg-deletion-override: ${bgColors.deletionBg};

      /* Line number background colors */
      --diffs-bg-addition-number-override: ${bgColors.additionBgNumber};
      --diffs-bg-deletion-number-override: ${bgColors.deletionBgNumber};

      /* Character-level emphasis (inline diff highlights) */
      --diffs-bg-addition-emphasis-override: ${bgColors.additionEmphasis};
      --diffs-bg-deletion-emphasis-override: ${bgColors.deletionEmphasis};

      /* Line number text colors */
      --diffs-fg-number-addition-override: ${colors.addition};
      --diffs-fg-number-deletion-override: ${colors.deletion};
    }
  `;
};
