import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { CopyButton } from "@/components/ui/copy-button";
import { siteConfig } from "@/lib/config";
import { schemaId, zoneGraph } from "@/lib/schema";

/**
 * Deliberately a Server Component. The homepage is `"use client"` for its
 * motion wrappers; this page is prose whose whole job is to be read by a
 * crawler, so it must render its content on the server. Don't import the
 * motion helpers here.
 *
 * Written in the blog register: three noun-phrase headings, one list, one
 * command block, contractions on, curly apostrophes. Keep it that way.
 */

const PATH = "/cmux-git-diff";
const url = `${siteConfig.url}${PATH}`;

/**
 * Version-bound claims, checked against cmux's public changelog. Re-check
 * before editing: the two open issues cited below are the ones most likely to
 * close and make this page wrong.
 */
const CMUX_VERSION = "v0.64.20";

const title = "How to view a git diff in cmux";
const description =
  "cmux has its own git diff viewer, and there's git diff in a pane, and there's a browser split that refreshes while you work. What each one is good for.";

// Declaring `openGraph` here replaces the layout's block rather than merging
// into it, so everything the card needs has to be repeated: the image, and the
// siteName. Miss the latter and this page's card says who made it nowhere,
// while the zone root says it correctly. zone-conventions.md Rule 9.
// Extensionless: the card is `app/opengraph-image.tsx`. Path without
// `/diffhub`: `metadataBase` already carries the zone.
const cardImage = "/opengraph-image";

export const metadata: Metadata = {
  alternates: { canonical: url },
  description,
  openGraph: {
    description,
    images: [{ alt: title, height: 630, url: cardImage, width: 1200 }],
    // The title carries "| DiffHub", so the card still names the product with
    // the person in siteName. Rule 9 warns about doing this the other way.
    siteName: "Matthew Blode",
    title: `${title} | ${siteConfig.name}`,
    type: "article",
    url,
  },
  // Bare: the root layout's `title.template` appends " | DiffHub".
  title,
  // Same mechanism as `openGraph` above: declaring `twitter` replaces the
  // layout's block wholesale, so `creator` has to be restated here or the card
  // credits nobody. That is how it went missing along with the image and the
  // siteName.
  twitter: {
    card: "summary_large_image",
    creator: "@mattblode",
    description,
    images: [cardImage],
    title: `${title} | ${siteConfig.name}`,
  },
};

/**
 * One script, one `@graph`. Two separate `ld+json` blocks describe two
 * unrelated things: the article and the trail cannot be merged into a single
 * entity unless a crawler sees them in the same graph.
 *
 * The breadcrumb starts at the blode.co root, not at this zone. A trail
 * beginning at blode.co/diffhub tells crawlers the zone is its own site.
 */
const pageJsonLd = zoneGraph({
  nodes: [
    {
      "@type": "TechArticle",
      author: { "@id": schemaId.person },
      description,
      headline: title,
      isPartOf: { "@id": schemaId.website },
      mainEntityOfPage: url,
      publisher: { "@id": schemaId.organization },
      url,
    },
  ],
  trail: [{ name: title, url }],
});

const alternatives = [
  {
    href: "https://github.com/azu/cmux-hub",
    name: "cmux-hub",
    note: "inline review comments, commit history, GitHub PR status",
  },
  {
    href: "https://github.com/sinozu/cmux-git-diff",
    name: "cmux-git-diff",
    note: "a single Go binary, staged and unstaged tabs, live reload",
  },
  {
    href: "https://github.com/jaequery/cmux-diff",
    name: "cmux-diff",
    note: "Shiki highlighting and commit message suggestions",
  },
  {
    href: "https://github.com/umputun/revdiff",
    name: "revdiff",
    note: "a TUI, if you’d rather not leave the pane at all",
  },
];

const link = "text-link transition-colors hover:text-link/90";
const body = "mt-4 text-pretty text-muted-foreground";
const heading = "mt-16 text-2xl font-medium tracking-tight";

export default function CmuxGitDiffPage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      <article className="@container py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          {/* `title`, not the old short "Git diff in cmux". The visible leaf
              has to be the same string the JSON-LD declares, and those two
              disagreed here. zone-conventions.md Rule 4. */}
          <ZoneBreadcrumb page={title} product="DiffHub" />

          <h1 className="mt-6 text-balance text-4xl font-medium tracking-tight sm:text-5xl sm:tracking-[-0.03em]">
            {title}
          </h1>

          <p className="mt-6 text-pretty text-lg text-muted-foreground">
            cmux has shipped its own diff viewer since June. I&rsquo;d already built one.
          </p>
          <p className={body}>
            So there are three ways to do this now, and which one you want comes down to how big the
            branch is.
          </p>

          <h2 className={heading}>The built-in viewer</h2>
          <p className={body}>
            Run <code className="font-mono text-sm">cmux diff</code> and you get a searchable
            branch-base picker, syntax highlighting on changed lines, and review comments that
            persist per repo. The picker landed in {CMUX_VERSION} in July. The comments landed back
            in v0.64.15, in June.
          </p>
          <p className={body}>
            It isn&rsquo;t in the published{" "}
            <a
              className={link}
              href="https://cmux.com/docs/api"
              rel="noopener noreferrer"
              target="_blank"
            >
              CLI reference
            </a>
            , so it&rsquo;s easy to conclude it doesn&rsquo;t exist. It does. And if you&rsquo;ve
            seen <code className="font-mono text-sm">--staged</code> or{" "}
            <code className="font-mono text-sm">--unstaged</code> flags described for it, those
            belong to other tools: the AI summaries have been attributing them to the wrong command.
          </p>
          <p className={body}>
            For a quick pass over what an agent just changed, it&rsquo;s the fastest thing available
            and it costs nothing to install.
          </p>

          <h2 className={heading}>The refresh gap</h2>
          <p className={body}>
            It doesn&rsquo;t watch the filesystem yet, and it opens in a fixed pane wherever you ran
            it from. Both are open issues,{" "}
            <a
              className={link}
              href="https://github.com/manaflow-ai/cmux/issues/7101"
              rel="noopener noreferrer"
              target="_blank"
            >
              #7101
            </a>{" "}
            and{" "}
            <a
              className={link}
              href="https://github.com/manaflow-ai/cmux/issues/7102"
              rel="noopener noreferrer"
              target="_blank"
            >
              #7102
            </a>
            . So the loop where you read a diff, fix something, and want to see the fix still means
            reopening it.
          </p>
          <p className={body}>
            That&rsquo;s the gap{" "}
            <Link className={link} href="/">
              DiffHub
            </Link>{" "}
            sits in.
          </p>
          <code className="my-4 flex w-fit items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-sm text-muted-foreground">
            <span>npx diffhub@latest cmux</span>
            <CopyButton content="npx diffhub@latest cmux" />
          </code>
          <p className={body}>
            It opens in a browser split, compares against the detected base branch, usually{" "}
            <code className="font-mono text-sm">origin/main</code>, and refreshes while you keep
            editing. There&rsquo;s a split and unified toggle, a filterable file sidebar with
            per-file <code className="font-mono text-sm">+</code> and{" "}
            <code className="font-mono text-sm">-</code> counts, and right-click to open a file in
            Zed, VS Code, Terminal, or Finder. It runs in an ordinary browser tab too, which a
            viewer built into a terminal can&rsquo;t.
          </p>
          <p className={body}>
            If you only want to answer one question, skip all of it and run{" "}
            <code className="font-mono text-sm">git diff main...HEAD</code> in a pane. The three-dot
            form diffs from the merge base, so you see what the branch introduced rather than every
            difference between two tips.
          </p>

          <h2 className={heading}>The other tools</h2>
          <p className={body}>
            A few people have built for this, and they make different trade-offs.
          </p>
          <ul className={`${body} space-y-2`}>
            {alternatives.map((tool) => (
              <li key={tool.name}>
                <a className={link} href={tool.href} rel="noopener noreferrer" target="_blank">
                  {tool.name}
                </a>
                , {tool.note}.
              </li>
            ))}
          </ul>
          <p className={body}>
            Turns out what separates them isn&rsquo;t the diff rendering. It&rsquo;s whether the
            view keeps up with you while you work.
          </p>
          <p className={body}>
            Widen it past cmux and the field is bigger.{" "}
            <Link className={link} href="/review-ai-generated-code">
              How to review code an AI agent wrote
            </Link>{" "}
            compares these against hunk and revdiff, and says which one to pick.
          </p>
          <p className={body}>
            cmux will probably close that gap. Until then I&rsquo;ve got a tab open.
          </p>
        </div>
      </article>
    </div>
  );
}
