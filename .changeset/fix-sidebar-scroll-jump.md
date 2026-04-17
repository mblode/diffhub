---
"diffhub": patch
---

Fix sidebar file clicks (especially the last file) ending up scrolled above the target on large branches. When `deferPatchRendering` is active (≥24 files with no prerender), clicking a file scroll-jumped to its current position, then the target plus its neighbours lazy-mounted their `PatchDiff` components and grew by hundreds of pixels — and the browser's default `overflow-anchor: auto` anchored on the wrong sibling, so the user drifted upward as the layout settled.

- After `scrollIntoView`, run a bounded `requestAnimationFrame` loop that re-aligns the target if its viewport position drifts beyond 1 px, stopping after 3 stable frames or ~1 s. For smooth scrolls the loop waits for `scrollend` (with a Safari timeout fallback) so it doesn't fight the in-progress animation. Aborts on any manual `wheel` / `touchmove` / `keydown`.
- When `scrollToFile` runs, eagerly render the target and its ±1 neighbours so the IntersectionObserver has nothing to inflate around the landing point.
- Reserve an estimated min-height on deferred sections based on `fileStat.changes` (capped at 400 px), so unrendered sections aren't 36 px ghosts that shove content by hundreds of pixels when they finally mount.
- Apply `overflow-anchor: auto` only to the active section and `none` to everything else, so the browser's scroll-anchoring locks onto the file the user is actually focused on.
