---
"diffhub": patch
---

Fix the sidebar active-file highlight landing on the file *above* the one you clicked.

The active-file tracker read a `top` field off `getRenderedItems()` that `@pierre/diffs` does not provide, so it always fell back to the first item in the virtualized window — the file scrolled partially above the viewport. It now resolves the active file from the viewer's own scroll coordinates (`getScrollTop()` + `getTopForItem()`), selecting the section the viewport top actually sits inside, and reads geometry once per animation frame.
