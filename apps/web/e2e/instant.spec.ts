import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

/**
 * What must be on screen the moment a navigation starts, before anything
 * dynamic streams in. `instant()` holds dynamic content back for the length of
 * the callback, so every assertion inside it runs against the static shell (a
 * page load) or the prefetched App Shell (a client navigation).
 *
 * The routes are the landing page and the guides it links to. They carry
 * `export const instant = true`, so dev also flags a regression as it happens.
 */

const HOME = "/diffhub";

test.describe("landing page (/diffhub)", () => {
  test("is instant on an initial page load", async ({ page, baseURL }) => {
    await instant(
      page,
      async () => {
        await page.goto(HOME);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Review agent code in cmux",
        );
        await expect(page.getByRole("navigation", { name: "Guides" })).toBeVisible();
      },
      { baseURL },
    );
  });

  test("navigates instantly to a guide from the Guides row", async ({ page }) => {
    await page.goto(HOME);
    const guides = page.getByRole("navigation", { name: "Guides" });
    await instant(page, async () => {
      await guides.getByRole("link", { name: "Git diff viewer" }).click();
      await page.waitForURL((url) => url.pathname === `${HOME}/git-diff-viewer`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "A git diff viewer for your whole branch",
      );
    });
  });
});

test.describe("guide cross-links", () => {
  test("navigates instantly from one guide to another", async ({ page }) => {
    await page.goto(`${HOME}/git-diff-viewer`);
    await instant(page, async () => {
      await page
        .getByRole("main")
        .getByRole("link", { exact: true, name: "How to review AI-generated code" })
        .click();
      await page.waitForURL((url) => url.pathname === `${HOME}/review-ai-generated-code`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "How to review AI-generated code before you merge it",
      );
    });
  });

  test("navigates instantly back to the landing page", async ({ page }) => {
    await page.goto(`${HOME}/cmux-git-diff`);
    await instant(page, async () => {
      await page.getByRole("banner").getByRole("link", { exact: true, name: "DiffHub" }).click();
      await page.waitForURL((url) => url.pathname === HOME);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review agent code in cmux");
    });
  });
});
