import type { Metadata } from "next";
import Link from "next/link";

import { GuideCommand } from "@/components/guides/guide-command";
import {
  FactTable,
  GuideArticle,
  GuideChangelog,
  GuideFaq,
  PromptExample,
  RelatedGuides,
  guideClass,
} from "@/components/guides/guide";
import { JsonLd } from "@/components/shared/json-ld";
import { CHANGELOGS, firstDate, latestDate } from "@/lib/changelog";
import type { Faq } from "@/lib/faq";
import { guideMetadata, guideUrl } from "@/lib/guide-metadata";
import { guide } from "@/lib/guides";
import type { ReviewComment } from "@/lib/review-prompt";
import { articleNode, zoneGraph } from "@/lib/schema";

/**
 * The beachhead for AI and agent code review: "review ai generated code", "ai
 * code review tool", "ai code reviewer", "ai pr review". Most of that demand is
 * looking for a bot that reviews for you. DiffHub isn't one, so this page is
 * the method (what to check, and where an AI reviewer does and doesn't help)
 * with DiffHub as the place to do the human pass. Saying so plainly is what
 * lets it rank for the category without pretending to be in it.
 *
 * No competitor is named for the AI reviewer category, on purpose: this page
 * doesn't chase those brand queries.
 *
 * Its two siblings own narrower intents: `/claude-code-review` is one agent's
 * workflow, `/agent-diff` is the mechanics of the loop for any agent. Keep the
 * checklist here and out of those.
 *
 * Server Component. Every word ships in the server HTML.
 */

const entry = guide("/review-ai-generated-code");
const url = guideUrl(entry);
const CHANGELOG = CHANGELOGS[entry.path];
const publishedAt = firstDate(CHANGELOG);
const updatedAt = latestDate(CHANGELOG);

/**
 * Competitor claims (hunk, revdiff, the cmux issue) are quoted from the
 * projects' own pages and were read on this date. An inaccurate claim about a
 * named project is worse than none: re-fetch those sources before editing the
 * table or the paragraph under it, and move this date if they moved.
 */
const TOOLS_CHECKED = "2026-08-10";

/** The npm figures were read from the registry on this date, for diffhub 1.0.0. */
const NPM_CHECKED = "2026-09-22";

export const metadata: Metadata = guideMetadata(entry);

const { body, cell, code, heading, lead, link } = guideClass;

const checks = [
  {
    detail:
      "Did it change only what you asked for? Agents fix a neighbouring bug, rename a helper, reformat a file. Every file you didn’t expect in the diff is a question to ask before anything else.",
    name: "Scope",
  },
  {
    detail:
      "A skipped test, a loosened assertion, a validation that’s gone, a type cast to get past the compiler. It’s the quickest way for an agent to make a failing check pass, and the tests will be green.",
    name: "Deleted or weakened checks",
  },
  {
    detail:
      "A function, flag or option that doesn’t exist, or a new package you never agreed to. Read the imports and the lockfile diff, not just the code that calls them.",
    name: "Invented APIs and dependencies",
  },
  {
    detail:
      "An empty catch block, an error logged and dropped, a fallback value that hides a failure. The happy path works, so nothing tells you.",
    name: "Swallowed errors",
  },
  {
    detail:
      "A default that moved, a config value, a migration, a changed response shape. Anything existing users would notice, with no test that says it was meant to change.",
    name: "Quiet behaviour changes",
  },
  {
    detail:
      "Keys, tokens, absolute paths from the agent’s machine, and debug logging it forgot to take out.",
    name: "Secrets and leftovers",
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

const example: ReviewComment[] = [
  {
    body: "[must-fix] This catch returns an empty list, so a failed request looks like no orders. Let the error through.",
    file: "src/api/orders.ts",
    lineNumber: 42,
    side: "right",
    tag: "",
  },
  {
    body: "[question] Why was this assertion removed? Put it back unless the behaviour really changed.",
    file: "src/api/orders.test.ts",
    lineNumber: 18,
    side: "left",
    tag: "",
  },
];

const facts = [
  {
    label: "Where the review happens",
    source: "first-party",
    value: "A browser tab, or a cmux browser split",
  },
  {
    label: "Published package",
    source: `npm registry, read ${NPM_CHECKED}`,
    value: "diffhub 1.0.0",
  },
  {
    label: "Install cost",
    source: "npm registry, dist.unpackedSize",
    value: "35.6 MB unpacked, 1,829 files",
  },
  {
    label: "Runtime floor",
    source: "apps/cli/package.json engines",
    value: "Node 20.11, or Bun 1.0.23",
  },
  { label: "Listens on", source: "apps/cli/bin/diffhub.mjs", value: "127.0.0.1, port 2047" },
  {
    label: "Inline render ceiling, per file",
    source: "apps/cli/lib/diff-file-stat.ts",
    value: "500 changed lines, or 500,000 bytes of patch",
  },
  {
    label: "Comment store",
    source: "apps/cli/lib/comments.ts",
    value: ".git/diffhub-comments.json, written atomically",
  },
];

const limits = [
  "It generates no findings. If you want a model to review the code for you, that’s an AI code review tool, a different category.",
  "It’s 35.6 MB unpacked against revdiff’s single Go binary. If install weight matters to you, that’s a real reason to pick something else.",
  "It needs Node 20.11 or Bun 1.0.23 on the machine. There’s no standalone binary.",
  "cmux mode is macOS only and expects cmux.app at /Applications/cmux.app. Everywhere else, it’s an ordinary browser tab.",
  "A file with 500 or more changed lines, or 500,000 bytes of patch, isn’t rendered inline. Generated lockfiles and vendored bundles hit this constantly.",
];

/**
 * Questions the H2s don't already answer. An FAQ entry that restates a heading
 * puts two chunks of the page in competition for the same extraction.
 *
 * Read twice, by `<FaqSection>` and by `zoneGraph({ faqs })`.
 */
const faqs: Faq[] = [
  {
    answer:
      "Yes, and it catches real bugs. It reviews the code against the code, though, so it can’t tell you the agent did work you didn’t ask for. Use it as a second pass, not the only one.",
    question: "Can AI review AI-generated code?",
  },
  {
    answer:
      "No. It shows the diff and keeps your comments. The findings are yours, and DiffHub turns them into one prompt the agent can act on.",
    question: "Does DiffHub review the code for you?",
  },
  {
    answer:
      "Tests tell you the code does what the tests say. They don’t tell you the agent touched forty files where three would’ve done, or that it deleted a check it couldn’t satisfy. Read the diff.",
    question: "Should you review agent-written code if the tests pass?",
  },
  {
    answer:
      "DiffHub runs on 127.0.0.1 and makes no outbound requests, so the diff never leaves your machine. An AI reviewer has to send the code to a model, so check where that model runs before you point it at private code.",
    question: "Is it safe to review private code this way?",
  },
  {
    answer: `revdiff, hunk and DiffHub are MIT licensed and free. \`cmux diff\` ships with cmux. \`git diff\` is git. Licences read from the projects’ own pages on ${TOOLS_CHECKED}.`,
    question: "Are these diff tools free?",
  },
];

/**
 * `LearningResource` rides alongside `TechArticle` because it is accurate, not
 * because it earns a rich result. No `about`/`sameAs` for code review: the
 * honest value would be a Wikidata URI, and inventing one to fill a slot is
 * what the spec disqualifies.
 */
const pageJsonLd = zoneGraph({
  faqs,
  nodes: [
    articleNode({
      description: entry.description,
      extra: {
        teaches:
          "What to check when reviewing code written by an AI coding agent, and where to read the diff",
      },
      headline: entry.heading,
      publishedAt,
      type: ["TechArticle", "LearningResource"],
      updatedAt,
      url,
    }),
  ],
  page: { description: entry.description, name: entry.title, url },
  trail: [{ name: entry.label, url }],
  updatedAt,
});

/**
 * next/link for the in-zone row, so the basePath is applied. A plain
 * `<a href="/">` here used to point at blode.co's own root.
 */
const ToolName = ({ href, name }: { href: string | null; name: string }) => {
  if (href === null) {
    return <code className={code}>{name}</code>;
  }
  if (href.startsWith("/")) {
    return (
      <Link className={link} href={href}>
        {name}
      </Link>
    );
  }
  return (
    <a className={link} href={href} rel="noopener noreferrer" target="_blank">
      {name}
    </a>
  );
};

export default function ReviewAiGeneratedCodePage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      <GuideArticle crumb={entry.label} heading={entry.heading} updatedAt={updatedAt}>
        {/* The answer block: the first extractable passage answers the h1. */}
        <p className={lead}>
          Read the whole diff yourself before you merge, against the branch it came from. Look for
          what tests and AI reviewers can’t see: work you didn’t ask for, checks that were deleted
          or loosened, APIs that don’t exist, and behaviour that changed without a word. Then hand
          your notes back to the agent that wrote the code, so it does the fixing.
        </p>

        <h2 className={heading}>What should you check in AI-generated code?</h2>
        <p className={body}>
          Six things, roughly in the order they cost you if they ship. None of them needs you to
          understand every line first.
        </p>
        <ol className={`${body} list-decimal space-y-4 pl-5`}>
          {checks.map((check) => (
            <li key={check.name}>
              <span className="font-medium text-foreground">{check.name}.</span> {check.detail}
            </li>
          ))}
        </ol>
        <p className={body}>
          Agent-written changes also arrive all at once, with no author to ask, and they keep moving
          while you read, because the agent is still going. That last one is what breaks a review
          tool you have to reopen after every edit.
        </p>

        <h2 className={heading}>Is an AI code reviewer enough?</h2>
        <p className={body}>
          No, but it’s a useful second pass. An AI code review tool reads the diff and posts
          findings, usually on the pull request. It’s good at local mistakes: a null that isn’t
          checked, an off-by-one, a missing await.
        </p>
        <p className={body}>
          What it can’t know is what you asked for. It reviews the code against the code, so work
          you didn’t want, or a check that was quietly deleted to make a test pass, can read as
          perfectly reasonable. Run one if you have it. Then read the diff yourself, because you’re
          the only reviewer who knows the intent.
        </p>
        <p className={body}>
          DiffHub isn’t an AI reviewer. It shows you the diff and keeps the notes you write.
        </p>

        <h2 className={heading}>Where should you read an agent’s diff?</h2>
        <p className={body}>
          Wherever you’re going to act on it. Four of the five options below are terminal-shaped and
          one isn’t, and that difference matters more than how any of them renders a diff.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Diff viewers for reviewing agent-written code, checked {TOOLS_CHECKED}
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
                    <ToolName href={tool.href} name={tool.name} />
                  </th>
                  <td className={cell}>{tool.where}</td>
                  <td className={cell}>{tool.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={body}>
          hunk describes itself as “Terminal diffs for humans &amp; agents” and ships a watch mode,
          so on the refresh question it and DiffHub agree. They disagree about the terminal. revdiff
          is “a TUI for reviewing diffs, files, and documents with inline annotations”. Both are MIT
          licensed and free. Both quotes are from their own pages, read {TOOLS_CHECKED}.
        </p>
        <p className={body}>
          cmux users have asked for the refresh too: issue{" "}
          <a
            className={link}
            href="https://github.com/manaflow-ai/cmux/issues/7101"
            rel="noopener noreferrer"
            target="_blank"
          >
            #7101
          </a>{" "}
          requests live reload for <code className={code}>cmux diff</code> and names watching an
          agent’s file changes as the reason. It was open on {TOOLS_CHECKED}.
        </p>

        <h2 className={heading}>How do you hand review notes back to the agent?</h2>
        <p className={body}>
          Write them where you read the diff, then give the agent all of them at once. In DiffHub:
        </p>
        <ol className={`${body} list-decimal space-y-2 pl-5`}>
          <li>
            Run <code className={code}>npx diffhub@latest</code> in the repository the agent
            changed.
          </li>
          <li>Hover a line, click the plus, and write what’s wrong and what you expect instead.</li>
          <li>
            Press Copy &amp; clear in the status bar. Every comment becomes one Markdown prompt.
          </li>
          <li>Paste it into the agent that wrote the code.</li>
        </ol>
        <GuideCommand command="npx diffhub@latest" variant="Browser" />
        <p className={body}>Two comments come out like this:</p>
        <PromptExample comments={example} />
        <p className={body}>
          Each line names the file, the line and the side of the diff. “old side” means the comment
          sits on a removed line, so the agent knows to look at what was there rather than what’s on
          disk now. The viewer has no label picker. Start a note with{" "}
          <code className={code}>[must-fix]</code> or <code className={code}>[nit]</code> and it
          reaches the agent as written, which is enough to tell a blocker from a passing thought.
        </p>
        <p className={body}>
          The other tools do this too. revdiff writes structured annotations to stdout when you quit
          and ships plugins for Claude Code and Codex. hunk renders agent notes inline. The loop
          matters more than the tool.{" "}
          <Link className={link} href="/agent-diff">
            Reviewing any agent’s diff
          </Link>{" "}
          covers it step by step, and{" "}
          <Link className={link} href="/claude-code-review">
            reviewing Claude Code’s changes
          </Link>{" "}
          covers that one agent.
        </p>

        <h2 className={heading}>What does DiffHub need, and when is it the wrong answer?</h2>
        <FactTable caption={`DiffHub key facts, checked ${NPM_CHECKED}`} facts={facts} />
        <ul className={`${body} list-disc space-y-3 pl-5`}>
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>

        <GuideFaq
          faqs={faqs}
          heading="What else do people ask about reviewing AI-generated code?"
        />
        <RelatedGuides current={entry.path} />
        <GuideChangelog entries={CHANGELOG} />
      </GuideArticle>
    </div>
  );
}
