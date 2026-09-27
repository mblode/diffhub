---
---

Set `seo.siteName` in `apps/docs/docs.json` so the blode.md docs tenant's og:site_name reads "Matthew Blode" instead of the product name, per blode-co's zone conventions. `docs-proxy.ts` already documents this field as coming from the tenant config; docs-only change, nothing published ships.
