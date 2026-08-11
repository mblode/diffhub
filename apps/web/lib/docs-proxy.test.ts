import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import { proxyDocsRequest, rewriteDocsHtml, toUpstreamPath } from "./docs-proxy";

/**
 * `docs-proxy.fixture.html` is a snapshot of https://diffhub.blode.md/docs taken
 * on 2026-07-29, not a live fetch, so this runs offline and deterministically.
 *
 * Know what that buys and what it does not. It catches us breaking the rewrite.
 * It cannot catch the platform renaming its asset prefix again, which is the
 * thing that broke these docs once already: the snapshot keeps the old shape and
 * keeps passing while production breaks. Refresh the fixture when the docs
 * origin changes, and run the live check below after any blode.md change:
 *
 *   DOCS_PROXY_LIVE=1 npm run test --workspace @diffhub/web
 */
const FIXTURE = readFileSync(path.join(import.meta.dirname, "docs-proxy.fixture.html"), "utf-8");

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Root-absolute `href`/`src` values, including the escaped flight-payload form. */
const rootAbsoluteUrls = (html: string): string[] =>
  [...html.matchAll(/(?:href|src)=\\?"(\/[^/"\\][^"\\]*)/gu)].map((m) => m[1]);

const assertNothingEscapesTheZone = (html: string) => {
  const out = rewriteDocsHtml(html);
  const escaping = rootAbsoluteUrls(out).filter((url) => !url.startsWith("/diffhub"));
  expect(escaping).toEqual([]);
  return out;
};

test("no root-absolute URL survives the rewrite outside the zone", () => {
  assertNothingEscapesTheZone(FIXTURE);
});

/**
 * The blunt assertion above passes for any `/diffhub` prefix, so it would not
 * notice the docs head being repointed at another wrong URL. That is what the
 * bug did: it sent a docs page to the ROOT site's llms.txt, which answers 200,
 * so nothing 404s and no crawler flags it.
 *
 * `/diffhub/llms.txt` is the other tempting target, and it no longer 404s:
 * `app/llms.txt/route.ts` serves the marketing zone's own index. It is still
 * the wrong target. That file describes the three marketing pages; a docs page
 * has to advertise the docs index, which is what the platform publishes at
 * `/diffhub/docs/llms.txt`. Two real files covering different content, so the
 * rewrite stays pointed at the docs one and this test stays as it is.
 */
test("the llms files point at the docs index", () => {
  const out = rewriteDocsHtml(FIXTURE);

  for (const name of ["llms.txt", "llms-full.txt"]) {
    expect(out).toContain(`href="/diffhub/docs/${name}"`);
    expect(out).not.toContain(`href="/${name}"`);
    expect(out).not.toContain(`href="/diffhub/${name}"`);
    // The copy React carries in the flight payload has to move as well, or a
    // client-side navigation restores the old metadata.
    expect(out).toContain(`\\"href\\":\\"/diffhub/docs/${name}`);
    expect(out).not.toContain(`\\"href\\":\\"/${name}`);
  }
});

test("asset URLs round-trip through a routable public segment", () => {
  const out = rewriteDocsHtml(FIXTURE);
  const publicUrl = rootAbsoluteUrls(out).find((url) => url.includes("/_chunks/"));

  expect(publicUrl).toBeDefined();
  expect(publicUrl).not.toContain("_next");
  expect(publicUrl).toContain("/diffhub/docs/_chunks/static/");

  const slug = (publicUrl as string).replace("/diffhub/docs/", "").split("/");
  expect(toUpstreamPath(slug)).toBe(`/_docs/_next/${slug.slice(1).join("/")}`);
});

test("docs HTML cannot remain cached across deployments", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(FIXTURE, {
          headers: {
            "cdn-cache-control": "public, s-maxage=3600",
            "content-type": "text/html",
          },
        }),
      ),
    ),
  );

  const response = await proxyDocsRequest(new Request("https://blode.co/diffhub/docs"), []);

  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("cdn-cache-control")).toBeNull();
});

test("immutable docs chunks retain upstream caching", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response("body {}", {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": "text/css",
          },
        }),
      ),
    ),
  );

  const response = await proxyDocsRequest(
    new Request("https://blode.co/diffhub/docs/_chunks/static/app.css"),
    ["_chunks", "static", "app.css"],
  );

  expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
});

/**
 * Rule 9 / card image now come from `apps/docs/docs.json` (`seo.siteName`,
 * `metadata.ogImage`). The proxy must pass upstream `og:site_name` through
 * unchanged rather than patching it.
 */
test("og:site_name passes through from upstream", () => {
  const out = rewriteDocsHtml(FIXTURE);
  const head = [
    ...FIXTURE.matchAll(/<meta[^>]+property="og:site_name"[^>]+content="([^"]*)"/g),
  ].map((m) => m[1]);
  const outHead = [...out.matchAll(/<meta[^>]+property="og:site_name"[^>]+content="([^"]*)"/g)].map(
    (m) => m[1],
  );
  expect(outHead).toEqual(head);
});

/**
 * Rule 10. The platform emits no `twitter:creator`, so this is an injection,
 * and both copies matter. Anchored on `twitter:card`, so the assertion that the
 * count is exactly one is what catches the anchor moving or the guard failing.
 */
const assertCreatorInjected = (out: string) => {
  expect(out).toContain('<meta name="twitter:creator" content="@mattblode"/>');
  expect(out).toContain('\\"name\\":\\"twitter:creator\\",\\"content\\":\\"@mattblode\\"');
  // Exactly one of each: injecting twice would ship a duplicate tag.
  expect(out.match(/<meta name="twitter:creator"/gu)).toHaveLength(1);
};

test("twitter:creator is injected into the head and the flight payload", () => {
  assertCreatorInjected(rewriteDocsHtml(FIXTURE));
});

/** Running it over its own output must not add a second tag. */
test("injecting twitter:creator is idempotent", () => {
  assertCreatorInjected(rewriteDocsHtml(rewriteDocsHtml(FIXTURE)));
});

/**
 * Card image rewrite retired: `metadata.ogImage` in docs.json owns the zone
 * product card. The proxy must not retarget absolute card URLs.
 */
test("the proxy does not rewrite absolute card image URLs", () => {
  const seeded = FIXTURE.includes("https://blode.co/opengraph-image.png")
    ? FIXTURE
    : FIXTURE.replace(
        "</head>",
        '<meta property="og:image" content="https://blode.co/opengraph-image.png"/></head>',
      );
  const out = rewriteDocsHtml(seeded);
  expect(out).toContain("https://blode.co/opengraph-image.png");
  expect(out).not.toContain("https://blode.co/diffhub/opengraph-image");
});

test.runIf(process.env.DOCS_PROXY_LIVE)(
  "the live docs origin still rewrites clean",
  async () => {
    const response = await fetch("https://diffhub.blode.md/docs");
    expect(response.ok).toBe(true);
    const html = await response.text();
    const out = rewriteDocsHtml(html);
    assertCreatorInjected(out);
    assertNothingEscapesTheZone(html);
    const upstream = [
      ...html.matchAll(/<meta[^>]+property="og:site_name"[^>]+content="([^"]*)"/g),
    ].map((m) => m[1]);
    const rewritten = [
      ...out.matchAll(/<meta[^>]+property="og:site_name"[^>]+content="([^"]*)"/g),
    ].map((m) => m[1]);
    expect(rewritten).toEqual(upstream);
  },
  30_000,
);
