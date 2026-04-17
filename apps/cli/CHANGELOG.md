# diffhub

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
