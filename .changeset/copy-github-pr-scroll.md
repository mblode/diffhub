---
"diffhub": patch
---

Stop post-paint DOM mutations above the viewport so `diffhub cmux` (WebKit/WKWebView) scrolls smoothly end-to-end.

WebKit has no `overflow-anchor` implementation, and its momentum scroller clamps `scrollTop` to `scrollHeight − clientHeight` every frame. When content above the viewport grows or shrinks during scroll, WebKit cannot hold position and either shifts or rubber-bands. Two factors were changing layout mid-scroll in diffhub:

- The `/api/diff` route prerendered only the first 4 files (`MAX_PRERENDER_FILES = 4`). Files 5+ shipped without highlighted HTML, so `@pierre/diffs` ran its async syntax-highlight path on the client, then swapped each section's hunk DOM via `innerHTML` after first paint.
- React state updates were landing mid-scroll: `useDeferredValue(diffData)` forced a second render pass after `setDiffData`, the IntersectionObserver per section re-entered React on every scroll frame, `reconcileSelectedFile` was recreated on every diff-state change, poll cycles dispatched `setFilesData` + `setComments` during scroll, and every comment prop change re-filtered inside every section.

Fixes:
- `app/api/diff/route.ts` — remove the `MAX_PRERENDER_FILES` cap; prerender every file that isn't already deferred as a large diff. The server still respects `DIFFHUB_DISABLE_PRERENDER=1` and the per-file 3 s timeout.
- `components/DiffViewer.tsx` — split `comments` into a `Map<string, Comment[]>` at the viewer level so each file section receives a stable reference; module-level rAF throttle collapses multiple IntersectionObserver callbacks into one `onVisible` per frame; derive `shouldRenderPatch` during render instead of via `useEffect`+`useState`; drop `onVisible` from the observer's deps; stabilise the `PatchDiff` render key so highlighted HTML is not discarded on layout/theme change.
- `components/DiffApp.tsx` — remove `useDeferredValue(diffData)`; `scrollingRef` pauses polling for 200 ms after the last scroll event (applies to both the interval and file-watch pushes); `reconcileSelectedFile` reads `diffData`/`diffError` through refs so its identity stays stable; drop the `.focus({ preventScroll: true })` call in `scrollToFile` (WebKit ≤ 16.3 ignores the flag).
