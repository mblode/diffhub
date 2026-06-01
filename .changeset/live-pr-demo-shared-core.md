---
"diffhub": patch
---

Fix the diff viewer occasionally rendering blank (line backgrounds only, no code) on first load until you scroll — the shared CodeView now reliably paints its first window. Internally, the diff viewer engine and chrome (status bar, file list, per-file header, sidebar) were extracted into a shared `@diffhub/diff-core` package that also powers the new diffhub.blode.co live PR viewer.
