import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  extends: [ultracite],
  /**
   * Same ignores as the root `oxfmt.config.ts`. Turbo runs `oxfmt` with this
   * package as cwd, so these patterns must live here too — a root-only ignore
   * never sees them when `@diffhub/web` formats itself.
   *
   * `**`-anchored rather than package-relative so either cwd still matches.
   */
  ignorePatterns: ["**/docs-proxy.fixture.html", "**/.cmux/**"],
});
