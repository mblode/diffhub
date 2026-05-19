import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
