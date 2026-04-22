# diffhub

## 0.1.16

### Patch Changes

- f91cdf2: Intra-line diff readability: adjacent changed words now render as one continuous highlighted pill instead of per-word pills with pale gaps between them. Also disables the line-hover state so diff colors don't shift when the cursor passes over a row.

  - Switch `@pierre/diffs` `lineDiffType` from `"word"` to `"word-alt"` in both server prerender and client renderer. This is the library's default behaviour ("word boundaries while minimizing single-char gaps").
  - Set `lineHoverHighlight: "disabled"` so row backgrounds stay put on hover; removes the corresponding hover CSS overrides.
  - Diff colors now track GitHub Primer 11.7 exactly; `diff-colors.test.ts` pins the parity.

## 0.1.15

### Patch Changes

- 513040e: Perf + UX: large diffs load ~4× faster and no longer flash "server hasn't responded" mid-request.
  - Raise the loading watchdog to 20s and soften the message; show a file-count hint while loading.
  - Deduplicate concurrent `/api/diff` work: in-flight promises are shared, snapshot TTL extended from 500ms to 15s, and stale-generation disk cache is no longer thrashed.
  - Cache server-prerendered diff HTML in a reviewKey-keyed LRU so repeat views and toggles are instant.
  - Under `diffhub cmux`, pre-warm the prerender cache whenever the watcher rebuilds a git snapshot.
  - Cap prerender concurrency and add per-phase timings (`gitMs`, `prerenderMs`, cache hit/miss counts) to the response log.
  - Prerender only the currently-displayed layout × theme variant instead of all four — 4× reduction in per-request Shiki work.

## 0.1.14

### Patch Changes

- eef9844: Stop post-paint DOM mutations above the viewport so `diffhub cmux` (WebKit/WKWebView) scrolls smoothly end-to-end.

  WebKit has no `overflow-anchor` implementation, and its momentum scroller clamps `scrollTop` to `scrollHeight − clientHeight` every frame. When content above the viewport grows or shrinks during scroll, WebKit cannot hold position and either shifts or rubber-bands. Two factors were changing layout mid-scroll in diffhub:

  - The `/api/diff` route prerendered only the first 4 files (`MAX_PRERENDER_FILES = 4`). Files 5+ shipped without highlighted HTML, so `@pierre/diffs` ran its async syntax-highlight path on the client, then swapped each section's hunk DOM via `innerHTML` after first paint.
  - React state updates were landing mid-scroll: `useDeferredValue(diffData)` forced a second render pass after `setDiffData`, the IntersectionObserver per section re-entered React on every scroll frame, `reconcileSelectedFile` was recreated on every diff-state change, poll cycles dispatched `setFilesData` + `setComments` during scroll, and every comment prop change re-filtered inside every section.

  Fixes:

  - `app/api/diff/route.ts` — remove the `MAX_PRERENDER_FILES` cap; prerender every file that isn't already deferred as a large diff. The server still respects `DIFFHUB_DISABLE_PRERENDER=1` and the per-file 3 s timeout.
  - `components/DiffViewer.tsx` — split `comments` into a `Map<string, Comment[]>` at the viewer level so each file section receives a stable reference; module-level rAF throttle collapses multiple IntersectionObserver callbacks into one `onVisible` per frame; derive `shouldRenderPatch` during render instead of via `useEffect`+`useState`; drop `onVisible` from the observer's deps; stabilise the `PatchDiff` render key so highlighted HTML is not discarded on layout/theme change.
  - `components/DiffApp.tsx` — remove `useDeferredValue(diffData)`; `scrollingRef` pauses polling for 200 ms after the last scroll event (applies to both the interval and file-watch pushes); `reconcileSelectedFile` reads `diffData`/`diffError` through refs so its identity stays stable; drop the `.focus({ preventScroll: true })` call in `scrollToFile` (WebKit ≤ 16.3 ignores the flag).

## 0.1.13

### Patch Changes

- 93966e1: Fix `diffhub cmux` hanging on "Loading diff…" or rendering empty panels. The cmux command was setting `DIFFHUB_DISABLE_PRERENDER=1` whenever the server ran with a log file, which bypassed server-side prerender on every cmux session. When client-side rendering then hit a transient race (a stale poll arriving mid-fetch, or the dynamic `PatchDiff` import resolving into a section with `content-visibility: auto`), the user was left with no diff at all.

  Changes:

  - Stop disabling prerender just because the server has a log file; only disable when shiki's standalone module aliases are actually missing.
  - Log silent prerender failures instead of swallowing them, and time out individual prerenders after 3 s so one bad file can't block the whole response.
  - Re-queue the diff fetch if the only response in flight is dropped as stale; give up and reset state after three consecutive stale drops.
  - Abort and surface an error if `/api/diff` takes longer than 15 s, with a 5 s watchdog that offers an explicit Retry button instead of pulsing forever.
  - Wrap the `PatchDiff` render in a per-file error boundary so a malformed patch reports the error rather than leaving the panel blank.
  - Drop the per-file `content-visibility: auto` / `contain-intrinsic-size: auto 300px` wrapper that could keep newly rendered diffs hidden when their dynamic chunk resolved after the IntersectionObserver had already fired.

## 0.1.12

### Patch Changes

- 19fd65b: Defer large single-file diffs behind a "Load diff" button to keep the diff list responsive on big changesets.

## 0.1.11

### Patch Changes

- Fix docs deployment and add asset proxy for blode.md documentation

## 0.1.10

### Patch Changes

- Patch version bump

## 0.1.9

### Patch Changes

- 41eb62e: Improve standalone packaging and diff review handling

## 0.1.8

### Patch Changes

- Add screenshot to README and clean up runtime, comments, and review flow

## 0.1.7

### Patch Changes

- Fix scroll position jumping when viewing diffs with multiple files and use muted text styling across sidebar, diff headers, and navbar

## 0.1.6

### Patch Changes

- Remove dead code: delete unused components, un-export internal-only symbols, and clean up cascading unused UI primitives

## 0.1.5

### Patch Changes

- Fix CLI to work from any subdirectory within a git repository

## 0.1.4

### Patch Changes

- Fix diff viewer always showing light mode by pre-rendering both light and dark theme variants

## 0.1.3

### Patch Changes

- Server-side pre-render diff HTML for faster initial load and CLI auto-syncs static assets at startup

## 0.1.2

### Patch Changes

- Improve diff rendering and simplify diff helper formatting

## 0.1.1

### Patch Changes

- Fix port conflict on startup, stuck "Loading diff…" on clean repos, and page freeze on large monorepos with 500+ changed files.
