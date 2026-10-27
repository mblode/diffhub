import type { MetadataRoute } from "next";

import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import { GUIDES } from "@/lib/guides";

/**
 * The /docs pages are deliberately absent. The docs platform publishes its own
 * sitemap at `/diffhub/docs/sitemap.xml` (proxied by
 * `app/docs/[[...slug]]/route.ts`), and blode.co's sitemap index lists it
 * beside this one. Listing them here too put every docs URL in two sitemaps,
 * with a hand-maintained copy that went stale whenever a docs page was added.
 */

/**
 * Date-only strings parse as UTC midnight. The `T00:00:00` form is local, and
 * drifts.
 *
 * An empty string means the changelog was empty, and `new Date("")` is an
 * Invalid Date that fails serialisation, so drop `lastModified` for that URL
 * instead. Omitting the field is legal in the sitemap protocol; emitting a
 * broken one is not.
 */
const on = (date: string) => (date ? new Date(date) : undefined);

const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "weekly",
    lastModified: on(latestDate(CHANGELOGS["/"])),
    priority: 1,
    url: siteConfig.url,
  },
  // Every guide, from the same list the landing page and llms.txt read, dated
  // by its own changelog rather than the build.
  ...GUIDES.map((entry) => ({
    changeFrequency: "monthly" as const,
    lastModified: on(latestDate(CHANGELOGS[entry.path])),
    priority: 0.8,
    url: `${siteConfig.url}${entry.path}`,
  })),
];

export default sitemap;
