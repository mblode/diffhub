import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config";

const robots = (): MetadataRoute.Robots => ({
  rules: {
    allow: "/",
    userAgent: "*",
  },
  sitemap: `${siteConfig.url}/sitemap.xml`,
});

export default robots;
