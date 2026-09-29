/** The real hunk from mblode/diffhub #52 that the hero viewer replica renders. */

export const FILE_DIR = "apps/cli/lib/";
export const FILE_NAME = "export-comments.ts";
export const FILE = `${FILE_DIR}${FILE_NAME}`;
export const BRANCH = "fix/review-comment-side";
export const PR_PATH = "/mblode/diffhub/pull/52";

export type LineKind = "add" | "context" | "del";

/** A run of source text and its Linear Dark colour; no colour is the theme's foreground. */
export type Token = readonly [text: string, color?: string];

export interface DiffLine {
  kind: LineKind;
  newNumber: number | null;
  oldNumber: number | null;
  tokens: Token[];
}

// Verbatim from `git show afe7d53 -- apps/cli/lib/export-comments.ts`, split
// into the tokens Shiki produces with packages/diff-core/src/themes/linear-dark.json,
// the theme the viewer itself renders with. Set in the system monospace stack,
// not Glide Mono, because Glide Mono's backtick has zero advance width and eats
// the space beside it.
const PINK = "#fa9ce3";
const PURPLE = "#cc9dff";
const BLUE = "#8fa7ff";
const ORANGE = "#fac08a";
const TEAL = "#7fdede";
const YELLOW = "#ffe09e";

/* oxlint-disable no-template-curly-in-string -- these are lines of source code, not templates */
export const HUNK: DiffLine[] = [
  {
    kind: "context",
    newNumber: 7,
    oldNumber: 7,
    tokens: [
      ["  "],
      ["const ", PINK],
      ["lines", BLUE],
      [" = "],
      ["comments", ORANGE],
      ["."],
      ["map", TEAL],
      ["(("],
      ["c", ORANGE],
      [") "],
      ["=>", PINK],
      [" {"],
    ],
  },
  {
    kind: "context",
    newNumber: 8,
    oldNumber: 8,
    tokens: [
      ["    "],
      ["const ", PINK],
      ["tag", BLUE],
      [" = "],
      ["c", ORANGE],
      ["."],
      ["tag", ORANGE],
      [" ? "],
      ["`", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["tag", ORANGE],
      ["}", PINK],
      [" `", YELLOW],
      [" : "],
      ['""', YELLOW],
      [";"],
    ],
  },
  {
    kind: "context",
    newNumber: 9,
    oldNumber: 9,
    tokens: [
      ["    "],
      ["const ", PINK],
      ["loc", BLUE],
      [" = "],
      ["c", ORANGE],
      ["."],
      ["lineNumber", ORANGE],
      [" > "],
      ["0", TEAL],
      [" ? "],
      ["`:", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["lineNumber", ORANGE],
      ["}", PINK],
      ["`", YELLOW],
      [" : "],
      ['""', YELLOW],
      [";"],
    ],
  },
  {
    kind: "del",
    newNumber: null,
    oldNumber: 10,
    tokens: [
      ["    "],
      ["return ", PURPLE],
      ["`- ", YELLOW],
      ["${", PINK],
      ["tag", ORANGE],
      ["}", PINK],
      ["**", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["file", ORANGE],
      ["}${", PINK],
      ["loc", ORANGE],
      ["}", PINK],
      ["**: ", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["body", ORANGE],
      ["}", PINK],
      ["`", YELLOW],
      [";"],
    ],
  },
  {
    kind: "add",
    newNumber: 10,
    oldNumber: null,
    tokens: [
      ["    "],
      ["const ", PINK],
      ["side", BLUE],
      [" = "],
      ["c", ORANGE],
      ["."],
      ["lineNumber", ORANGE],
      [" > "],
      ["0", TEAL],
      [" ? "],
      ["` (", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["side", ORANGE],
      [" === "],
      ['"left"', YELLOW],
      [" ? "],
      ['"old"', YELLOW],
      [" : "],
      ['"new"', YELLOW],
      ["}", PINK],
      [" side)`", YELLOW],
      [" : "],
      ['""', YELLOW],
      [";"],
    ],
  },
  {
    kind: "add",
    newNumber: 11,
    oldNumber: null,
    tokens: [
      ["    "],
      ["return ", PURPLE],
      ["`- ", YELLOW],
      ["${", PINK],
      ["tag", ORANGE],
      ["}", PINK],
      ["**", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["file", ORANGE],
      ["}${", PINK],
      ["loc", ORANGE],
      ["}", PINK],
      ["**", YELLOW],
      ["${", PINK],
      ["side", ORANGE],
      ["}", PINK],
      [": ", YELLOW],
      ["${", PINK],
      ["c", ORANGE],
      ["."],
      ["body", ORANGE],
      ["}", PINK],
      ["`", YELLOW],
      [";"],
    ],
  },
  { kind: "context", newNumber: 12, oldNumber: 11, tokens: [["  });"]] },
  {
    kind: "context",
    newNumber: 13,
    oldNumber: 12,
    tokens: [
      ["  "],
      ["return ", PURPLE],
      ["`## Code Review Comments", YELLOW],
      ["\\n\\n", ORANGE],
      ["Please address the following:", YELLOW],
      ["\\n\\n", ORANGE],
      ["${", PINK],
      ["lines", ORANGE],
      ["."],
      ["join", TEAL],
      ["("],
      ['"', YELLOW],
      ["\\n", ORANGE],
      ['"', YELLOW],
      [")"],
      ["}", PINK],
      ["`", YELLOW],
      [";"],
    ],
  },
  { kind: "context", newNumber: 14, oldNumber: 13, tokens: [["};"]] },
];
/* oxlint-enable no-template-curly-in-string */

export const BASE_BRANCH = "main";
export const PR_TITLE = "Preserve diff side in agent review prompts";
export const PR_NUMBER = 52;

/** The eight files the real commit touched, `git show --stat afe7d53`. */
export const TREE_FILES: readonly { deletions: number; insertions: number; path: string }[] = [
  { deletions: 0, insertions: 6, path: ".changeset/clear-sides-travel.md" },
  { deletions: 0, insertions: 2, path: "README.md" },
  { deletions: 1, insertions: 1, path: "apps/cli/components/DiffApp.test.tsx" },
  { deletions: 0, insertions: 37, path: "apps/cli/lib/comments.test.ts" },
  { deletions: 1, insertions: 2, path: FILE },
  { deletions: 2, insertions: 4, path: "apps/docs/features/comments.mdx" },
  { deletions: 1, insertions: 1, path: "apps/docs/meta.json" },
  { deletions: 0, insertions: 55, path: "apps/docs/review-with-codex.mdx" },
];
