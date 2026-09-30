import type { Metadata } from "next";
import Link from "next/link";

import { GuideCommand } from "@/components/guides/guide-command";
import {
  GuideArticle,
  GuideFaq,
  RelatedGuides,
  TableScroll,
  guideClass,
} from "@/components/guides/guide";
import { WorkingTreeDemo } from "@/components/marketing/working-tree-demo";
import { JsonLd } from "@/components/shared/json-ld";
import { TrackedCta } from "@/components/tracked-cta";
import { CHANGELOGS, firstDate, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { guideMetadata, guideUrl } from "@/lib/guide-metadata";
import { guide } from "@/lib/guides";
import { articleNode, zoneGraph } from "@/lib/schema";

/**
 * Deliberately a Server Component. The homepage is `"use client"` for its
 * motion wrappers; this page is prose whose whole job is to be read by a
 * crawler, so it must render its content on the server. Don't import the
 * motion helpers here.
 *
 * Voice is the blog register: contractions on, curly apostrophes, one command
 * per option. The headings are questions, and each section's first sentence
 * answers its heading, so an extractor can lift a section without the ones
 * around it.
 *
 * This page already wins the cmux cluster ("cmux git diff", "cmux diff
 * viewer", "cmux diff"). Keep the title and the H1. Every one of those
 * searchers is choosing between the same few viewers, so one table carries
 * the whole comparison; keep it one table, not a decision table plus a list of
 * alternatives.
 *
 * "cmux file viewer" and "cmux syntax highlighting" searchers mostly want
 * cmux's own file preview, which DiffHub is not. They get one honest answer
 * each (`cmux open`, and which viewers highlight), not a section pretending
 * otherwise.
 *
 * DiffHub claims here are checked against apps/cli: `cmuxAction` and
 * `derivePort` in bin/diffhub.mjs, the `r` key in DiffApp.tsx, the refresh
 * button's pulse in
 * packages/diff-core/src/chrome/status-bar.tsx. The right-click "Open in" menu
 * this page used to describe was removed from the CLI in August; don't bring
 * it back without checking it exists.
 */

const entry = guide("/cmux-git-diff");
const url = guideUrl(entry);

/**
 * Version-bound claims, checked against cmux's GitHub releases and issues.
 * Re-check before editing: #7101 and #7102 are the claims most likely to go
 * stale, and PR #7134 would close the second.
 */
const CMUX_VERSION = "v0.64.25";

/** The date the cmux versions, issue states and alternatives were last read. */
const CHECKED = "2026-10-01";
/** `CHECKED` as prose. ISO stays in the constant and in `<time>`. */
const CHECKED_LABEL = "1 October 2026";

const CHANGELOG = CHANGELOGS[entry.path];
const publishedAt = firstDate(CHANGELOG) || CHECKED;
const updatedAt = latestDate(CHANGELOG) || publishedAt;

const { title, description } = entry;

export const metadata: Metadata = guideMetadata(entry);

const { body, cell, code, heading, lead, link, primaryCta } = guideClass;

/**
 * Read twice, by `<FaqSection>` for the markup and by `zoneGraph({ faqs })` for
 * `acceptedAnswer`. One array, so the two cannot disagree. Backticks become
 * `<code>` in the answers and are stripped for the schema; see `lib/faq.ts`.
 *
 * Only questions the body doesn't already answer.
 */
const faqs: Faq[] = [
  {
    answer:
      "Both open a browser diff beside your terminal. cmux-hub redraws as files change, shows commit history and GitHub PR status, and sends each review comment straight to the cmux terminal. DiffHub marks the refresh button and waits for you, so a hunk you’re reading never moves, and collects every comment into one prompt you paste when you’re done. Pick cmux-hub for PR status next to the diff, DiffHub for long reviews of a branch an agent is still editing.",
    question: "How is DiffHub different from cmux-hub?",
  },
  {
    answer:
      "Yes. `cmux open <file>` opens a file in a cmux preview tab, and Markdown files in a Markdown preview. It shows one file, not what changed, so for a diff use `cmux diff` or DiffHub.",
    question: "Does cmux have a file viewer?",
  },
  {
    answer:
      "No. It serves the viewer from 127.0.0.1, makes no outbound requests while it runs, and keeps comments in `.git/diffhub-comments.json` inside your repository.",
    question: "Does DiffHub send your code anywhere?",
  },
  {
    answer:
      "Two dots compares the two branch tips. Three dots compares from the merge base, so you see what your branch introduced, not everything that’s landed on main since. Three dots is almost always the one you want.",
    // Plain text, no backticks. Only answers are parsed for inline code, and
    // schema.org types Question.name as plain text too, so a backtick in a
    // question renders as a literal backtick in both places.
    question: "What is the difference between two dots and three dots in git diff?",
  },
  {
    answer:
      "All of them except cmux-git-diff and a plain `git diff`, which colour added and removed lines but not the code. cmux diff and DiffHub both render with Pierre’s diff viewer and Shiki, cmux-hub and cmux-diff use Shiki, and revdiff uses Chroma.",
    question: "Which cmux diff viewers have syntax highlighting?",
  },
];

/**
 * One script, one `@graph`. Two separate `ld+json` blocks describe two
 * unrelated things: the article and the trail cannot be merged into a single
 * entity unless a crawler sees them in the same graph.
 *
 * The breadcrumb starts at the blode.co root, not at this zone. A trail
 * beginning at blode.co/diffhub tells crawlers the zone is its own site.
 */
const pageJsonLd = zoneGraph({
  faqs,
  nodes: [
    // Dates off the changelog: an article making version-bound claims with no
    // dates gives a reader no way to judge whether the cmux version is current.
    articleNode({ description, headline: title, publishedAt, updatedAt, url }),
  ],
  page: { description, name: title, url },
  trail: [{ name: title, url }],
  updatedAt,
});

/**
 * Every way to review a branch in cmux, in one table. Each row says how the
 * view behaves while files change, because that is the difference between
 * them; the renderers are close to interchangeable. The third-party rows were
 * read from each README on `CHECKED`, and each links to its repository.
 */
const viewers = [
  {
    name: "cmux diff",
    updates: "No, reopen it",
    when: "You want a quick look and nothing to install.",
  },
  { name: "git diff main...HEAD", updates: "No", when: "You have one question about the branch." },
  {
    href: "/",
    name: "DiffHub",
    updates: "Flags edits, you refresh",
    when: "An agent is still editing the branch and the hunk you’re reading should stay put.",
  },
  {
    href: "https://github.com/azu/cmux-hub",
    name: "cmux-hub",
    updates: "Redraws live",
    when: "You want commit history and GitHub PR status beside the diff.",
  },
  {
    href: "https://github.com/sinozu/cmux-git-diff",
    name: "cmux-git-diff",
    updates: "Redraws live",
    when: "You want one Go binary with staged and unstaged tabs.",
  },
  {
    href: "https://github.com/jaequery/cmux-diff",
    name: "cmux-diff",
    updates: "Redraws live",
    when: "You want AI-written commit messages.",
  },
  {
    href: "https://github.com/umputun/revdiff",
    name: "revdiff",
    updates: "Press R",
    when: "You’d rather not leave the terminal.",
  },
];

// Stretched over the cell's `py-3`, so the tap target is the row, not the 18px word.
const toolLink = `${link} inline-block py-3 -my-3`;
const cmuxLink = (number: number, kind: "issues" | "pull" = "issues"): React.JSX.Element => (
  <a
    className={link}
    href={`https://github.com/manaflow-ai/cmux/${kind}/${number}`}
    rel="noopener noreferrer"
    target="_blank"
  >
    #{number}
  </a>
);

// Dev flags anything that would block navigating here; e2e/instant.spec.ts
// checks it against a production build.
export const instant = true;

export default function CmuxGitDiffPage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      {/* `crumb` is `title`: the visible leaf has to be the same string the
          JSON-LD trail declares. zone-conventions.md Rule 4. */}
      <GuideArticle crumb={title} heading={title} updatedAt={updatedAt}>
        {/* The answer block: the first extractable passage answers the h1. */}
        <p className={lead}>
          Run <code className={code}>cmux diff</code> for a quick look, or{" "}
          <code className={code}>git diff main...HEAD</code> in a pane for one question. While an
          agent is still editing the branch, run DiffHub: it opens in a split, notices each edit and
          refreshes when you say.
        </p>
        <GuideCommand command="npx diffhub@latest cmux" variant="cmux" />
        <TrackedCta
          className={primaryCta}
          href={siteConfig.links.demo}
          label="Try guide live demo"
          location="/diffhub/cmux-git-diff"
          opensDemo
        >
          Browse a real PR in DiffHub
        </TrackedCta>

        <h2 className={heading}>Which cmux diff viewer should you use?</h2>
        <TableScroll label="Diff viewers for cmux">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Ways to review a branch in cmux, how each behaves while you edit, and when to pick it
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className={`${cell} font-medium`} scope="col">
                  Viewer
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  While you edit
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Pick it when
                </th>
              </tr>
            </thead>
            <tbody>
              {viewers.map((viewer) => (
                <tr key={viewer.name}>
                  <th className={`${cell} font-normal`} scope="row">
                    {!viewer.href && viewer.name}
                    {viewer.href?.startsWith("/") && (
                      <Link className={toolLink} href={viewer.href}>
                        {viewer.name}
                      </Link>
                    )}
                    {viewer.href?.startsWith("http") && (
                      <a
                        className={toolLink}
                        href={viewer.href}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {viewer.name}
                      </a>
                    )}
                  </th>
                  <td className={cell}>{viewer.updates}</td>
                  <td className={cell}>{viewer.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        <h2 className={heading}>Why doesn&rsquo;t cmux diff refresh while you edit?</h2>
        <p className={body}>
          It doesn&rsquo;t watch the filesystem yet. <code className={code}>cmux diff</code> arrived
          in v0.64.11 with a base-branch picker, syntax highlighting,{" "}
          <code className={code}>⌘F</code> search and review comments, but checking a fix still
          means reopening it. Live reload is {cmuxLink(7101)}, and choosing the pane it opens in is{" "}
          {cmuxLink(7102)}, which {cmuxLink(7134, "pull")} would fix with a{" "}
          <code className={code}>--here</code> flag. All three were open on {CHECKED_LABEL}, in
          cmux&nbsp;{CMUX_VERSION}.
        </p>
        <p className={body}>
          Once cmux closes #7101, its built-in diff may be all you need. Until then I keep DiffHub
          open in a split.
        </p>

        <h2 className={heading}>How does DiffHub work in a cmux split?</h2>
        <p className={body}>
          It opens beside your agent and starts on everything you haven&rsquo;t committed; switch
          the scope to All to compare the branch against <code className={code}>origin/main</code>.
          When files change, a dot pulses on the refresh button and nothing moves until you press{" "}
          <code className={code}>r</code>. Comment on any line, and Copy &amp; clear turns every
          comment into one prompt to paste into the agent&rsquo;s pane.
        </p>
        <WorkingTreeDemo />

        <h2 className={heading}>How do you install DiffHub for cmux?</h2>
        <p className={body}>
          You don&rsquo;t have to: npx fetches it. To keep it, run{" "}
          <code className={code}>npm install -g diffhub</code> and then{" "}
          <code className={code}>diffhub cmux</code>. It needs macOS with cmux in{" "}
          <code className={code}>/Applications</code>, and Node&nbsp;20.11+ or Bun&nbsp;1.0.23+.
          Pass <code className={code}>--base &lt;branch&gt;</code> when your base isn&rsquo;t main,
          master, develop or dev. If the diff is empty, you have nothing uncommitted: switch the
          scope to All.
        </p>

        <GuideFaq faqs={faqs} heading="What else do people ask about git diffs in cmux?" />
        <RelatedGuides current={entry.path} />
      </GuideArticle>
    </div>
  );
}
