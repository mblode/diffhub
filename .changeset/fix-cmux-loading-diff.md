---
"diffhub": patch
---

Fix `diffhub cmux` hanging on "Loading diff…" or rendering empty panels. The cmux command was setting `DIFFHUB_DISABLE_PRERENDER=1` whenever the server ran with a log file, which bypassed server-side prerender on every cmux session. When client-side rendering then hit a transient race (a stale poll arriving mid-fetch, or the dynamic `PatchDiff` import resolving into a section with `content-visibility: auto`), the user was left with no diff at all.

Changes:

- Stop disabling prerender just because the server has a log file; only disable when shiki's standalone module aliases are actually missing.
- Log silent prerender failures instead of swallowing them, and time out individual prerenders after 3 s so one bad file can't block the whole response.
- Re-queue the diff fetch if the only response in flight is dropped as stale; give up and reset state after three consecutive stale drops.
- Abort and surface an error if `/api/diff` takes longer than 15 s, with a 5 s watchdog that offers an explicit Retry button instead of pulsing forever.
- Wrap the `PatchDiff` render in a per-file error boundary so a malformed patch reports the error rather than leaving the panel blank.
- Drop the per-file `content-visibility: auto` / `contain-intrinsic-size: auto 300px` wrapper that could keep newly rendered diffs hidden when their dynamic chunk resolved after the IntersectionObserver had already fired.
