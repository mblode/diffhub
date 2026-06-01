---
"diffhub": patch
---

Fix the diff-viewer chrome styling in local dev and tighten the sidebar search alignment.

- The shared `@diffhub/diff-core` chrome components (toolbar, switches, file list) rely on the consuming app's `@source` directive to generate their Tailwind utilities. Turbopack's dev server does not auto-expand the bare-directory `@source` form, so package-only classes (e.g. the `h-[52px]` toolbar, switch dimensions) silently failed to generate in `next dev`, leaving the viewer unstyled. Switching `@source` to an explicit `**/*.{ts,tsx}` glob restores generation in dev. The production build was already correct.
- The sidebar search row is now `h-[51px]` so that, combined with the `SidebarHeader`'s 1px `border-b`, it totals 52px and aligns with the StatusBar header.
