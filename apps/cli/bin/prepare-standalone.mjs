#!/usr/bin/env node
import { join, resolve } from "node:path";
import {
  findMissingStandaloneNodeModuleAliases,
  pruneStandalonePackages,
  syncStandaloneAssets,
} from "./standalone-helpers.mjs";

const appDir = resolve(import.meta.dirname, "..");
const standaloneRoot = join(appDir, ".next", "standalone");
const standaloneDir = join(standaloneRoot, "apps", "cli");

const prunedPackages = pruneStandalonePackages(standaloneRoot);
if (prunedPackages.length > 0) {
  console.info("[diffhub] pruned traced-but-unused packages", {
    packages: prunedPackages,
  });
}

const materializedAliases = syncStandaloneAssets(appDir, standaloneDir);
if (materializedAliases.length > 0) {
  console.info("[diffhub] materialized standalone module aliases", {
    aliases: materializedAliases,
  });
}

const missingAliases = findMissingStandaloneNodeModuleAliases(standaloneDir);
if (missingAliases.length > 0) {
  console.error("[diffhub] standalone build is missing traced module aliases", {
    aliases: missingAliases,
  });
  process.exit(1);
}
