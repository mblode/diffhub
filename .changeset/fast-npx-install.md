---
"diffhub": patch
---

Make `npx diffhub` install fast: runtime dependencies trimmed to `chokidar` + `commander` (the standalone server bundles everything else), sharp and server-side shiki langs/themes pruned from the package, and unused public assets removed. Tarball drops from 17.3 MB to 7.2 MB and a fresh install goes from hundreds of packages to 4. Also relaxes `engines.node` to `>=20.11`, matching what the CLI actually supports.
