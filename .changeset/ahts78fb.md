---
"diffhub": patch
---

Intra-line diff readability: adjacent changed words now render as one continuous highlighted pill instead of per-word pills with pale gaps between them. Also disables the line-hover state so diff colors don't shift when the cursor passes over a row.

- Switch `@pierre/diffs` `lineDiffType` from `"word"` to `"word-alt"` in both server prerender and client renderer. This is the library's default behaviour ("word boundaries while minimizing single-char gaps").
- Set `lineHoverHighlight: "disabled"` so row backgrounds stay put on hover; removes the corresponding hover CSS overrides.
- Diff colors now track GitHub Primer 11.7 exactly; `diff-colors.test.ts` pins the parity.
