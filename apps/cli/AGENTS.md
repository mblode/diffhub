<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev          # portless run next dev → https://diffhub.localhost
npm run build        # next build → .next/standalone/apps/cli/server.js
npm run start        # next start --port 2047 (production)
npm run lint         # oxlint .
npm run check-types  # tsc --noEmit
npm run test         # vitest run
```

After `npm run build`, copy static assets before running the standalone server:

```bash
cp -r .next/static .next/standalone/apps/cli/.next/static
```

`npm run prepack` (and `npm publish` / `npm pack`) does this automatically.

## Gotchas

**The diff view renders one `<CodeView>` for the whole change set.**
`DiffViewer` (`components/DiffViewer.tsx`) builds a controlled `items: CodeViewDiffItem<AnnotationData>[]` from the route's `patchesByFile`, one item per file (`id` = file path), ordered by `sortFilesAsTree`. Each item's `fileDiff` comes from `parsePatchFiles(singleFilePatch)[0].files[0]` (each route value is already a single-file patch), memoized per `(file, patch)` so theme/layout/comment re-renders never reparse unchanged patches. CodeView owns virtualization, scroll anchoring, element pooling, DOM-height management, the worker pool, and the shared `options` object — there is no per-file `PatchDiff`, `SingleFileDiff`, or `CollapsibleFileDiff` anymore. CodeView is loaded via `next/dynamic({ ssr: false })` because it is client-only.

**Comments and the file header ride on CodeView callbacks, not per-file wrappers.**
Comments and the inline comment input are per-item annotations (`DiffLineAnnotation<AnnotationData>` with `{ side, lineNumber, metadata }`) rendered through `renderAnnotation`; the gutter "+" button comes from `renderGutterUtility(getHoveredLine, item)` and sets a single lifted `commentTarget` (`{ file, lineNumber, side }`). The custom `FileDiffHeader` is supplied via `renderCustomHeader(item)` with `disableFileHeader: true` to suppress the built-in header; collapse is driven by `item.collapsed` and toggling calls back to `DiffApp`'s `onToggleCollapse(file)`. `options` (shared across all items) uses `diffStyle: 'split' | 'unified'` (mapped from the `layout` prop), `themeType`, `theme`, `unsafeCSS`, plus the display toggles `disableLineNumbers` / `overflow` / `disableBackground` / `diffIndicators`. Scroll-to-file is imperative: `DiffApp` holds a `DiffViewerHandle` ref whose `scrollToFile(file)` calls the `CodeViewHandle.scrollTo({ type: 'item', id, align: 'start' })`. Active-file tracking is driven by `onScroll`, reading the topmost rendered item via `getRenderedItems()`.

**@pierre/diffs annotations use `metadata`, not `data`.**
`DiffLineAnnotation<T>` has a `metadata` field. Using `data` compiles silently but the annotation never renders.

**@pierre/diffs options: use `diffStyle`, not `layout`.**
Valid values: `'split' | 'unified'`. The prop `layout` does not exist and is silently ignored.

**blode-icons-react uses `PascalCaseIcon` names.**
`BranchIcon`, `RotateIcon`, `SplitIcon`, `CopySimpleIcon` — not `GitBranch`, `RefreshCw`, `Columns2`. Check the package exports before guessing a name.

**Never import `lib/comments.ts` or `lib/git.ts` in client components — even for types.**
Both modules use Node `fs` / `child_process`. A type-only `import type` from them still makes Turbopack fail the client chunk with `the chunking context (unknown) does not support external modules (request: node:fs)`. Pure splits:

- Types: `lib/comment-types.ts` (`Comment`, `CommentTag`), `lib/diff-file-stat.ts` (`DiffFileStat` + `isLargeDiffFile`, `LARGE_FILE_*_THRESHOLD`).
- Utilities: `lib/export-comments.ts` (`exportCommentsAsPrompt`).
  Client components (and anything they transitively pull in, like `lib/export-comments.ts`) must import from these, not from `comments.ts` / `git.ts`.

**`DIFFHUB_REPO` must be set for API routes to resolve the correct repo.**
Without it, `lib/git.ts` falls back to `process.cwd()` — the Next.js server directory, not the target repo. Set it in `.env.local` for dev or via the CLI env injection for production.

**Page-level repo resolution must use the same resolver as the server helpers.**
`app/page.tsx`, `lib/git.ts`, and `lib/comments.ts` should all read the same configured repo path so localStorage keys, context-menu open actions, and comment storage stay aligned.

**Whitespace filtering is wired through both diff routes.**
`/api/diff` and `/api/files` both accept `ws=ignore`, and `DiffApp` is responsible for keeping the current whitespace mode in sync across file stats and the selected-file patch fetch.

**`outputFileTracingRoot` must be the monorepo root, not the app directory.**
`next.config.ts` sets `outputFileTracingRoot: join(import.meta.dirname, "../..")`. Using the app directory breaks module resolution for packages hoisted to the root `node_modules`. The monorepo root value causes the standalone server to land at `.next/standalone/apps/cli/server.js` — not a flat `server.js`.

**Standalone server path mirrors the monorepo workspace.**
Because `outputFileTracingRoot` is the repo root, the standalone server lives at `.next/standalone/apps/cli/server.js`, and static files must be at `.next/standalone/apps/cli/.next/static/`. The CLI handles this automatically.

**CodeView owns scroll anchoring — don't reintroduce the old height machinery.**
The diff view targets Safari, which has no native `overflow-anchor` ([WebKit #171099](https://bugs.webkit.org/show_bug.cgi?id=171099)). The single `<CodeView>` virtualizer handles this internally: it manages each item's reserved DOM height, anchors the scroll position across post-mount resize cascades (Shiki tokenize, font swap, its own ResizeManager beats), and pools rendered elements. The previous hand-rolled defences are gone and must not return: the per-section `min-height` `ResizeObserver` pin, the `useScrollAnchor`/`[data-file-section]` window-scroll compensation hook, the IntersectionObserver active-file tracking, and the deferred/`forceRender` placeholder system (`DeferredDiffPlaceholder`, `getReservedHeightPx`, `scheduleVisibleFlush`). Do not add growable elements outside CodeView's item model; let CodeView render and measure them. Active-file state is derived from CodeView's `onScroll` + `getRenderedItems()` and the file-header active highlight is CSS-driven.

## Conventions

- API routes (`app/api/*/route.ts`) are server-only — no `"use client"` directive there
- Icons come from `blode-icons-react`, not `lucide-react`
- Comments are stored in `.git/diffhub-comments.json` (gitignored in the target repo, not this one)
- Diff defaults to merge-base changes, with a UI toggle for uncommitted-only changes
- Base branch prefers `origin/main` over local `main` so unpushed commits are visible even when on main

## Available Context

Additional context is available in the files below. Consult the relevant file when working in a related area — see each description for scope.

- `.claude/knowledge/diff-intraline-highlighting.md` — why `lineDiffType: "word-alt"` is used (server prerender and client `<CodeView>` must stay in sync), the single-char-neutral absorption quirk, and why diff colors must track Primer exactly. Consult before changing `lib/diff-prerender.ts`, `lib/diff-colors.ts`, or the `<CodeView>` options in `components/DiffViewer.tsx`.
