import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Only the `@/` alias, mirroring `tsconfig.json`'s `paths`. Without it, any
 * test that reaches a module using the alias fails to resolve it, which is why
 * `lib/docs-proxy.ts` imports `./config` relatively while the rest of the app
 * uses `@/lib/config`.
 *
 * No `environment` key on purpose: these are pure-module tests and node is the
 * faster default. Add jsdom here if a component test ever lands.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
});
