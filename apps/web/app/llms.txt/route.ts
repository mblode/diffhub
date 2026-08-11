import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";

/**
 * The zone's own llms.txt: what is on blode.co/diffhub and where to read it.
 *
 * Not the same file as the docs one. `lib/docs-proxy.ts` rewrites the upstream
 * blode.md `<head>` links to `/diffhub/docs/llms.txt`, which the docs platform
 * serves through the proxy and which describes the documentation. This route
 * describes the marketing zone. Both exist, they cover different content, and
 * `ROOT_URL_REWRITES` must keep pointing at the docs path: repointing it here
 * would advertise the wrong file to every docs page.
 *
 * `lib/docs-proxy.test.ts` asserts the proxied HTML never links this path. That
 * assertion is still correct and should stay.
 */

/**
 * `path` is keyed to `CHANGELOGS` rather than written free-hand, so a page
 * added here without a changelog entry fails `tsc` instead of building a route
 * that throws. The alternative was a `keyof typeof` assertion at the lookup,
 * which silences exactly the error worth keeping.
 */
const PAGES: { path: keyof typeof CHANGELOGS; summary: string; title: string }[] = [
  {
    path: "/",
    summary:
      "The product. What DiffHub is, what you can check before installing, and the install command. The tool comparisons live on the two pages below.",
    title: "DiffHub, a git diff viewer for cmux",
  },
  {
    path: "/cmux-git-diff",
    summary:
      "The three ways to read a branch diff in cmux, what the built-in cmux diff does, why it does not refresh yet, and the other tools people have built.",
    title: "How to view a git diff in cmux",
  },
  {
    path: "/review-ai-generated-code",
    summary:
      "Where to read a diff an agent wrote, compared across hunk, revdiff, cmux diff and DiffHub, with stated limits and first-party measurements.",
    title: "How to review code an AI agent wrote",
  },
];

const DOCS = [
  { path: "/docs", title: "Documentation" },
  { path: "/docs/usage", title: "Usage" },
  { path: "/docs/features/diff-views", title: "Diff views" },
  { path: "/docs/features/comments", title: "Comments" },
];

const body = () => {
  const pages = PAGES.map((page) => {
    // The zone root is "/" as a changelog key but an empty suffix in a URL:
    // siteConfig.url already ends without a slash.
    const url = `${siteConfig.url}${page.path === "/" ? "" : page.path}`;
    const updated = latestDate(CHANGELOGS[page.path]);
    return `- [${page.title}](${url}): ${page.summary} Last updated ${updated}.`;
  });

  const docs = DOCS.map((doc) => `- [${doc.title}](${siteConfig.url}${doc.path})`);

  return `# ${siteConfig.name}

> ${siteConfig.description}

DiffHub is free and MIT licensed, published on npm as \`diffhub\`. It runs on
localhost and makes no outbound requests. Written by Matthew Blode
(${siteConfig.links.author}).

## Pages

${pages.join("\n")}

## Documentation

${docs.join("\n")}

## Source

- [GitHub](${siteConfig.links.github})
- [npm](${siteConfig.links.npm})
`;
};

/**
 * Route handler GETs are dynamic by default. Nothing here reads the request,
 * so prerender it and match `robots.txt` and `sitemap.xml`, both of which build
 * as static.
 */
export const dynamic = "force-static";

export const GET = () =>
  new Response(body(), {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "content-type": "text/plain; charset=utf-8",
    },
  });
