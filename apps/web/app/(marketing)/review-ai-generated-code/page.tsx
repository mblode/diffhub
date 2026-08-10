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
 * Deliberately a Server Component, for the same reason as `cmux-git-diff`: the
 * whole job of this page is to be read, so every word ships in the server HTML.
 * Don't import the homepage's motion helpers here.
 *
 * Aimed at unbranded category intent ("diff viewer for reviewing AI agent
 * code"), not at the branded cmux cluster that `/cmux-git-diff` already wins.
 * Those are opposite problems: the branded cluster ranks and under-converts,
 * this one had no page at all.
 *
 * Structure follows blode-co's educational-resource spec (answer block first,
 * key facts table, first-party evidence, stated limits, changelog). Voice
 * follows `cmux-git-diff`: contractions on, curly apostrophes, no throat
 * clearing. That divergence is a decision, not drift. A page that reads as a
 * filled-in template defeats the point of the format.
 *
 * No table of contents, on purpose. Neither of blode.co's two pages that
 * currently win AI citations has one.
 */

const PATH = "/review-ai-generated-code";
const url = `${siteConfig.url}${PATH}`;

/**
 * Competitor claims are version-bound and quoted from the vendors' own pages.
 * Re-verified 2026-08-10 immediately before publishing. An inaccurate claim
 * about a named competitor is worse than making no claim, so if you edit this
 * page, re-fetch these four sources first and move `CHANGELOG` if they moved.
 */
const CHECKED = "2026-08-10";

const title = "How to review code an AI agent wrote";
const description =
  "An agent just changed forty files. Where you read that diff decides whether you catch anything. Terminal, TUI, or browser tab, and what each one is good for.";

// Declaring `openGraph` here replaces the layout's block rather than merging
// into it, so the image, the siteName and the title all have to be restated.
// zone-conventions.md Rule 9.
const cardImage = "/opengraph-image";

export const metadata: Metadata = {
  alternates: { canonical: url },
  description,
  openGraph: {
    description,
    images: [{ alt: title, height: 630, url: cardImage, width: 1200 }],
    siteName: "Matthew Blode",
    title: `${title} | ${siteConfig.name}`,
    type: "article",
    url,
  },
  // Bare: the root layout's `title.template` appends " | DiffHub".
  title,
  twitter: {
    card: "summary_large_image",
    creator: "@mattblode",
    description,
    images: [cardImage],
    title: `${title} | ${siteConfig.name}`,
  },
};

/**
 * `updatedAt` is derived from the changelog rather than typed, so the visible
 * entries and the machine-readable date cannot drift. Add an entry or the date
 * does not move.
 *
 * The entries live in `lib/changelog.ts` because `app/sitemap.ts` needs the
 * same dates and must not import a page module to get them.
 */
const CHANGELOG = CHANGELOGS[PATH];

const publishedAt = firstDate(CHANGELOG) || CHECKED;
const updatedAt = latestDate(CHANGELOG) || publishedAt;

/**
 * Questions the page's own H2s do not already answer. An FAQ entry that
 * restates a heading puts two chunks of the page in competition for the same
 * extraction, and the shorter one usually wins, which is the wrong one.
 *
 * The same rule applies across pages, which is why "do you need cmux for this"
 * lives on the landing page and not here. Three entries that are only asked of
 * this page beat five where two are also asked somewhere else.
 *
 * This array is read twice, by `<FaqSection>` and by `zoneGraph({ faqs })`.
 * Backticks become `<code>` in the markup and are stripped for the schema; see
 * `lib/faq.ts`.
 */
const faqs: Faq[] = [
  {
    answer:
      "No. hunk, revdiff, `cmux diff` and DiffHub all show you a diff and let you annotate it. If you want findings generated for you, that is a different category of tool, and CodeRabbit or Greptile is the thing you are describing.",
    question: "Do any of these tools review the code for you?",
  },
  {
    answer: `revdiff, hunk and DiffHub are MIT licensed and free. \`cmux diff\` ships with cmux. \`git diff\` is git. Licences read from the projects' own pages on ${CHECKED}.`,
    question: "Are these tools free?",
  },
  {
    answer:
      "Tests tell you the code does what the tests say. They do not tell you the agent touched forty files where three would have done, or that it deleted a check it could not satisfy. Read the diff.",
    question: "Should you review agent-written code if the tests pass?",
  },
];

/**
 * One script, one `@graph`. The breadcrumb starts at the blode.co root, not at
 * this zone: a trail beginning at blode.co/diffhub tells crawlers the zone is
 * its own site. zone-conventions.md Rules 3 and 4.
 *
 * `LearningResource` rides alongside `TechArticle` as a second type. It
 * produces no rich result and is not a ranking lever; it is here because it is
 * accurate. There is deliberately no `about`/`sameAs` node: the honest value
 * would be a Wikidata URI for code review, and inventing an identifier to fill
 * a slot is exactly what the spec disqualifies.
 */
const pageJsonLd = zoneGraph({
  faqs,
  nodes: [
    {
      "@type": ["TechArticle", "LearningResource"],
      author: { "@id": schemaId.person },
      dateModified: updatedAt,
      datePublished: publishedAt,
      description,
      headline: title,
      isPartOf: { "@id": schemaId.website },
      mainEntityOfPage: url,
      publisher: { "@id": schemaId.organization },
      teaches:
        "Choosing where to read a git diff when reviewing code written by an AI coding agent",
      url,
    },
  ],
  page: { description, name: title, url },
  trail: [{ name: title, url }],
  updatedAt,
});

/** Every value carries a unit and a source. No row exists without both. */
const facts = [
  {
    label: "Where the review happens",
    source: "first-party",
    value: "A browser tab, or a cmux browser split",
  },
  {
    label: "Published package",
    source: "npm registry",
    value: "diffhub 0.3.3",
  },
  {
    label: "Install cost",
    source: "npm registry, dist.unpackedSize",
    value: "35.7 MB unpacked, 1,827 files",
  },
  {
    label: "Runtime floor",
    source: "apps/cli/package.json engines",
    value: "Node 20.11, or Bun 1.0.23",
  },
  {
    label: "Default port",
    source: "apps/cli/bin/diffhub.mjs",
    value: "2047",
  },
  {
    label: "Inline render ceiling, per file",
    source: "apps/cli/lib/diff-file-stat.ts",
    value: "500 changed lines, or 500,000 bytes of patch",
  },
  {
    label: "Review comment tags",
    source: "apps/cli/lib/comment-types.ts",
    value: "4, plus untagged",
  },
  {
    label: "Comment store",
    source: "apps/cli/lib/comments.ts",
    value: ".git/diffhub-comments.json, written atomically",
  },
];

/**
 * At least two rows where the answer is not DiffHub. If this table ever comes
 * out with DiffHub winning every row, the table is wrong and the page reads as
 * marketing rather than as a recommendation.
 */
const tools = [
  {
    href: "https://github.com/umputun/revdiff",
    name: "revdiff",
    verdict: "Best if you want the annotations piped straight into Claude Code or Codex.",
    where: "TUI, Go binary",
  },
  {
    href: "https://hunk.dev",
    name: "hunk",
    verdict: "Best if you want agent notes rendered inline and never leave the terminal.",
    where: "Terminal, npm or Homebrew",
  },
  {
    href: "https://cmux.com/docs/api",
    name: "cmux diff",
    verdict: "Best for a quick pass. Already installed, costs nothing, no watch yet.",
    where: "cmux pane",
  },
  {
    href: null,
    name: "git diff main...HEAD",
    verdict: "Best when you have exactly one question. Nothing to install.",
    where: "Any shell",
  },
  {
    href: "/",
    name: "DiffHub",
    verdict: "Best for a large change you will read, edit, and re-read in one sitting.",
    where: "Browser tab, or cmux split",
  },
];

const limits = [
  "It is 35.7 MB unpacked against revdiff's single Go binary. If install weight matters to you, that is a real reason to pick something else.",
  "It needs Node 20.11 or Bun 1.0.23 on the machine. There is no standalone binary.",
  "cmux mode is macOS only and expects cmux.app at /Applications/cmux.app. Everywhere else, it is an ordinary browser tab.",
  "A file with 500 or more changed lines, or a patch of 500,000 bytes or more, is not rendered inline. Generated lockfiles and vendored bundles hit this constantly.",
  "It does not review anything for you. If you want findings generated rather than somewhere to read the diff, this is the wrong category, and CodeRabbit or Greptile is the thing you are describing.",
];

const promptExample = `## Code Review Comments

Please address the following:

- [must-fix] **apps/cli/lib/git.ts:118**: this swallows the spawn error
- [question] **apps/web/lib/config.ts:12**: is this base branch rule intentional?`;

const link = "text-link transition-colors hover:text-link/90";
const body = "mt-4 text-pretty text-muted-foreground";
const heading = "mt-16 text-2xl font-medium tracking-tight";
const cell = "border-border/60 border-b py-3 pr-6 align-top";

export default function ReviewAiGeneratedCodePage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      <article className="@container py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          {/* Every crumb `zoneGraph` declares is rendered here, `title`
              included. A short hand-rolled trail is what produced the phantom
              "Projects" finding. zone-conventions.md Rule 4. */}
          <ZoneBreadcrumb page={title} product="DiffHub" />

          <h1 className="mt-6 text-balance text-4xl font-medium tracking-tight sm:text-5xl sm:tracking-[-0.03em]">
            {title}
          </h1>

          <AuthorByline updated={updatedAt} />

          {/* The answer block. No prose precedes it, because the first
              extractable passage on the page has to be the answer. The byline
              above is a named person and a date, not a passage. */}
          <p className="mt-6 text-pretty text-lg text-muted-foreground">
            Reviewing code an AI agent wrote is a volume problem before it&rsquo;s a comprehension
            problem. The tools built for it split on one axis, which is where you read the diff:{" "}
            <a className={link} href="https://hunk.dev" rel="noopener noreferrer" target="_blank">
              hunk
            </a>{" "}
            and{" "}
            <a
              className={link}
              href="https://github.com/umputun/revdiff"
              rel="noopener noreferrer"
              target="_blank"
            >
              revdiff
            </a>{" "}
            keep you in the terminal, cmux&rsquo;s built-in{" "}
            <code className="font-mono text-sm">cmux diff</code> opens a pane, and DiffHub opens a
            browser tab that refreshes while you keep editing. DiffHub is the browser answer. If you
            never want to leave the terminal, it&rsquo;s the wrong one.
          </p>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">DiffHub key facts, all measured {CHECKED}</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th className={`${cell} font-medium`} scope="col">
                    Fact
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    Value
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {facts.map((fact) => (
                  <tr key={fact.label}>
                    <th className={`${cell} font-normal`} scope="row">
                      {fact.label}
                    </th>
                    <td className={cell}>{fact.value}</td>
                    <td className={`${cell} text-muted-foreground`}>{fact.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Every row measured {CHECKED} against diffhub 0.3.3.
          </p>

          <h2 className={heading}>
            What makes reviewing agent-written code different from reviewing a teammate&rsquo;s pull
            request?
          </h2>
          <p className={body}>
            Reviewing agent-written code differs from reviewing a colleague&rsquo;s pull request in
            three ways, and none of them is that the code is worse. The change arrives all at once
            rather than accreting over days. There is no author to ask, so anything you can&rsquo;t
            work out from the diff you have to work out from the repository. And the code keeps
            moving while you read it, because the agent is still going.
          </p>
          <p className={body}>
            That third one is what breaks a normal review tool. A viewer you have to re-run after
            every edit turns reviewing into a loop of reopening. cmux users have asked for exactly
            this: issue{" "}
            <a
              className={link}
              href="https://github.com/manaflow-ai/cmux/issues/7101"
              rel="noopener noreferrer"
              target="_blank"
            >
              #7101
            </a>{" "}
            requests live reload for <code className="font-mono text-sm">cmux diff</code> and names
            watching an agent&rsquo;s file modifications as the reason. It was still open on{" "}
            {CHECKED}.
          </p>

          <h2 className={heading}>Should you read the diff in the terminal or the browser?</h2>
          <p className={body}>
            Read the diff wherever you are going to act on it. Four of the five options below are
            terminal-shaped and one is not, and that single difference matters more than any
            difference in how they render a diff.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Diff viewers for reviewing agent-written code, checked {CHECKED}
              </caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th className={`${cell} font-medium`} scope="col">
                    Tool
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    Where it runs
                  </th>
                  <th className={`${cell} font-medium`} scope="col">
                    Verdict
                  </th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.name}>
                    <th className={`${cell} font-normal`} scope="row">
                      {tool.href ? (
                        <a
                          className={link}
                          href={tool.href}
                          rel={tool.href.startsWith("/") ? undefined : "noopener noreferrer"}
                          target={tool.href.startsWith("/") ? undefined : "_blank"}
                        >
                          {tool.name}
                        </a>
                      ) : (
                        <code className="font-mono text-sm">{tool.name}</code>
                      )}
                    </th>
                    <td className={cell}>{tool.where}</td>
                    <td className={cell}>{tool.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={body}>
            hunk describes itself as &ldquo;Terminal diffs for humans &amp; agents&rdquo; and ships
            a watch mode, so on the refresh question it and DiffHub agree; they disagree about the
            terminal. revdiff is &ldquo;a TUI for reviewing diffs, files, and documents with inline
            annotations&rdquo;. Both are MIT licensed and free. Both quotes are from their own
            pages, read {CHECKED}.
          </p>

          <h2 className={heading}>How do you hand review comments back to the agent?</h2>
          <p className={body}>
            Handing review comments back to the agent works the same way in all three tools: you
            annotate lines, then export the annotations as text the agent can act on. This is not a
            DiffHub differentiator and the page would be wrong to claim it is. revdiff writes
            structured annotations to stdout on quit and ships plugins for Claude Code and Codex.
            hunk renders agent notes inline with a summary, rationale and author.
          </p>
          <p className={body}>
            DiffHub stores comments in{" "}
            <code className="font-mono text-sm">.git/diffhub-comments.json</code> in the repository
            you are reviewing, and copies them out as markdown. Each comment can carry one of four
            tags, <code className="font-mono text-sm">[must-fix]</code>,{" "}
            <code className="font-mono text-sm">[suggestion]</code>,{" "}
            <code className="font-mono text-sm">[nit]</code> or{" "}
            <code className="font-mono text-sm">[question]</code>, or none. The tag is what stops an
            agent treating a passing thought as a blocking instruction.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-lg border border-border/60 bg-secondary/50 p-4 font-mono text-sm text-muted-foreground">
            <code>{promptExample}</code>
          </pre>
          <p className={body}>
            That is the whole format, produced by{" "}
            <code className="font-mono text-sm">exportCommentsAsPrompt</code> in{" "}
            <code className="font-mono text-sm">apps/cli/lib/export-comments.ts</code>. Paste it
            into the agent that wrote the code.
          </p>

          <h2 className={heading}>What does DiffHub measure, and what does it refuse to render?</h2>
          <p className={body}>
            DiffHub refuses to render a file inline once it crosses either of two thresholds: 500
            changed lines, or 500,000 bytes of patch. Both live in{" "}
            <code className="font-mono text-sm">apps/cli/lib/diff-file-stat.ts</code>. Binary files
            are excluded from the check entirely rather than counted as large.
          </p>
          <p className={body}>
            DiffHub diffs against the merge base with the detected base branch, preferring{" "}
            <code className="font-mono text-sm">origin/main</code> over local{" "}
            <code className="font-mono text-sm">main</code> so unpushed commits still appear. That
            preference is the difference between seeing what your branch introduced and seeing every
            difference between two tips.
          </p>
          <p className={body}>
            Comments are written to a temp file and renamed over the store, so an interrupted write
            cannot leave you with a half-written review. Mutations are queued rather than
            concurrent.
          </p>
          <code className="my-6 flex w-fit items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-sm text-muted-foreground">
            <span>npx diffhub@latest cmux</span>
            <CopyButton content="npx diffhub@latest cmux" />
          </code>

          <h2 className={heading}>When is DiffHub the wrong answer?</h2>
          <p className={body}>
            DiffHub is the wrong answer in five specific cases, and they are worth stating plainly
            because a tool with no stated limits is a tool nobody has used in anger.
          </p>
          <ul className={`${body} space-y-3`}>
            {limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>

          <h2 className={heading}>What else do people ask about reviewing AI-generated code?</h2>
          <FaqSection
            answerClassName={body}
            faqs={faqs}
            questionClassName="mt-8 font-medium text-lg tracking-tight"
          />

          {/* Not a question, on purpose. "What changed on this page, and when?"
              over a one-entry list is the filled-in-template reading the header
              comment says this page must not have. Item 4's exemption. */}
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
          {/* The author and the revision date used to live here, at the foot of
              the page. They are in `<AuthorByline>` under the h1 now, where a
              reader and an extractor both meet them first. The changelog above
              carries the publication date. */}
          <p className={body}>
            Related:{" "}
            <Link className={link} href="/cmux-git-diff">
              how to view a git diff in cmux
            </Link>{" "}
            compares the three cmux-specific options in more detail.{" "}
            <Link className={link} href="/">
              DiffHub
            </Link>{" "}
            is the tool itself.
          </p>
        </div>
      </article>
    </div>
  );
}
