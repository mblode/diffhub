import { expect, test } from "@playwright/test";

/**
 * Under Cache Components the live PR page streams its shell before `notFound()`
 * runs, which pins the status at 200. `proxy.ts` has to turn a bad PR URL into a
 * real 404 first. A malformed number never reaches GitHub, so this runs offline.
 */
test("a malformed live PR URL is a real 404", async ({ request }) => {
  const response = await request.get("/diffhub/a/b/pull/abc");
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain('name="robots" content="noindex"');
});
