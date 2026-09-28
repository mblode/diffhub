# packages/diff-core

Shared diff-viewer package consumed as workspace TypeScript source (no build step). See the root [`AGENTS.md`](../../AGENTS.md) for repo-wide commands and gotchas.

## Commands

Run from the monorepo root, or `cd packages/diff-core` first:

```bash
npm run lint --workspace packages/diff-core         # oxlint .
npm run check-types --workspace packages/diff-core  # tsc --noEmit
npm run format:check --workspace packages/diff-core # oxfmt --check . (read-only, verified)
npm run format --workspace packages/diff-core        # oxfmt --write .
```

All three read-only commands above were run against this checkout and passed.

## Boundary

- Two entry points: `.` (`src/index.ts`, framework-agnostic stream/theme/display utilities and types) and `./react` (`src/react.ts`, the worker-pool provider, streaming hook, `ReadOnlyDiffView`, and the shared chrome: `FileList`, `StatusBar`, `FileDiffHeader`, `Sidebar`).
- Both `apps/cli` and `apps/web` depend on it (`"@diffhub/diff-core": "*"`) and import from both entry points; `apps/cli/next.config.ts` adds it to `transpilePackages` since it ships untranspiled `.tsx`/`.ts`.
- It is **not** framework-agnostic: `./react` has `"use client"` components, a Next.js peer dependency, and React 19 peer deps (`@base-ui/react`, `@pierre/diffs`, `@pierre/trees`, `blode-icons-react`). Treat it as a shared UI/diff-rendering layer, not a pure utility library.
- Never import from `apps/cli` or `apps/web` here. This package is consumed by both apps; a reverse dependency on either app would create a cycle.
- No Node-only APIs (`fs`, `child_process`) appear in `src/` today; keep it that way so `./react` stays safe to bundle for the browser. Server-only git/filesystem logic belongs in the consuming app (e.g. `apps/cli/lib/git.ts`), not here.
- Diff syntax themes (`src/themes/diff-themes.ts`) and worker-pool registration (`src/worker/`) are shared verbatim between `apps/cli` and `apps/web`; changes here affect both apps' viewers.
