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

**The diff streams into one uncontrolled `<CodeView>` (aligned with diffshub.com).**
`/api/diff` returns a `text/plain` **`ReadableStream` of the raw unified git patch** (`lib/git.ts` `streamDiffPatch`), not JSON. `usePatchLoader` (`components/use-patch-loader.ts`) fetches it and runs `streamGitPatchFiles` (`lib/diff-stream/streamGitPatchFiles.ts`) → `processFile(fileText, { cacheKey, isGitDiff: true })` → `appendFileDiffToAccumulator` (`lib/diff-stream/diffItemAccumulator.ts`), publishing a viewport-sized first batch as `initialItems` then 25-file batches via `viewer.addItems()`. `DiffViewer` renders `<CodeView initialItems … ref={codeViewRef}>` — **uncontrolled**; `id` = file path. CodeView owns virtualization, scroll anchoring, element pooling, DOM-height management, the **worker pool** (deferred Shiki highlighting), and the shared `options` object. Loaded via `next/dynamic({ ssr: false })` (client-only). A re-stream is triggered by bumping `reloadKey` (file fingerprint / diff-mode / manual nonce); the loader bumps `viewerKey` so the `<CodeView key={viewerKey}>` remounts clean. There is no `patchesByFile` JSON, controlled `items`, `sortFilesAsTree`, or SSR `prerenderedHTML` anymore.

**Comments + collapse are reconciled imperatively onto uncontrolled items.**
Saved comments and the inline input are per-item annotations (`DiffLineAnnotation<AnnotationData>` with `{ side, lineNumber, metadata }`) rendered through `renderAnnotation`. Items stream in without annotations; `DiffViewer`'s `prepareItems` stamps current collapse state + comment annotations at creation, and effects keyed on `comments`/`commentTarget`/`collapsedFiles` reconcile changes afterward via `viewer.getItem(id)` + `item.version++` + `viewer.updateItem(item)`. **Comments stay persisted** (`/api/comments` POST/DELETE → `DiffApp` updates the `comments` list → prop change → reconcile). The gutter "+" (`renderGutterUtility(getHoveredLine, item)`) sets a single lifted `commentTarget`; the custom `FileDiffHeader` is supplied via `renderCustomHeader(item)` with `disableFileHeader: true`; collapse toggles call `DiffApp`'s `onToggleCollapse(file)`. `options` uses `layout: CODE_VIEW_LAYOUT`, `diffStyle`, `themeType`, `theme`, `unsafeCSS`, plus display toggles. Scroll-to-file is imperative (`DiffViewerHandle.scrollToFile` → `CodeViewHandle.scrollTo({ type: 'item', id, align: 'start' })`); active-file tracking reads the topmost rendered item via `onScroll` + `getRenderedItems()`.

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

**Diff syntax themes are user-selectable and resolve lazily.**
`lib/diff-themes.ts` is a client-safe catalog (`DIFF_THEMES`) of the 4 Pierre themes + 65 Shiki bundled themes, plus `DEFAULT_LIGHT_THEME`/`DEFAULT_DARK_THEME` (`pierre-light-soft`/`pierre-dark-soft`) and `normalizeDiffThemes`. Regenerate the bundled portion with the `shiki` snippet in the file header. The StatusBar theme picker writes a `{ light, dark }` selection (persisted under `diffhub-diff-theme`), threaded `DiffApp → MainPanel → DiffViewer` into `options.theme`. **Highlighting runs on the worker pool** (`DiffsWorkerProvider` mounts `WorkerPoolContextProvider` in `app/layout.tsx` with `worker.js`, `preferredHighlighter: 'shiki-wasm'`, a `langs` warm-set, and the default theme pair). Because `resolveTheme` throws in a worker, the active theme must be pushed to the workers explicitly: `DiffViewer` calls `useWorkerPool().setRenderOptions({ theme })` in a `useLayoutEffect` whenever the selection changes — without this, background tokenizers keep the theme they were initialized with. The viewer is withheld until `useIsWorkerPoolReady()` reports the pool initialized. Display toggles (`diffhub-display-settings`: backgrounds/line-numbers/word-wrap/indicators) live in `lib/display-settings.ts` and flow the same way.

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

- `.claude/knowledge/diff-intraline-highlighting.md` — why `lineDiffType: "word-alt"` is used, the single-char-neutral absorption quirk, and why diff colors must track Primer exactly. Consult before changing `lib/diff-colors.ts` or the `<CodeView>` options in `components/DiffViewer.tsx`.
