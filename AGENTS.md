# diffhub

GitHub PR-style local diff viewer. Monorepo — one app at `apps/web/`, which also ships as a CLI via `bin/diffhub.mjs`.

## Commands

```bash
# Development
npm run dev          # Start all apps via Turbo (runs portless run next dev in apps/web)
npm run build        # Build all apps
npm run check-types  # TypeScript check across all workspaces

# Quality
npm run lint         # oxlint via Turbo
npm run lint:fix     # oxlint --fix via Turbo
npm run format       # oxfmt --write via Turbo
npm run check        # ultracite check (lint + format)
npm run fix          # ultracite fix (lint + format --fix)
```

Run all commands from the **monorepo root**. Do not `cd apps/web` for routine tasks.

## Workspace Structure

```
diffhub/
├── apps/web/        # Next.js app + CLI (see apps/web/AGENTS.md)
├── turbo.json       # Task pipelines
└── package.json     # Root workspace (npm workspaces)
```

## Gotchas

- **No inner lockfile** — `apps/web/package-lock.json` must not exist; only the root lockfile is used. If it appears, delete it and run `npm install` from root.
- **Dev uses portless** — `npm run dev` serves at `https://diffhub.localhost`, not `http://localhost:3000`. Requires portless to proxy correctly.
- **CLI uses standalone build** — `bin/diffhub.mjs` runs `.next/standalone/apps/web/server.js` (not `next start`). Run `npm run build` first. The `prepack` script does this automatically before `npm publish`/`npm pack`.
- **Standalone needs static copies** — After `next build`, the `prepack` script copies `.next/static/` and `public/` into `.next/standalone/`. Don't skip this step when testing the CLI locally.
- **Env for dev** — Set `DIFFHUB_REPO` in `apps/web/.env.local` to point at a real git repo when developing. Without it, the diff API defaults to `process.cwd()`.
