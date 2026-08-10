import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

import { rewriteDocsHtml } from "./docs-proxy";

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
 * so nothing 404s and no crawler flags it. `/diffhub/llms.txt` is the other
 * tempting target and it is a 404: only the docs path publishes these two.
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

/**
 * Rule 9: every blode.co path says the person, and the docs platform says the
 * tenant's product name instead. Both copies have to move, and the assertion
 * that the old value is gone is the load-bearing half: the patterns are written
 * against the attribute order the upstream emits, so if that changes they stop
 * matching and rewrite nothing at all.
 */
test("og:site_name says the person, in the head and the flight payload", () => {
  const out = rewriteDocsHtml(FIXTURE);

  expect(out).toContain('<meta property="og:site_name" content="Matthew Blode"/>');
  expect(out).toContain('\\"property\\":\\"og:site_name\\",\\"content\\":\\"Matthew Blode\\"');
  expect(out).not.toContain('content="DiffHub"');
  expect(out).not.toContain('\\"og:site_name\\",\\"content\\":\\"DiffHub\\"');

  // The product still has to be named somewhere on the card, or swapping
  // site_name leaves it identifying nothing. Upstream puts it in the title.
  expect(out).toMatch(/<meta property="og:title" content="[^"]*DiffHub"/);
});

test.runIf(process.env.DOCS_PROXY_LIVE)(
  "the live docs origin still rewrites clean",
  async () => {
    const response = await fetch("https://diffhub.blode.md/docs");
    expect(response.ok).toBe(true);
    assertNothingEscapesTheZone(await response.text());
  },
  30_000,
);
