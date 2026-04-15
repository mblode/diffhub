/**
 * Theme-specific color values for @pierre/diffs.
 *
 * These must be inlined (not CSS variable references) because the library
 * renders inside Shadow DOM. CSS variables defined on :root don't pierce
 * the Shadow DOM boundary, but variables set on the host element with
 * actual values do.
 *
 * Values match globals.css:
 * - Light: --diff-green = oklch(0.696 0.17 145), --destructive = oklch(0.577 0.245 27.325)
 * - Dark:  --diff-green = oklch(0.696 0.15 145), --destructive = oklch(0.704 0.191 22.216)
 */
export const DIFF_COLORS = {
  dark: {
    addition: "oklch(0.696 0.15 145)",
    deletion: "oklch(0.704 0.191 22.216)",
  },
  light: {
    addition: "oklch(0.696 0.17 145)",
    deletion: "oklch(0.577 0.245 27.325)",
  },
} as const;

export type DiffTheme = keyof typeof DIFF_COLORS;

/**
 * Pre-computed background colors with appropriate opacity for each theme.
 * These are derived from the base colors with transparency applied.
 *
 * We use color-mix() which is widely supported (Chrome 111+, Firefox 113+, Safari 16.2+)
 * instead of the newer relative color syntax (rgb from) which has limited support.
 */
const DIFF_BG_COLORS = {
  dark: {
    // Addition: oklch(0.696 0.15 145) ≈ #4ade80 (green)
    additionBg: "rgba(74, 222, 128, 0.12)",
    additionBgNumber: "rgba(74, 222, 128, 0.18)",
    additionEmphasis: "rgba(74, 222, 128, 0.25)",
    // Deletion: oklch(0.704 0.191 22.216) ≈ #f87171 (red)
    deletionBg: "rgba(248, 113, 113, 0.12)",
    deletionBgNumber: "rgba(248, 113, 113, 0.18)",
    deletionEmphasis: "rgba(248, 113, 113, 0.25)",
  },
  light: {
    // Addition: oklch(0.696 0.17 145) ≈ #22c55e (green)
    additionBg: "rgba(34, 197, 94, 0.08)",
    additionBgNumber: "rgba(34, 197, 94, 0.12)",
    additionEmphasis: "rgba(34, 197, 94, 0.20)",
    // Deletion: oklch(0.577 0.245 27.325) ≈ #ef4444 (red)
    deletionBg: "rgba(239, 68, 68, 0.08)",
    deletionBgNumber: "rgba(239, 68, 68, 0.12)",
    deletionEmphasis: "rgba(239, 68, 68, 0.20)",
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
 * - Hover states
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

      /* Hover states */
      --diffs-bg-addition-hover-override: ${bgColors.additionEmphasis};
      --diffs-bg-deletion-hover-override: ${bgColors.deletionEmphasis};

      /* Line number text colors */
      --diffs-fg-number-addition-override: ${colors.addition};
      --diffs-fg-number-deletion-override: ${colors.deletion};
    }
  `;
};
