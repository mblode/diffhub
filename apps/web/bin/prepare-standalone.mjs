#!/usr/bin/env node
import { join, resolve } from "node:path";
import {
  findMissingStandaloneNodeModuleAliases,
  syncStandaloneAssets,
} from "./standalone-helpers.mjs";

const appDir = resolve(import.meta.dirname, "..");
const standaloneDir = join(appDir, ".next", "standalone", "apps", "web");

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
