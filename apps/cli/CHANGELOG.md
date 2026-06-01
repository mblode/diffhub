# diffhub

## 0.2.1

### Patch Changes

- 6216cf9: Fix the diff viewer occasionally rendering blank (line backgrounds only, no code) on first load until you scroll — the shared CodeView now reliably paints its first window. Internally, the diff viewer engine and chrome (status bar, file list, per-file header, sidebar) were extracted into a shared `@diffhub/diff-core` package that also powers the new diffhub.blode.co live PR viewer.

## 0.2.0

### Minor Changes

- 975bef7: Migrate the diff viewer to the virtualization-first `CodeView` component from
  `@pierre/diffs` (upgraded to 1.2.4). The entire change set now renders in a
  single virtualized surface that scales to thousands of files, replacing the
  per-file `PatchDiff` loop and the hand-rolled scale layer (scroll anchoring,
  `min-height` pinning, IntersectionObserver activation, and deferred-render
  placeholders) — all of which `CodeView` now owns natively. Comments, split/
  unified layout, theming, collapse/expand, and sidebar navigation are preserved.
- 43a7524: Migrate the file-tree sidebar to the virtualization-first `FileTree` from
  `@pierre/trees`, replacing the hand-rolled tree (manual tree-building, folder
  compaction, and per-row rendering) with a single virtualized surface that scales
  to thousands of files. Git-status colouring, VS Code-style folder compaction,
  comment-count badges, filter search, and scroll-driven active-file sync are
  preserved and mapped onto the package's native model API.

  The sidebar is rebuilt to full "Diffs and Trees" parity: a toolbar (file
  tree / comments-only / search), collapsible **Diff Stats** (F2) and **System
  Monitor** (F3) panels driven by the existing diff stats and file-watcher status,
  and a "Powered by Diffs and Trees" footer.

### Patch Changes

- 1f65c95: Refine the diff toolbar: merge the "Live" status pill and refresh button into a
  single status dot that doubles as force-refresh (showing a spinner while
  updating), use action-convention icons for the collapse/expand and split/unified
  toggles so each icon matches its tooltip, and default the sidebar to expanded on
  launch.

## 0.1.23

### Patch Changes

- 8190a90: Add file watcher event forwarder and refresh support for the files API

## 0.1.22

### Patch Changes

- e231a42: Add SSE-based file watcher for live repo change detection, bulk comment clearing, and watch status indicator in the status bar

## 0.1.21

### Patch Changes

- 7b9f3b6: Fix scroll jump in Safari near the bottom of long diffs

  Two defences keep the viewport stable while `@pierre/diffs` finishes its
  post-mount resize cascades:

  - Each file section now pins its `min-height` after a 200 ms resize-idle
    window. Once pinned, internal library resizes (Shiki tokenize, font swap,
    ResizeManager beats) are absorbed inside the section instead of pushing
    siblings.
  - A new `useScrollAnchor` hook observes every `[data-file-section]` and
    compensates `window.scrollY` when a section above the viewport changes
    height. This restores the scroll-anchor behaviour that Safari is missing
    ([WebKit #171099](https://bugs.webkit.org/show_bug.cgi?id=171099)).

## 0.1.20

### Patch Changes

- 8bb1594: Replace live file watcher with a manual refresh button

  The diff view used to auto-refresh whenever a file in the repo changed, which caused scroll-jump regressions during review. The watcher (chokidar + `/api/watch` + client polling) has been removed; refresh is now driven by the new toolbar button or the existing `R` keyboard shortcut.

## 0.1.19

### Patch Changes

- efd58fc: Fix diff scroll refresh stability

## 0.1.18

### Patch Changes

- e113e6e: Only render deferred large-file diffs on explicit navigation (active file, prev/neighbor, expanded collapse) instead of any visibility-driven `active` change. Reserve approximate placeholder height per file so scroll position stays stable as patches mount.

## 0.1.17

### Patch Changes

- e427451: Fix sidebar toggle button so a click actually collapses and expands the
  sidebar. `SidebarTrigger` was being wrapped by a Base UI `TooltipTrigger`
  render prop, which merged its own click handler into the rendered
  component's props. The custom trigger hard-coded `onClick={toggleSidebar}`
  before spreading `{...props}`, so the merged handler overwrote the toggle.
  Destructure `onClick` out of `props`, compose it with `toggleSidebar` in a
  `useCallback`, and spread props before the final `onClick`. Also drop
  `aria-expanded:bg-muted` from the ghost button variant so the trigger
  doesn't sit visually stuck-on while the sidebar is open.

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
