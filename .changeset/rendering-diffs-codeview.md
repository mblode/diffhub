---
"diffhub": minor
---

Migrate the diff viewer to the virtualization-first `CodeView` component from
`@pierre/diffs` (upgraded to 1.2.4). The entire change set now renders in a
single virtualized surface that scales to thousands of files, replacing the
per-file `PatchDiff` loop and the hand-rolled scale layer (scroll anchoring,
`min-height` pinning, IntersectionObserver activation, and deferred-render
placeholders) — all of which `CodeView` now owns natively. Comments, split/
unified layout, theming, collapse/expand, and sidebar navigation are preserved.
