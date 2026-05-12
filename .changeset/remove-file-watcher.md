---
"diffhub": patch
---

Replace live file watcher with a manual refresh button

The diff view used to auto-refresh whenever a file in the repo changed, which caused scroll-jump regressions during review. The watcher (chokidar + `/api/watch` + client polling) has been removed; refresh is now driven by the new toolbar button or the existing `R` keyboard shortcut.
