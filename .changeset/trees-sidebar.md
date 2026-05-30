---
"diffhub": minor
---

Migrate the file-tree sidebar to the virtualization-first `FileTree` from
`@pierre/trees`, replacing the hand-rolled tree (manual tree-building, folder
compaction, and per-row rendering) with a single virtualized surface that scales
to thousands of files. Git-status colouring, VS Code-style folder compaction,
comment-count badges, filter search, and scroll-driven active-file sync are
preserved and mapped onto the package's native model API.

The sidebar is rebuilt to full "Diffs and Trees" parity: a toolbar (file
tree / comments-only / search), collapsible **Diff Stats** (F2) and **System
Monitor** (F3) panels driven by the existing diff stats and file-watcher status,
and a "Powered by Diffs and Trees" footer.
