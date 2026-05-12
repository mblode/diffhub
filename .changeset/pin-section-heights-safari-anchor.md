---
"diffhub": patch
---

Fix scroll jump in Safari near the bottom of long diffs

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
