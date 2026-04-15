# diffhub

GitHub PR-style local diff viewer. Monorepo with three apps.

## Commands

```bash
# Development
npm run dev          # Start all apps via Turbo
npm run build        # Build all apps
npm run check-types  # TypeScript check across all workspaces

# Quality
npm run lint         # oxlint via Turbo
npm run lint:fix     # oxlint --fix via Turbo
npm run format       # oxfmt --write via Turbo
npm run check        # ultracite check (lint + format)
npm run fix          # ultracite fix (lint + format --fix)
```

Run all commands from the **monorepo root**. Do not `cd` into individual apps for routine tasks.

## Workspace Structure

```
diffhub/
├── apps/cli/        # Diff viewer + CLI npm package (see apps/cli/AGENTS.md)
├── apps/web/        # Marketing site (Next.js, deploys to Vercel)
├── apps/docs/       # Documentation MDX content (deploys to blode.md)
├── turbo.json       # Task pipelines
└── package.json     # Root workspace (npm workspaces)
```

`apps/docs/` is pure MDX content with no `package.json` — it is not an npm workspace. Deploy with `cd apps/docs && blodemd push docs`.

## Gotchas

- **No inner lockfile** — `apps/cli/package-lock.json` must not exist; only the root lockfile is used. If it appears, delete it and run `npm install` from root.
- **CLI dev uses portless** — `npm run dev` in `apps/cli` serves at `https://diffhub.localhost`. The marketing site (`apps/web`) serves at `https://diffhub-web.localhost`.
- **CLI uses standalone build** — `bin/diffhub.mjs` runs `.next/standalone/apps/cli/server.js` (not `next start`). Run `npm run build` first. The `prepack` script does this automatically before `npm publish`/`npm pack`.
- **Standalone needs static copies** — After `next build`, the `prepack` script copies `.next/static/` and `public/` into `.next/standalone/`. Don't skip this step when testing the CLI locally.
- **Env for dev** — Set `DIFFHUB_REPO` in `apps/cli/.env.local` to point at a real git repo when developing. Without it, the diff API defaults to `process.cwd()`.
- **Marketing site proxies docs** — `apps/web/next.config.js` rewrites `/docs/*` to `https://diffhub.blode.md/docs/*`. This will 404 until the docs site is deployed via blodemd.
