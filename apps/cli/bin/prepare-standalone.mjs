#!/usr/bin/env node
import { join, resolve } from "node:path";
import {
  findMissingStandaloneNodeModuleAliases,
  findStandaloneSymlinks,
  flattenPnpmStandaloneNodeModules,
  pruneStandalonePackages,
  syncStandaloneAssets,
} from "./standalone-helpers.mjs";

const appDir = resolve(import.meta.dirname, "..");
const standaloneRoot = join(appDir, ".next", "standalone");
const standaloneDir = join(standaloneRoot, "apps", "cli");

const materializedAliases = syncStandaloneAssets(appDir, standaloneDir);
if (materializedAliases.length > 0) {
  console.info("[diffhub] materialized standalone module aliases", {
    aliases: materializedAliases,
  });
}

// After the aliases are materialized, because they copy their targets out of .pnpm.
const flattenedPackages = flattenPnpmStandaloneNodeModules(standaloneRoot);
if (flattenedPackages.length > 0) {
  console.info("[diffhub] flattened pnpm node_modules", {
    count: flattenedPackages.length,
  });
}

const prunedPackages = pruneStandalonePackages(standaloneRoot);
if (prunedPackages.length > 0) {
  console.info("[diffhub] pruned traced-but-unused packages", {
    packages: prunedPackages,
  });
}

const missingAliases = findMissingStandaloneNodeModuleAliases(standaloneDir);
if (missingAliases.length > 0) {
  console.error("[diffhub] standalone build is missing traced module aliases", {
    aliases: missingAliases,
  });
  process.exit(1);
}

const symlinks = findStandaloneSymlinks(standaloneRoot);
if (symlinks.length > 0) {
  console.error("[diffhub] standalone build contains symlinks, which npm publish rejects", {
    symlinks,
  });
  process.exit(1);
}
