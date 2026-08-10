import type { Metadata } from "next";
import Link from "next/link";

import { AuthorByline } from "@/components/shared/author-byline";
import { FaqSection } from "@/components/shared/faq-section";
import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { CopyButton } from "@/components/ui/copy-button";
import { CHANGELOGS, firstDate, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { schemaId, zoneGraph } from "@/lib/schema";

/**
 * Deliberately a Server Component. The homepage is `"use client"` for its
 * motion wrappers; this page is prose whose whole job is to be read by a
 * crawler, so it must render its content on the server. Don't import the
 * motion helpers here.
 *
 * Voice is the blog register: contractions on, curly apostrophes, one command
 * block. The headings are questions, which is a change from the noun phrases
 * this page shipped with: each section now answers one thing a reader would
 * type, so an extractor can lift a section without the ones around it.
 */

const PATH = "/cmux-git-diff";
const url = `${siteConfig.url}${PATH}`;

/**
 * Version-bound claims, checked against cmux's public changelog. Re-check
 * before editing: the two open issues cited below are the ones most likely to
 * close and make this page wrong.
 */
const CMUX_VERSION = "v0.64.20";

/** The date the star counts and issue states in this page were last read. */
const CHECKED = "2026-08-10";

const CHANGELOG = CHANGELOGS[PATH];
const publishedAt = firstDate(CHANGELOG) || CHECKED;
const updatedAt = latestDate(CHANGELOG) || publishedAt;

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
const faqs: Faq[] = [
  {
    answer: `Not yet. Live reload is cmux issue #7101, and opening the viewer in a pane you choose is #7102. Both were still open on ${CHECKED}.`,
    question: "Does cmux diff refresh automatically while you edit?",
  },
  {
    answer:
      "Not in the published CLI reference at cmux.com/docs/api, which is why people conclude it doesn’t exist. It does. Any `--staged` or `--unstaged` flags you’ve seen described for it belong to other tools.",
    question: "Is cmux diff documented?",
  },
  {
    answer:
      "Two dots compares the two branch tips. Three dots compares from the merge base, so you see what your branch introduced rather than everything that has landed on main since you started. Three dots is almost always the one you want.",
    // Plain text, no backticks. Only answers are parsed for inline code, and
    // schema.org types Question.name as plain text too, so a backtick in a
    // question renders as a literal backtick in both places.
    question: "What is the difference between two dots and three dots in git diff?",
  },
  {
    answer: `Yes. \`git diff main...HEAD\` in a pane costs nothing, and \`cmux diff\` ships with cmux itself from ${CMUX_VERSION} onwards. Neither needs an install.`,
    question: "Can you review a branch in cmux without installing anything?",
  },
];

const pageJsonLd = zoneGraph({
  faqs,
  nodes: [
    {
      "@type": "TechArticle",
      author: { "@id": schemaId.person },
      // Absent until now, on a page that makes version-bound claims. An
      // article with no dates gives a reader no way to judge whether the cmux
      // version it cites is current, and gives a model no reason to prefer it
      // over a stale copy of the same claim.
      dateModified: updatedAt,
      datePublished: publishedAt,
      description,
      headline: title,
      isPartOf: { "@id": schemaId.website },
      mainEntityOfPage: url,
      publisher: { "@id": schemaId.organization },
      url,
    },
  ],
  page: { description, name: title, url },
  trail: [{ name: title, url }],
  updatedAt,
});

/**
 * `language` and `stars` come from each repository's GitHub metadata, read on
 * CHECKED. They are here because they are the two things about a small tool a
 * reader can verify in one click, and because a comparison table where the
 * author's own project has the second-lowest star count is a table doing its
 * job. Re-read them if you touch this page; a stale count is a wrong claim.
 */
const alternatives = [
  {
    href: "https://github.com/azu/cmux-hub",
    language: "TypeScript",
    name: "cmux-hub",
    note: "Inline review comments, commit history, GitHub PR status",
    stars: "40",
  },
  {
    href: "https://github.com/sinozu/cmux-git-diff",
    language: "Go",
    name: "cmux-git-diff",
    note: "A single Go binary, staged and unstaged tabs, live reload",
    stars: "6",
  },
  {
    href: "https://github.com/jaequery/cmux-diff",
    language: "TypeScript",
    name: "cmux-diff",
    note: "Shiki highlighting and commit message suggestions",
    stars: "4",
  },
  {
    href: "https://github.com/umputun/revdiff",
    language: "Go",
    name: "revdiff",
    note: "A TUI, if you’d rather not leave the pane at all",
    stars: "760",
  },
  {
    href: "/",
    language: "TypeScript",
    name: "DiffHub",
    note: "A browser split that refreshes while you keep editing",
    stars: "19",
  },
];

const link = "text-link transition-colors hover:text-link/90";
const body = "mt-4 text-pretty text-muted-foreground";
const heading = "mt-16 text-2xl font-medium tracking-tight";
const cell = "border-border/60 border-b py-3 pr-6 align-top";

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

          <AuthorByline updated={updatedAt} />

          {/* The answer block: the first extractable passage answers the h1.
              The "I'd already built one" line is the better sentence but the
              worse opener, so it now opens the first section instead. */}
          <p className="mt-6 text-pretty text-lg text-muted-foreground">
            There are three ways to read a branch diff in cmux. Run{" "}
            <code className="font-mono text-sm">cmux diff</code> for the built-in viewer,{" "}
            <code className="font-mono text-sm">git diff main...HEAD</code> in a pane for a quick
            answer, or <code className="font-mono text-sm">npx diffhub@latest cmux</code> for a
            browser split that refreshes while you keep editing. Which you want comes down to how
            big the branch is, and whether it&rsquo;s still moving.
          </p>

          <h2 className={heading}>What does cmux diff actually do?</h2>
          <p className={body}>
            cmux has shipped its own diff viewer since June. I&rsquo;d already built one.
          </p>
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

          <h2 className={heading}>Why doesn&rsquo;t cmux diff refresh while you edit?</h2>
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
          <h2 className={heading}>When should you use DiffHub instead?</h2>
          <p className={body}>
            Use DiffHub when the branch is still moving. That&rsquo;s the gap{" "}
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

          <h2 className={heading}>What are the alternatives to cmux diff?</h2>
          <p className={body}>
            A few people have built for this, and they make different trade-offs. Star counts are
            the crudest possible signal, and they are here anyway, because they are the one number
            on this table you can check in a click.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Diff viewers for cmux, with GitHub language and star count read {CHECKED}
              </caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th className={`${cell} font-medium`} scope="col">
                    Tool
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    Written in
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    Stars
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    What it adds
                  </th>
                </tr>
              </thead>
              <tbody>
                {alternatives.map((tool) => (
                  <tr key={tool.name}>
                    <th className={`${cell} font-normal`} scope="row">
                      {tool.href.startsWith("/") ? (
                        <Link className={link} href={tool.href}>
                          {tool.name}
                        </Link>
                      ) : (
                        <a
                          className={link}
                          href={tool.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {tool.name}
                        </a>
                      )}
                    </th>
                    <td className={cell}>{tool.language}</td>
                    <td className={`${cell} tabular-nums`}>{tool.stars}</td>
                    <td className={cell}>{tool.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Language and star counts read from each repository on {CHECKED}.
          </p>
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

          <h2 className={heading}>What else do people ask about git diffs in cmux?</h2>
          <FaqSection
            answerClassName={body}
            faqs={faqs}
            questionClassName="mt-8 font-medium text-lg tracking-tight"
          />

          {/* Not a question, on purpose. See the sibling page: forcing an
              interrogative onto a two-entry list reads as a filled-in
              template. */}
          <h2 className={heading}>Changelog</h2>
          <ul className={`${body} space-y-2`}>
            {CHANGELOG.map((entry) => (
              <li key={entry.date}>
                <time className="font-mono text-sm" dateTime={entry.date}>
                  {entry.date}
                </time>
                : {entry.change}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}
