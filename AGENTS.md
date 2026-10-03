# DiffHub

GitHub PR-style local diff viewer. Monorepo with three apps and one shared package.

## Commands

```bash
# Development
pnpm run dev          # Start all apps via Turbo
pnpm run build        # Build all apps
pnpm run check-types  # TypeScript check across all workspaces
pnpm run test         # vitest across workspaces
pnpm --filter diffhub test -- lib/git.test.ts --reporter=dot   # one file, quiet

# Quality
pnpm run lint         # oxlint via Turbo
pnpm run lint:fix     # oxlint --fix via Turbo
pnpm run format       # oxfmt --write via Turbo
pnpm run check        # ultracite check (lint + format)
pnpm run fix          # ultracite fix (lint + format --fix)
```

Run all commands from the **monorepo root**. Do not `cd` into individual apps for routine tasks.

## Workspace Structure

```
diffhub/
├── apps/cli/             # Diff viewer + CLI npm package `diffhub` (see apps/cli/AGENTS.md)
├── apps/web/             # Marketing site (Next.js, deploys to Vercel)
├── apps/docs/            # Documentation MDX content (deploys to blode.md)
├── packages/diff-core/   # Shared viewer: streaming, CodeView wiring, themes, worker pool, chrome
├── turbo.json            # Task pipelines
├── pnpm-workspace.yaml   # Root workspace (pnpm workspaces)
└── package.json
```

`apps/docs/` is pure MDX content with no `package.json`; it is not a pnpm workspace. Deploy with `cd apps/docs && pnpm dlx blodemd push docs`.

## Nested AGENTS.md files

Each workspace has its own `AGENTS.md` with boundary rules specific to it: [`apps/cli/AGENTS.md`](apps/cli/AGENTS.md), [`apps/web/AGENTS.md`](apps/web/AGENTS.md), [`apps/docs/AGENTS.md`](apps/docs/AGENTS.md), [`packages/diff-core/AGENTS.md`](packages/diff-core/AGENTS.md). Codex only reads `AGENTS.md` files from the repo root down to its current working directory, so an agent editing a package should read that package's `AGENTS.md` first, not just this root file.

## Gotchas

- **No inner lockfile**: `apps/cli/package-lock.json` must not exist; only the root `pnpm-lock.yaml` is used. If a lockfile appears there, delete it and run `pnpm install` from root.
- **Changesets gate PRs**: CI runs `pnpm exec changeset status --since origin/main`, so a PR that touches a workspace package (even its AGENTS.md) needs `pnpm exec changeset`, or `pnpm exec changeset add --empty` when nothing ships.
- **`format:check` is not read-only in diff-core**: its script is `oxfmt .`, which rewrites files. Use `pnpm run check` for a read-only format check.
- **CLI dev uses portless**: `pnpm run dev` in `apps/cli` serves at `https://diffhub.localhost`. The marketing site (`apps/web`) serves at `https://diffhub-web.localhost`.
- **CLI uses standalone build**: `bin/diffhub.mjs` runs `.next/standalone/apps/cli/server.js` (not `next start`). Build it with `pnpm --filter diffhub run prepack`, which runs `next build` and then copies `.next/static/` and `public/` into `.next/standalone/`. `pnpm run build` alone leaves the CLI without static assets.
- **Env for dev**: Set `DIFFHUB_REPO` in `apps/cli/.env.local` to point at a real git repo when developing. Without it, the diff API defaults to `process.cwd()`.
- **Marketing site proxies docs**: `apps/web/app/docs/[[...slug]]/route.ts` proxies `/docs/*` to `https://diffhub.blode.md/docs/*` through `apps/web/lib/docs-proxy.ts`, which rewrites the upstream's `/_docs/_next/` asset URLs to `/diffhub/docs/_chunks/*` so they stay inside the zone prefix blode.co forwards to us. This will 404 until the docs site is deployed via blodemd.
- **Docs assets track blode.md, not this repo**: `UPSTREAM_ASSET_PREFIX` in `docs-proxy.ts` is the platform's Next.js `assetPrefix`. It has changed under us once, which left every docs page unstyled. Chunks are also served only from the apex `blode.md`; the tenant host `diffhub.blode.md` emits those URLs but 404s on them. If the docs render with no CSS, diff the upstream HTML's asset paths against `UPSTREAM_ASSET_PREFIX` first.
- **Docs `<head>` metadata is rewritten too**: the upstream points `llms.txt`, `llms-full.txt`, the manifest and the icons at root-absolute paths. Under the proxy those resolve to blode.co's own copies and answer 200, so nothing 404s and no crawler flags it, but a DiffHub docs page ends up advertising the personal site's files. `ROOT_URL_REWRITES` in `docs-proxy.ts` repoints them. If the platform adds another root-absolute `<head>` link, it needs an entry there, and the target has to be a URL that already exists: pointing at a zone path that 404s is worse than the wrong-content 200 it replaced.

## Debugging browser logs

Three options, in order of preference:

1. **`/next-browser`**: Vercel's Next.js skill. Persistent Chromium with React DevTools; returns console, network, component tree, and PPR shell analysis as structured text. Install with `npx skills add vercel-labs/next-browser -g -a claude-code -y`.
2. **`apps/cli/.next/dev/logs/next-development.log`**: `browserToTerminal: true` is set in `apps/cli/next.config.ts`, so Next.js forwards browser errors into this log. `Read` it while `npm run dev` is running.
3. **`mcp__claude-in-chrome__read_console_messages`**: for the published standalone build or any non-dev URL. Requires `portless trust` first, or the extension silently fails on `https://diffhub.localhost` certs.

## Verification

CI (`.github/workflows/ci.yml`) runs changeset status, then:

```bash
pnpm run lint && pnpm run check-types && pnpm run test && pnpm run build
```

All four pass on `main` as of 27 Sep 2026. `pnpm run check` does not: `apps/cli/README.md` and `.captain/browser/report.md` are unformatted, and CI does not run it, so judge it by the files you touched. For a viewer change, prove it in the real app:

```bash
pnpm --filter diffhub run prepack
node apps/cli/bin/diffhub.mjs serve --port 2099 --no-open --repo "$PWD"
curl -s localhost:2099/api/files      # JSON file list; /api/diff streams text/plain
```

There is no `pnpm run doctor`, `pnpm run verify`, or feature map. Gap: nothing scripts the build, serve, and API or browser check above, so UI behaviour (scroll anchoring, comments, themes) is proven only by the unit tests and by hand; `apps/web` has a Playwright `test:instant` that CI does not run.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
