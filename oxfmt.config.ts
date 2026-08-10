import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  extends: [ultracite],
  /**
   * Three files oxfmt must not touch, not three files anyone forgot to format.
   *
   * `docs-proxy.fixture.html` is captured upstream HTML that the docs-proxy
   * tests assert byte-for-byte: formatting it rewrites the asset paths the
   * tests exist to pin, so a "fix" here fails the suite instead.
   *
   * `.cmux/*.json` is tool state written by cmux, not source. It is rewritten
   * outside this repo's control, so formatting it just makes the gate red again
   * the next time cmux touches it.
   *
   * Both patterns are `**`-anchored rather than repo-relative: turbo runs
   * `oxfmt` with the workspace as its cwd, so `apps/web/lib/...` would match
   * from the repo root and nothing from `apps/web`.
   */
  ignorePatterns: ["**/docs-proxy.fixture.html", "**/.cmux/**"],
});
