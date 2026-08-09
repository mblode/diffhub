import { expect, test } from "vitest";

import nextConfig from "./next.config.js";

/**
 * The vanity host used to match only `/:path*`, which captured an already-
 * prefixed `/diffhub/...` path and 308'd it to `/diffhub/diffhub/...` (404).
 * Search Console reports that as a Redirect error. Keep the basePath-prefixed
 * sources ahead of the catch-all.
 */
test("vanity host redirects do not double the basePath", async () => {
  const redirects = await nextConfig.redirects();
  const vanity = redirects.filter((r) => r.has?.[0]?.value === "diffhub.blode.co");

  expect(vanity.map((r) => r.source)).toEqual(["/diffhub", "/diffhub/:path*", "/", "/:path*"]);
  expect(vanity.map((r) => r.destination)).toEqual([
    "https://blode.co/diffhub",
    "https://blode.co/diffhub/:path*",
    "https://blode.co/diffhub",
    "https://blode.co/diffhub/:path*",
  ]);
});

test("doubled basePath paths heal to the canonical zone path", async () => {
  const redirects = await nextConfig.redirects();
  const heal = redirects.filter((r) => r.source.startsWith("/diffhub/diffhub"));

  expect(heal).toEqual([
    {
      basePath: false,
      destination: "/diffhub",
      permanent: true,
      source: "/diffhub/diffhub",
    },
    {
      basePath: false,
      destination: "/diffhub/:path*",
      permanent: true,
      source: "/diffhub/diffhub/:path*",
    },
  ]);
});
