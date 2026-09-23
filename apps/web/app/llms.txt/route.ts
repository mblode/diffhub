import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import { GUIDES } from "@/lib/guides";

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
 * The zone root, then every guide from `lib/guides.ts`, the list the sitemap
 * and the landing page read too. A guide added there shows up here with its
 * own title, summary and changelog date.
 */
const PAGES: { path: keyof typeof CHANGELOGS; summary: string; title: string }[] = [
  {
    path: "/",
    summary:
      "DiffHub is a local git diff viewer for reviewing agent-written code, in a browser tab or a cmux split. It signals when files change, refreshes on demand, keeps inline comments beside the code, and copies those comments as one prompt for the next agent pass.",
    title: siteConfig.title,
  },
  ...GUIDES.map(({ path, summary, title }) => ({ path, summary, title })),
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

DiffHub is a local git diff viewer for agent code review. It is free and MIT
licensed, published on npm as \`diffhub\`, runs on localhost, and makes no
outbound requests. Written by Matthew Blode
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
 * Prerendered at build, matching `robots.txt` and `sitemap.xml`, because it
 * reads no request and no uncached data. Reading either would make it dynamic.
 */
export const GET = () =>
  new Response(body(), {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "content-type": "text/plain; charset=utf-8",
    },
  });
