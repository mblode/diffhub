import type { Metadata } from "next";
import Link from "next/link";

import { GuideCommand } from "@/components/guides/guide-command";
import {
  GuideChangelog,
  GuideFaq,
  PromptExample,
  RelatedGuides,
  ShortcutTable,
} from "@/components/guides/guide";
import { WorkingTreeDemo } from "@/components/marketing/working-tree-demo";
import { AuthorByline } from "@/components/shared/author-byline";
import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { TrackedCta } from "@/components/tracked-cta";
import { CHANGELOGS, firstDate, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import type { ReviewComment } from "@/lib/review-prompt";
import { articleNode, zoneGraph } from "@/lib/schema";
import { COMMENT_SHORTCUTS, VIEWER_SHORTCUTS } from "@/lib/shortcuts";

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
 *
 * This page already wins the cmux cluster ("cmux git diff", "cmux diff
 * viewer", "cmux diff"). Keep the title and the H1. Thicken it with what a
 * reader needs once they've picked DiffHub (install, keys, the agent loop)
 * rather than retitling it.
 *
 * DiffHub claims here are checked against apps/cli: `cmuxAction` and
 * `derivePort` in bin/diffhub.mjs, the `handleKey` effect in DiffApp.tsx
 * (mirrored in lib/shortcuts.ts). The right-click "Open in" menu this page
 * used to describe was removed from the CLI in August; don't bring it back
 * without checking it exists.
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

const title = "cmux diff viewer: three ways to review a branch";
const description =
  "Compare three cmux diff viewer options: the built-in cmux diff, git diff in a pane, or DiffHub for a branch view that detects changes while you edit.";

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
 * Read twice, by `<FaqSection>` for the markup and by `zoneGraph({ faqs })` for
 * `acceptedAnswer`. One array, so the two cannot disagree. Backticks become
 * `<code>` in the answers and are stripped for the schema; see `lib/faq.ts`.
 */
const faqs: Faq[] = [
  {
    answer: `Not yet. Live reload is cmux issue #7101, and choosing the pane it opens in is #7102. Both were still open on ${CHECKED}.`,
    question: "Does cmux diff refresh automatically while you edit?",
  },
  {
    answer:
      "Not in the published CLI reference at cmux.com/docs/api, which is why people conclude it doesn’t exist. It does. Any `--staged` or `--unstaged` flags you’ve seen described for it belong to other tools.",
    question: "Is cmux diff documented?",
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
    answer: `Yes. \`git diff main...HEAD\` in a pane costs nothing, and \`cmux diff\` ships with cmux from ${CMUX_VERSION} on. Neither needs an install.`,
    question: "Can you review a branch in cmux without installing anything?",
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
 * Each alternative links to its primary repository so readers can check the
 * implementation and current project state without relying on copied metrics.
 */
const alternatives = [
  {
    href: "https://github.com/azu/cmux-hub",
    language: "TypeScript",
    name: "cmux-hub",
    note: "Inline review comments, commit history, GitHub PR status",
  },
  {
    href: "https://github.com/sinozu/cmux-git-diff",
    language: "Go",
    name: "cmux-git-diff",
    note: "A single Go binary, staged and unstaged tabs, live reload",
  },
  {
    href: "https://github.com/jaequery/cmux-diff",
    language: "TypeScript",
    name: "cmux-diff",
    note: "Shiki highlighting and commit message suggestions",
  },
  {
    href: "https://github.com/umputun/revdiff",
    language: "Go",
    name: "revdiff",
    note: "A TUI, if you’d rather not leave the pane at all",
  },
  {
    href: "/",
    language: "TypeScript",
    name: "DiffHub",
    note: "A browser split that detects edits and refreshes on demand",
  },
];

/** What Copy & clear produces for a cmux session, from the CLI's own format. */
const loopExample: ReviewComment[] = [
  {
    body: "[must-fix] Don’t swallow this error. Return it so the caller can show it.",
    file: "src/sync/queue.ts",
    lineNumber: 57,
    side: "right",
    tag: "",
  },
];

const link = "text-link transition-colors hover:text-link/90";
const body = "mt-4 text-pretty text-muted-foreground";
const heading = "mt-16 text-2xl font-medium tracking-tight";
// pr-3 below sm: at 390px the 4-column tables overflowed their container by
// ~40px and scrolled with no affordance, which hid the last column entirely.
// Tightening the gutter removes the overflow rather than hinting at it.
const cell = "border-border/60 border-b py-3 pr-2 align-top sm:pr-6";

// Instant navigation is validated for this route; see e2e/instant.spec.ts.
export const instant = true;

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

          <AuthorByline credential updated={updatedAt} />

          {/* The answer block: the first extractable passage answers the h1. */}
          <p className="mt-6 text-pretty text-lg text-muted-foreground">
            A cmux diff viewer can be built into the terminal, run in a pane, or kept open in a
            browser split. Use <code className="font-mono text-sm">cmux diff</code> for the built-in
            viewer, <code className="font-mono text-sm">git diff main...HEAD</code> in a pane for a
            quick answer, or <code className="font-mono text-sm">npx diffhub@latest cmux</code> when
            the branch is still changing and you want the view to detect edits without losing your
            review position.
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
          <GuideCommand command="npx diffhub@latest cmux" variant="cmux" />
          <p className={body}>
            It opens in a browser split beside your terminal and starts on everything you
            haven&rsquo;t committed. Switch the scope to All to compare the whole branch against the
            detected base, usually <code className="font-mono text-sm">origin/main</code>. It
            watches for edits and marks the refresh control when an update is available. Refresh
            when you&rsquo;re ready, so the code doesn&rsquo;t move during review. There&rsquo;s a
            split and unified toggle and a filterable file tree with per-file{" "}
            <code className="font-mono text-sm">+</code> and{" "}
            <code className="font-mono text-sm">-</code> counts. It runs in an ordinary browser tab
            too, which a viewer built into a terminal can&rsquo;t.
          </p>
          <WorkingTreeDemo />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedCta
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
              href={siteConfig.links.demo}
              label="Try guide live demo"
              location="/diffhub/cmux-git-diff"
              opensDemo
            >
              Try the live review
            </TrackedCta>
            <p className="text-sm text-muted-foreground">
              Then run the command against your own branch.
            </p>
          </div>
          <p className={body}>
            If you only want to answer one question, skip all of it and run{" "}
            <code className="font-mono text-sm">git diff main...HEAD</code> in a pane. The three-dot
            form diffs from the merge base, so you see what the branch introduced rather than every
            difference between two tips.
          </p>

          <h2 className={heading}>How do you install DiffHub for cmux?</h2>
          <p className={body}>
            You don&rsquo;t have to. Run{" "}
            <code className="font-mono text-sm">npx diffhub@latest cmux</code> from inside the
            repository and npx fetches it. To keep it around, install it once and drop the prefix:
          </p>
          <GuideCommand command="npm install -g diffhub" variant="Global" />
          <p className={body}>
            Then <code className="font-mono text-sm">diffhub cmux</code> in any repository. It needs
            macOS with cmux at <code className="font-mono text-sm">/Applications/cmux.app</code>,
            and Node 20.11+ or Bun 1.0.23+. Outside cmux,{" "}
            <code className="font-mono text-sm">npx diffhub@latest</code> opens the same viewer in
            your normal browser.
          </p>
          <p className={body}>
            The cmux command starts a local server, sends a cmux notification while it does, and
            opens the split. Each repository gets its own port, worked out from its path, so two
            repositories don&rsquo;t fight over one. Close the split and DiffHub stops the server.
            Two flags cover most setups:{" "}
            <code className="font-mono text-sm">--base &lt;branch&gt;</code> when your base
            isn&rsquo;t main, master, develop or dev, and{" "}
            <code className="font-mono text-sm">--repo &lt;path&gt;</code> to review a checkout
            you&rsquo;re not standing in.
          </p>

          <h2 className={heading}>Which keyboard shortcuts does DiffHub have?</h2>
          <p className={body}>
            Nine in the viewer, so a review in a split never needs the mouse. They pause while
            you&rsquo;re typing in the file filter or a comment.
          </p>
          <ShortcutTable caption="DiffHub viewer keyboard shortcuts" shortcuts={VIEWER_SHORTCUTS} />
          <p className={body}>In a comment box, two more:</p>
          <ShortcutTable caption="DiffHub comment box shortcuts" shortcuts={COMMENT_SHORTCUTS} />

          <h2 className={heading}>How does the agent loop work in a cmux split?</h2>
          <p className={body}>
            The agent runs in one pane and DiffHub sits in the split beside it. While the agent
            works, the status bar says Updates available. Press{" "}
            <code className="font-mono text-sm">r</code> when you&rsquo;re ready to see them. Hover
            a line, click the plus and write what you want changed. When you&rsquo;ve been through
            the diff, Copy &amp; clear turns every comment into one prompt and empties the list.
            Paste it into the agent&rsquo;s pane:
          </p>
          <PromptExample comments={loopExample} />
          <p className={body}>
            Then refresh and read the fix. It&rsquo;s the same loop whichever agent you run.{" "}
            <Link className={link} href="/agent-diff">
              Reviewing any agent&rsquo;s diff
            </Link>{" "}
            covers worktrees and pull requests, and{" "}
            <Link className={link} href="/claude-code-review">
              reviewing Claude Code&rsquo;s changes
            </Link>{" "}
            covers that one agent.
          </p>

          <h2 className={heading}>What are the alternatives to cmux diff?</h2>
          <p className={body}>
            A few people have built for this, and they make different trade-offs. Each name links to
            the project&rsquo;s repository so you can check its current behaviour and maintenance
            state.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Diff viewers for cmux, with implementation language and distinguishing feature
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
                    <td className={cell}>{tool.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={body}>
            Turns out what separates them isn&rsquo;t the diff rendering. It&rsquo;s whether the
            view keeps up with you while you work.
          </p>
          <p className={body}>
            Widen it past cmux and the field is bigger.{" "}
            <Link className={link} href="/review-ai-generated-code">
              How to review AI-generated code
            </Link>{" "}
            compares these against hunk and revdiff, and says which one to pick.
          </p>
          <p className={body}>
            cmux will probably close that gap. Until then I&rsquo;ve got a tab open.
          </p>

          <GuideFaq faqs={faqs} heading="What else do people ask about git diffs in cmux?" />
          <RelatedGuides current={PATH} />
          <GuideChangelog entries={CHANGELOG} />
        </div>
      </article>
    </div>
  );
}
