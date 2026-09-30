# apps/docs

Pure MDX content, not a pnpm workspace (no `package.json`). Deploys via `blodemd`. See the root [`AGENTS.md`](../../AGENTS.md) for repo-wide commands and gotchas.

## Commands

`blodemd` is not a devDependency of this repo; run it via `pnpm dlx` from the **monorepo root**, pointing at this directory:

```bash
pnpm dlx blodemd validate apps/docs   # validates docs.json; verified passing in this checkout
```

Deploy (from the root AGENTS.md, not re-verified here): `cd apps/docs && pnpm dlx blodemd push docs`.

There is no local dev-preview or lint command verified for this checkout; do not assume `pnpm dlx blodemd dev` works here without trying it first.

## Boundary

- This is content, not code: no TypeScript, no lint/format/test scripts apply.
- `docs.json` is the source of truth for public navigation (`navigation.groups` under the `docs` collection). Only pages listed there are reachable from the site nav.
- `meta.json` and `features/meta.json` list page order too, but `review-with-codex.mdx` appears in `meta.json`'s `pages` while it is **absent** from `docs.json`'s navigation groups. Treat `docs.json` as authoritative; a page missing from `docs.json` is effectively unlisted even if `meta.json` mentions it. Confirm intent before assuming a new `.mdx` file is public.
- Frontmatter (`title`, `description`) is required on each `.mdx` page; follow the existing files' shape.
