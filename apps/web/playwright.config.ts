import { defineConfig, devices } from "@playwright/test";

/**
 * Production-build e2e (`npm run test:instant`): instant navigation, and the
 * live PR viewer's 404 status. It runs against `next start`, so the build has
 * to expose the testing API that `@next/playwright`'s `instant()` drives: the
 * script builds with `NEXT_EXPOSE_TESTING_API=1` first. A normal production
 * build never has it.
 *
 * Unit tests stay in vitest; `vitest.config.ts` excludes `e2e/`.
 */
const PORT = 3217;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "e2e",
  use: {
    // Origin only: every path in the tests carries the `/diffhub` basePath.
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `next start -p ${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    url: `http://localhost:${PORT}/diffhub`,
  },
});
