---
"diffhub": patch
---

Fix the diff viewer flickering constantly in Safari. The CodeView paint-nudge (a Chrome-only workaround that flicks the scroll container's opacity to force a first paint) was re-rasterizing the whole diff on every tick in WebKit; it's now skipped in Safari. Also: expand all file-tree folders by default, collapse the per-file horizontal scrollbar that rendered behind the gutter in Safari, and align the CLI favicon with the marketing site.
