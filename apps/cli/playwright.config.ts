import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.DIFFHUB_VISUAL_PORT ?? 4301);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  expect: {
    timeout: 2000,
  },
  fullyParallel: false,
  outputDir: "test-results/visual/artifacts",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 1,
        viewport: { height: 720, width: 1280 },
      },
    },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/visual/report" }]],
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on",
    video: "retain-on-failure",
  },
  webServer: {
    command: [
      "node ./e2e/fixture.mjs",
      `DIFFHUB_REPO="$(cat ./test-results/visual/fixture-repo-path)" DIFFHUB_DISABLE_WATCH=1 next dev --hostname 127.0.0.1 --port ${PORT}`,
    ].join(" && "),
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
});
