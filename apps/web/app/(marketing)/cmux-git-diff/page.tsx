import type { Metadata } from "next";
import Link from "next/link";

import { GuideCommand } from "@/components/guides/guide-command";
import {
  GuideArticle,
  GuideFaq,
  PromptExample,
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
import type { ReviewComment } from "@/lib/review-prompt";
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
 * viewer", "cmux diff"). Keep the title and the H1. The decision table sits
 * straight under the answer because every one of those searchers is choosing
 * between the same three commands.
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

/** The three commands the answer names, as a decision a skimmer can make. */
const options = [
  {
    command: "cmux diff",
    name: "Built-in cmux diff",
    updates: "No, reopen it",
    when: "You want a quick look and nothing to install.",
  },
  {
    command: "git diff main...HEAD",
    name: "git diff in a pane",
    updates: "No",
    when: "You have one question about the branch.",
  },
  {
    command: "npx diffhub@latest cmux",
    name: "DiffHub",
    updates: "Flags edits, you refresh",
    when: "The branch is still moving, or an agent is editing it.",
  },
];

/**
 * Every row says how the view behaves while files change, because that is the
 * difference between them; the renderers are close to interchangeable. Read
 * from each README on `CHECKED`. Each name links to its repository so readers
 * can check the current state themselves.
 */
const alternatives = [
  {
    href: "https://github.com/manaflow-ai/cmux",
    name: "cmux diff",
    note: "Built in; comments saved per repo",
    runsIn: "cmux pane",
    updates: "No",
  },
  {
    href: "https://github.com/azu/cmux-hub",
    name: "cmux-hub",
    note: "Commit history, GitHub PR status, comments sent to the terminal",
    runsIn: "Browser split",
    updates: "Live",
  },
  {
    href: "https://github.com/sinozu/cmux-git-diff",
    name: "cmux-git-diff",
    note: "A single Go binary, staged and unstaged tabs",
    runsIn: "Browser tab",
    updates: "Live",
  },
  {
    href: "https://github.com/jaequery/cmux-diff",
    name: "cmux-diff",
    note: "AI-generated commit messages",
    runsIn: "Browser",
    updates: "Live",
  },
  {
    href: "https://github.com/umputun/revdiff",
    name: "revdiff",
    note: "Never leaves the terminal; agent plugins",
    runsIn: "Terminal (TUI)",
    updates: "Press R",
  },
  {
    href: "/",
    name: "DiffHub",
    note: "Comments copied out as one agent prompt; a port per repo",
    runsIn: "Browser split",
    updates: "Flags edits, you refresh",
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
          cmux gives you three ways to review a branch. <code className={code}>cmux diff</code> is
          built in. <code className={code}>git diff main...HEAD</code> in a pane answers one
          question fast. <code className={code}>npx diffhub@latest cmux</code> opens a browser split
          that notices your edits and refreshes when you say, so you can fix and re-read without
          losing your place.
        </p>

        <h2 className={heading}>Which cmux diff viewer should you use?</h2>
        <TableScroll label="Ways to review a branch in cmux">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              The three ways to review a branch in cmux, whether each updates while you edit, and
              when to use it
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className={`${cell} font-medium`} scope="col">
                  Option
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Updates while you edit
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Use it when
                </th>
              </tr>
            </thead>
            <tbody>
              {options.map((option) => (
                <tr key={option.name}>
                  <th className={`${cell} font-normal`} scope="row">
                    <span className="block font-medium">{option.name}</span>
                    <code className={`${code} mt-1 inline-block whitespace-nowrap`}>
                      {option.command}
                    </code>
                  </th>
                  <td className={cell}>{option.updates}</td>
                  <td className={cell}>{option.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        <GuideCommand command="npx diffhub@latest cmux" variant="cmux" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCta
            className={primaryCta}
            href={siteConfig.links.demo}
            label="Try guide live demo"
            location="/diffhub/cmux-git-diff"
            opensDemo
          >
            Browse a real PR in DiffHub
          </TrackedCta>
          <p className="text-muted-foreground text-sm">
            The same viewer on a public pull request. No install.
          </p>
        </div>

        <h2 className={heading}>What does cmux diff do?</h2>
        <p className={body}>
          <code className={code}>cmux diff</code> opens a branch diff inside cmux, with a searchable
          picker for the base branch, syntax highlighting, and review comments saved per repo. It
          arrived in v0.64.11 in June. The picker followed in v0.64.17, and since v0.64.23 you can
          search the diff with <code className={code}>⌘F</code> and print your comments with{" "}
          <code className={code}>cmux comments list</code>.
        </p>
        <p className={body}>
          For a quick pass over what an agent just changed, it&rsquo;s already there.
        </p>

        <h2 className={heading}>Why doesn&rsquo;t cmux diff refresh while you edit?</h2>
        <p className={body}>
          It doesn&rsquo;t watch the filesystem yet, and it opens in a fixed pane wherever you ran
          it. Live reload is {cmuxLink(7101)} and choosing the pane is {cmuxLink(7102)}. Both were
          open on {CHECKED_LABEL}, in cmux&nbsp;{CMUX_VERSION}. A fix for the second,{" "}
          {cmuxLink(7134, "pull")}, adds a <code className={code}>--here</code> flag but
          hasn&rsquo;t merged.
        </p>
        <p className={body}>
          Until they land, the loop where you read a diff, fix something and check the fix still
          means reopening it.
        </p>

        <h2 className={heading}>When should you use DiffHub instead?</h2>
        <p className={body}>
          Use{" "}
          <Link className={link} href="/">
            DiffHub
          </Link>{" "}
          when the branch is still moving and you want to see each fix without reopening the diff.
        </p>
        <p className={body}>
          It opens in a browser split beside your terminal and starts on everything you
          haven&rsquo;t committed. Switch the scope to All to compare the whole branch against the
          detected base, usually <code className={code}>origin/main</code>. It watches for edits and
          marks the refresh button, but waits for you, so the code doesn&rsquo;t move mid-review.
        </p>
        <WorkingTreeDemo />

        <h2 className={heading}>How does the agent loop work in a cmux split?</h2>
        <p className={body}>
          The agent runs in one pane and DiffHub sits in the split beside it. While the agent works,
          a dot pulses on the refresh button to say updates are available. Press{" "}
          <code className={code}>r</code> when you&rsquo;re ready to see them. Hover a line, click
          the plus and write what you want changed. When you&rsquo;ve been through the diff, Copy
          &amp; clear turns every comment into one prompt and empties the list. Paste it into the
          agent&rsquo;s pane:
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

        <h2 className={heading}>How do you install DiffHub for cmux?</h2>
        <p className={body}>
          You don&rsquo;t have to. Run <code className={code}>npx diffhub@latest cmux</code> from
          inside the repository and npx fetches it. To keep it around, install it once and drop the
          prefix:
        </p>
        <GuideCommand command="npm install -g diffhub" variant="Global" />
        <p className={body}>
          Then <code className={code}>diffhub cmux</code> in any repository. It needs macOS with
          cmux at <code className={code}>/Applications/cmux.app</code>, and Node&nbsp;20.11+ or
          Bun&nbsp;1.0.23+. Outside cmux, <code className={code}>npx diffhub@latest</code> opens the
          same viewer in your normal browser.
        </p>
        <p className={body}>
          Two flags cover most setups: <code className={code}>--base &lt;branch&gt;</code> when your
          base isn&rsquo;t main, master, develop or dev, and{" "}
          <code className={code}>--repo &lt;path&gt;</code> to review a checkout you&rsquo;re not
          standing in.
        </p>
        <p className={body}>
          If the split doesn&rsquo;t open, check cmux is in{" "}
          <code className={code}>/Applications</code>. If the diff is empty, you have nothing
          uncommitted: switch the scope to All to see the branch.
        </p>

        <h2 className={heading}>What are the alternatives to cmux diff?</h2>
        <p className={body}>
          Three other people have built diff viewers for cmux, and revdiff works in any terminal.
          Each name links to its repository.
        </p>
        <TableScroll label="Diff viewers for cmux">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Diff viewers for cmux: where each runs, how it behaves while files change, and what it
              adds
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className={`${cell} font-medium`} scope="col">
                  Tool
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Runs in
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  While you edit
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Stands out for
                </th>
              </tr>
            </thead>
            <tbody>
              {alternatives.map((tool) => (
                <tr key={tool.name}>
                  <th className={`${cell} font-normal`} scope="row">
                    {tool.href.startsWith("/") ? (
                      <Link className={toolLink} href={tool.href}>
                        {tool.name}
                      </Link>
                    ) : (
                      <a
                        className={toolLink}
                        href={tool.href}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {tool.name}
                      </a>
                    )}
                  </th>
                  <td className={cell}>{tool.runsIn}</td>
                  <td className={cell}>{tool.updates}</td>
                  <td className={cell}>{tool.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <p className={body}>
          The live ones differ in when the view changes. cmux-hub, cmux-git-diff and cmux-diff
          redraw as files change. DiffHub marks the change and waits, so the hunk you&rsquo;re
          reading stays put. Pick cmux-hub if you want PR status and commit history beside the diff,
          and revdiff if you&rsquo;d rather not leave the terminal.
        </p>
        <p className={body}>
          Widen it past cmux and the field is bigger.{" "}
          <Link className={link} href="/review-ai-generated-code">
            How to review AI-generated code
          </Link>{" "}
          compares these against hunk and revdiff, and says which one to pick.
        </p>
        <p className={body}>
          Once cmux closes #7101, its built-in diff may be all you need. Until then I keep DiffHub
          open in a split.
        </p>

        <h2 className={heading}>Which cmux diff viewers have syntax highlighting?</h2>
        <p className={body}>
          All of them except cmux-git-diff and a plain <code className={code}>git diff</code>, which
          colour added and removed lines but not the code. cmux diff and DiffHub both render with
          Pierre&rsquo;s diff viewer and Shiki, so their highlighting looks much the same. cmux-hub
          and cmux-diff use Shiki too, and revdiff uses Chroma in the terminal.
        </p>

        <GuideFaq faqs={faqs} heading="What else do people ask about git diffs in cmux?" />
        <RelatedGuides current={entry.path} />
      </GuideArticle>
    </div>
  );
}
