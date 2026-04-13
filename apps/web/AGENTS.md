<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev          # portless run next dev → https://diffhub.localhost
npm run build        # next build → .next/standalone/apps/web/server.js
npm run start        # next start --port 2047 (production)
npm run lint         # oxlint .
npm run check-types  # tsc --noEmit
npm run test         # vitest run
```

After `npm run build`, copy static assets before running the standalone server:

```bash
cp -r .next/static .next/standalone/apps/web/.next/static
```

`npm run prepack` (and `npm publish` / `npm pack`) does this automatically.

## Gotchas

**`PatchDiff` only accepts single-file patches.**
`PatchDiff` calls `getSingularPatch()` internally and throws `"FileDiff: Provided patch must contain exactly 1 file diff"` if the patch has >1 file. Split the full multi-file patch with `/(?=^diff --git )/gm` and render one `PatchDiff` per file. See `components/DiffViewer.tsx` → `splitPatch()`.

**@pierre/diffs annotations use `metadata`, not `data`.**
`DiffLineAnnotation<T>` has a `metadata` field. Using `data` compiles silently but the annotation never renders.

**@pierre/diffs options: use `diffStyle`, not `layout`.**
Valid values: `'split' | 'unified'`. The prop `layout` does not exist and is silently ignored.

**blode-icons-react uses `PascalCaseIcon` names.**
`BranchIcon`, `RotateIcon`, `SplitIcon`, `CopySimpleIcon` — not `GitBranch`, `RefreshCw`, `Columns2`. Check the package exports before guessing a name.

**Never import `lib/comments.ts` in client components.**
`comments.ts` uses Node.js `fs`. Client components that import it will fail at build time with "Can't resolve 'fs'". Pure utilities (like `exportCommentsAsPrompt`) live in `lib/export-comments.ts` instead.

**`DIFFHUB_REPO` must be set for API routes to resolve the correct repo.**
Without it, `lib/git.ts` falls back to `process.cwd()` — the Next.js server directory, not the target repo. Set it in `.env.local` for dev or via the CLI env injection for production.

**`outputFileTracingRoot` must be the monorepo root, not `__dirname`.**
`next.config.ts` sets `outputFileTracingRoot: join(__dirname, "../..")`. Using `__dirname` (the app directory) breaks module resolution for packages hoisted to the root `node_modules`. The monorepo root value causes the standalone server to land at `.next/standalone/apps/web/server.js` — not a flat `server.js`.

**Standalone server path mirrors the monorepo workspace.**
Because `outputFileTracingRoot` is the repo root, the standalone server lives at `.next/standalone/apps/web/server.js`, and static files must be at `.next/standalone/apps/web/.next/static/`. The CLI handles this automatically.

## Conventions

- API routes (`app/api/*/route.ts`) are server-only — no `"use client"` directive there
- Icons come from `blode-icons-react`, not `lucide-react`
- Comments are stored in `.git/diffhub-comments.json` (gitignored in the target repo, not this one)
- Diff is always `mergeBase...HEAD` — never `HEAD~1` or uncommitted changes
- Base branch prefers `origin/main` over local `main` so unpushed commits are visible even when on main
