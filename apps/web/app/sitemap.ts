import type { MetadataRoute } from "next";

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

const sitemap = (): MetadataRoute.Sitemap => {
  const lastModified = new Date();

  return [
    {
      changeFrequency: "weekly",
      lastModified,
      priority: 1,
      url: siteConfig.url,
    },
    {
      changeFrequency: "monthly",
      lastModified,
      priority: 0.8,
      url: `${siteConfig.url}/cmux-git-diff`,
    },
    {
      changeFrequency: "monthly",
      lastModified,
      priority: 0.8,
      url: `${siteConfig.url}/review-ai-generated-code`,
    },
    ...DOCS_PATHS.map((path) => ({
      changeFrequency: "monthly" as const,
      lastModified,
      priority: 0.8,
      url: `${siteConfig.url}${path}`,
    })),
  ];
};

export default sitemap;
