import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const visualOutputDir = join(__dirname, "..", "test-results", "visual");
const fixtureRepoPathFile = join(visualOutputDir, "fixture-repo-path");
const fixtureRepoPath = () => readFileSync(fixtureRepoPathFile, "utf-8");
const commentSelector = (id: string) =>
  `[data-testid="diffhub-comment-card"][data-comment-id="${id}"]`;

const getBox = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as NonNullable<typeof box>;
};

test.beforeAll(() => {
  expect(
    existsSync(fixtureRepoPathFile),
    `Expected visual fixture repo path file to exist at ${fixtureRepoPathFile}. The fixture webServer likely failed before writing it.`,
  ).toBeTruthy();
});

test("comments load quickly and render compactly", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#diff-container [data-file-section]").first()).toBeVisible({
    timeout: 15_000,
  });

  const normalCard = page.locator(commentSelector("comment-normal-alpha"));
  await expect(normalCard).toBeVisible({ timeout: 2000 });

  const normalBox = await getBox(normalCard);
  expect(normalBox.height).toBeLessThanOrEqual(88);

  const resolvedCard = page.locator(commentSelector("comment-resolved"));
  await expect(resolvedCard).toBeVisible();
  await expect(resolvedCard).toHaveAttribute("data-comment-expanded", "false");
  const resolvedBox = await getBox(resolvedCard);
  expect(resolvedBox.height).toBeLessThanOrEqual(40);

  const firstRepeatedCard = page.locator(commentSelector("comment-repeat-a"));
  const secondRepeatedCard = page.locator(commentSelector("comment-repeat-b"));
  await firstRepeatedCard.scrollIntoViewIfNeeded();
  await expect(firstRepeatedCard).toBeVisible();
  await expect(secondRepeatedCard).toBeVisible();
  const firstRepeated = await getBox(firstRepeatedCard);
  const secondRepeated = await getBox(secondRepeatedCard);
  const gap = secondRepeated.y - (firstRepeated.y + firstRepeated.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(8);

  await normalCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(visualOutputDir, "comments-compact.png") });
});

test("comment navigation waits for a collapsed deferred target without a second jump", async ({
  page,
}) => {
  const repoPath = fixtureRepoPath();
  await page.addInitScript(
    ({ collapsedFile, repo }) => {
      localStorage.setItem(`diffhub-collapsed:${repo}`, JSON.stringify([collapsedFile]));
    },
    { collapsedFile: "src/large.ts", repo: repoPath },
  );

  await page.goto("/");
  await expect(page.locator("#diff-container [data-file-section]").first()).toBeVisible({
    timeout: 15_000,
  });

  const targetId = "comment-large-deferred";
  await page.evaluate((id) => {
    const globalWindow = window as typeof window & {
      __diffhubAfterVisibleScrolls?: number[];
    };
    globalWindow.__diffhubAfterVisibleScrolls = [];

    let targetVisible = false;
    const isVisible = (element: Element | null): boolean => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const recordIfVisible = () => {
      const element = document.querySelector(
        `[data-testid="diffhub-comment-card"][data-comment-id="${id}"]`,
      );
      if (!targetVisible && isVisible(element)) {
        targetVisible = true;
        globalWindow.__diffhubAfterVisibleScrolls?.push(window.scrollY);
      }
    };

    const observer = new MutationObserver(recordIfVisible);
    observer.observe(document.body, {
      attributeFilter: ["class", "hidden", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    window.addEventListener(
      "scroll",
      () => {
        if (targetVisible) {
          globalWindow.__diffhubAfterVisibleScrolls?.push(window.scrollY);
        }
      },
      { passive: true },
    );
  }, targetId);

  await page.getByRole("button", { name: "Show comments" }).click();
  await page.locator(`[data-testid="diffhub-sidebar-comment"][data-comment-id="${targetId}"]`).click();

  const target = page.locator(commentSelector(targetId));
  await expect(target).toBeVisible({ timeout: 2000 });

  const viewportHeight = page.viewportSize()?.height ?? 720;
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox();
        const expectedCommentTop = box ? viewportHeight / 2 - box.height / 2 : 0;
        return box ? Math.abs(box.y - expectedCommentTop) : Number.POSITIVE_INFINITY;
      },
      { timeout: 2000 },
    )
    .toBeLessThanOrEqual(24);

  const changesAfterVisible = await page.evaluate(() => {
    const samples =
      ((window as typeof window & { __diffhubAfterVisibleScrolls?: number[] })
        .__diffhubAfterVisibleScrolls ?? []) as number[];
    let changes = 0;
    let previous = samples[0] ?? 0;
    for (const sample of samples.slice(1)) {
      if (Math.abs(sample - previous) <= 1) {
        previous = sample;
        continue;
      }
      changes += 1;
      previous = sample;
    }
    return changes;
  });

  // The target can become renderable before the delayed centering scroll fires,
  // so one multi-pixel post-visible change is the expected centering action.
  expect(changesAfterVisible).toBeLessThanOrEqual(1);

  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 1000 }).toBeLessThanOrEqual(1);
  await page
    .locator(`[data-testid="diffhub-sidebar-comment"][data-comment-id="${targetId}"]`)
    .click({ timeout: 2000 });
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox();
        const expectedCommentTop = box ? viewportHeight / 2 - box.height / 2 : 0;
        return box ? Math.abs(box.y - expectedCommentTop) : Number.POSITIVE_INFINITY;
      },
      { timeout: 2000 },
    )
    .toBeLessThanOrEqual(24);

  await page.screenshot({ path: join(visualOutputDir, "comments-navigation.png") });
});
