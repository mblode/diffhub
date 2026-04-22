import { describe, expect, it } from "vitest";
import { getDiffUnsafeCSS } from "./diff-colors";

const extractVar = (css: string, name: string): string => {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`CSS variable ${name} not found`);
  }
  return match[1].trim();
};

// Reference values from @primer/primitives@11.7.1
// dist/css/functional/themes/{light,dark}.css. These back the rendered
// diff emphasis/line/num backgrounds. Pinning here means a theme refactor
// can't silently drift off GitHub Primer.
const PRIMER = {
  dark: {
    "--diffs-bg-addition-emphasis-override": "#2ea04366",
    "--diffs-bg-addition-number-override": "#3fb9504d",
    "--diffs-bg-addition-override": "#2ea04326",
    "--diffs-bg-deletion-emphasis-override": "#f8514966",
    "--diffs-bg-deletion-number-override": "#f851494d",
    "--diffs-bg-deletion-override": "#f851491a",
  },
  light: {
    "--diffs-bg-addition-emphasis-override": "#aceebb",
    "--diffs-bg-addition-number-override": "#aceebb",
    "--diffs-bg-addition-override": "#dafbe1",
    "--diffs-bg-deletion-emphasis-override": "#ffcecb",
    "--diffs-bg-deletion-number-override": "#ffcecb",
    "--diffs-bg-deletion-override": "#ffebe9",
  },
} as const;

const cases = (["dark", "light"] as const).flatMap((theme) =>
  Object.entries(PRIMER[theme]).map(([cssVar, expected]) => ({
    cssVar,
    expected,
    theme,
  })),
);

describe("getDiffUnsafeCSS — Primer parity", () => {
  it.each(cases)("$theme $cssVar matches $expected", ({ cssVar, expected, theme }) => {
    const css = getDiffUnsafeCSS(theme);
    expect(extractVar(css, cssVar)).toBe(expected);
  });
});
