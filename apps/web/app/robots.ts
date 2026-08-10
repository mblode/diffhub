import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config";

/**
 * Named explicitly rather than left to the wildcard. Several of these crawlers
 * are the ones that decide whether this zone can be quoted in an answer at all,
 * and an explicit allow removes any question about it.
 *
 * The footgun, and the reason this comment exists: robots.txt group matching is
 * most-specific-wins and does *not* inherit. Once an agent has its own group it
 * stops reading the `*` group entirely, so a `disallow` added below to `*`
 * silently will not apply to any agent in this list. Add new disallow rules to
 * both, or drop the named groups.
 */
const AI_AGENTS = [
  "Applebot-Extended",
  "CCBot",
  "ChatGPT-User",
  "Claude-User",
  "ClaudeBot",
  "GPTBot",
  "Google-Extended",
  "OAI-SearchBot",
  "PerplexityBot",
];

const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      allow: "/",
      userAgent: "*",
    },
    ...AI_AGENTS.map((userAgent) => ({
      allow: "/",
      userAgent,
    })),
  ],
  sitemap: `${siteConfig.url}/sitemap.xml`,
});

export default robots;
