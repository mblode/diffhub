---
"diffhub": patch
---

Fix the diff's vertical scrollbar rendering behind the content in Safari. The scroll container used a native overlay scrollbar, which WebKit paints beneath the diff's z-indexed gutter/annotation layers; it now uses a styled, reserved-gutter scrollbar that the content can't cover. Reverts the prior 0.2.5 change that targeted the wrong (per-file horizontal) scrollbar.
