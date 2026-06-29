import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config";

// Only canonical URLs served from this origin belong in the sitemap. The /docs
// routes are proxied from diffhub.blode.md and canonicalise to that origin, so
// they are intentionally excluded here and covered by the docs site's own sitemap.
const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "weekly",
    lastModified: new Date(),
    priority: 1,
    url: siteConfig.url,
  },
];

export default sitemap;
