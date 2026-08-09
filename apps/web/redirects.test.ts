import { expect, test } from "vitest";

import nextConfig from "./next.config.js";

type Rule = Awaited<ReturnType<NonNullable<typeof nextConfig.redirects>>>[number];

/**
 * Next resolves redirects first-match-wins, which is the whole bug: a bare
 * `/:path*` on the vanity host swallowed already-prefixed `/diffhub/...` paths
 * and 308'd them to `/diffhub/diffhub/...` — a 404, which Search Console
 * reports as a Redirect error. Asserting the rule array's shape would only
 * restate the config, so resolve a request through it instead.
 *
 * Models the two source shapes this config uses: an exact path, and a
 * `/:path*` tail (which also matches the bare prefix, as path-to-regexp does).
 */
const resolve = (rules: Rule[], host: string, path: string) => {
  for (const rule of rules) {
    if (rule.has?.some((h) => h.type !== "host" || h.value !== host)) {
      continue;
    }
    const [prefix, ...wildcard] = rule.source.split("/:path*");
    if (wildcard.length === 0) {
      if (path === rule.source) {
        return rule.destination;
      }
      continue;
    }
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const tail = path.slice(prefix.length).replace(/^\//, "");
      return rule.destination.replace("/:path*", tail ? `/${tail}` : "");
    }
  }
};

const resolver = async (host: string) => {
  const rules = (await nextConfig.redirects?.()) ?? [];
  return (path: string) => resolve(rules, host, path);
};

test("the vanity host redirects onto the canonical zone path", async () => {
  const at = await resolver("diffhub.blode.co");

  // The regression: an already-prefixed path must not gain a second /diffhub.
  expect(at("/diffhub/cmux-git-diff")).toBe("https://blode.co/diffhub/cmux-git-diff");
  expect(at("/diffhub")).toBe("https://blode.co/diffhub");
  // Bare paths still pick the prefix up.
  expect(at("/cmux-git-diff")).toBe("https://blode.co/diffhub/cmux-git-diff");
  expect(at("/")).toBe("https://blode.co/diffhub");
});

test("doubled paths already crawled heal to the canonical zone path", async () => {
  const at = await resolver("blode.co");

  expect(at("/diffhub/diffhub/cmux-git-diff")).toBe("/diffhub/cmux-git-diff");
  expect(at("/diffhub/diffhub")).toBe("/diffhub");
  // Real pages on the canonical host are left alone.
  expect(at("/diffhub/cmux-git-diff")).toBeUndefined();
  expect(at("/diffhub")).toBeUndefined();
});
