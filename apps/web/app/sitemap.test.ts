import { expect, test } from "vitest";

import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import { GUIDES } from "@/lib/guides";

import sitemap from "./sitemap";

/**
 * Two properties that have broken or nearly broken here: a guide that ships
 * without a sitemap entry, and `lastmod` stamped with the build time, which
 * tells Google the whole zone changed on every deploy.
 */
test("every guide is listed, dated by its changelog rather than the build", () => {
  const entries = sitemap();

  for (const entry of GUIDES) {
    const listed = entries.find((item) => item.url === `${siteConfig.url}${entry.path}`);
    expect(listed, entry.path).toBeDefined();
    expect(listed?.lastModified).toStrictEqual(new Date(latestDate(CHANGELOGS[entry.path])));
  }
});

test("every URL is on the canonical zone", () => {
  for (const item of sitemap()) {
    expect(item.url.startsWith("https://blode.co/diffhub")).toBe(true);
  }
});
