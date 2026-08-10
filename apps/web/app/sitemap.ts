import type { MetadataRoute } from "next";

import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";

/**
 * The /docs routes are proxied from diffhub.blode.md by
 * `app/docs/[[...slug]]/route.ts`, but they canonicalise to *this* origin —
 * `/diffhub/docs` is self-canonical, not pointing back at blode.md. They are
 * therefore indexable URLs served from here and belong in this sitemap; an
 * earlier comment claimed the opposite, which left them in no sitemap at all.
 *
 * Keep in sync with `navigation.groups[].pages` in `apps/docs/docs.json`,
 * which is what the docs platform renders. Deliberately not imported: nothing
 * else in this app reaches across into `apps/docs`, and the web app is
 * deployed standalone.
 */
const DOCS_PATHS = ["/docs", "/docs/usage", "/docs/features/diff-views", "/docs/features/comments"];

/**
 * Hand-maintained alongside `DOCS_PATHS`, for the same reason: the content is
 * in `apps/docs` and this app cannot see it. A date that is stale but true
 * beats the `new Date()` this file used to hand every URL, which told Google
 * the whole site changed on every crawl and trains it to ignore `lastmod`.
 */
const DOCS_UPDATED = "2026-07-29";

/** Date-only strings parse as UTC midnight. The `T00:00:00` form is local, and drifts. */
const on = (date: string) => new Date(date);

const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "weekly",
    lastModified: on(latestDate(CHANGELOGS["/"])),
    priority: 1,
    url: siteConfig.url,
  },
  {
    changeFrequency: "monthly",
    lastModified: on(latestDate(CHANGELOGS["/cmux-git-diff"])),
    priority: 0.8,
    url: `${siteConfig.url}/cmux-git-diff`,
  },
  {
    changeFrequency: "monthly",
    lastModified: on(latestDate(CHANGELOGS["/review-ai-generated-code"])),
    priority: 0.8,
    url: `${siteConfig.url}/review-ai-generated-code`,
  },
  ...DOCS_PATHS.map((path) => ({
    changeFrequency: "monthly" as const,
    lastModified: on(DOCS_UPDATED),
    priority: 0.8,
    url: `${siteConfig.url}${path}`,
  })),
];

export default sitemap;
