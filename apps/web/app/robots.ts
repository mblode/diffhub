import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config";

/**
 * Two groups, because they grant two different things and a future editor may
 * well want one without the other.
 *
 * Named explicitly rather than left to the wildcard. The footgun, and the
 * reason this comment exists: robots.txt group matching is most-specific-wins
 * and does *not* inherit. Once an agent has its own group it stops reading the
 * `*` group entirely, so a `disallow` added below to `*` silently will not
 * apply to any agent named here. Add new disallow rules to every group, or drop
 * the named ones.
 */

/** Fetch and cite pages in answers. Allowing these is what makes the zone quotable. */
const ANSWER_ENGINES = [
  "ChatGPT-User",
  "Claude-User",
  "ClaudeBot",
  "GPTBot",
  "Google-Extended",
  "OAI-SearchBot",
  "PerplexityBot",
];

/**
 * Corpus crawlers, not answer engines: these govern whether the content is used
 * to train models, which is a separate decision from whether it can be cited.
 * Disallow these two and the group above still works.
 */
const TRAINING_CORPORA = ["Applebot-Extended", "CCBot"];

const AI_AGENTS = [...ANSWER_ENGINES, ...TRAINING_CORPORA];

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
