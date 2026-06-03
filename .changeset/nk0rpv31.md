---
"diffhub": patch
---

Stop the diff viewer from auto-refreshing. A background detector now surfaces an "Updates available" indicator on the refresh button instead of reloading the diff on its own, so the view only changes when you refresh (button or `R`). Also fixed the sidebar file tree flashing on diff updates by rebuilding it only when the set of files changes.
