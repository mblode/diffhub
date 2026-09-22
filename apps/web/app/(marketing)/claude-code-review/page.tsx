import type { Metadata } from "next";
import Link from "next/link";

import { GuideCommand } from "@/components/guides/guide-command";
import {
  GuideArticle,
  GuideChangelog,
  GuideFaq,
  PromptExample,
  RelatedGuides,
  guideClass,
} from "@/components/guides/guide";
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
 * "claude code review" is the largest query in the agent cluster. This page
 * owns one narrow slice of it: reading Claude Code's changes yourself, locally,
 * before you commit or push.
 *
 * DiffHub is not an Anthropic product and not a Claude Code feature, and the
 * page must never read as either: no Anthropic branding, no "official", no
 * title that could pass for a feature name. The disclaimer sits in the first
 * screen, and the mechanism is stated plainly: DiffHub reads the git working
 * tree, which is where Claude Code's edits land. It never talks to Claude Code.
 *
 * Nothing here describes Claude Code's own commands or settings. Those change
 * on Anthropic's schedule and this page can't check them; it only makes
 * claims about DiffHub, checked against apps/cli on the changelog date.
 */

const entry = guide("/claude-code-review");
const url = guideUrl(entry);
const CHANGELOG = CHANGELOGS[entry.path];
const publishedAt = firstDate(CHANGELOG);
const updatedAt = latestDate(CHANGELOG);

export const metadata: Metadata = guideMetadata(entry);

const { body, code, heading, lead, link, primaryCta } = guideClass;

const example: ReviewComment[] = [
  {
    body: "This adds a retry loop I didn’t ask for. Take it out and keep the original single request.",
    file: "lib/sync.ts",
    lineNumber: 88,
    side: "right",
    tag: "[must-fix]",
  },
  {
    body: "Rename to fetchInvoices so it matches the other loaders.",
    file: "lib/invoices.ts",
    lineNumber: 12,
    side: "right",
    tag: "[nit]",
  },
];

const followUp = `Address these review comments in this checkout. Read the diff
and the surrounding code first. Leave unrelated changes alone.
Run the relevant tests and tell me what passed and what didn't.
Don't commit.`;

const faqs: Faq[] = [
  {
    answer:
      "No. DiffHub is an independent, MIT licensed tool by Matthew Blode. It isn’t made by Anthropic and isn’t part of Claude Code. It works with Claude Code because it reads the same git working tree Claude Code edits.",
    question: "Is DiffHub an Anthropic product or a Claude Code feature?",
  },
  {
    answer:
      "No. DiffHub never talks to Claude Code or to any model, so there’s nothing to install into Claude Code and no key to set. You paste the prompt into Claude Code yourself.",
    question: "Does DiffHub need a plugin or an API key?",
  },
  {
    answer:
      "Yes. The default Touched view includes untracked files, so a file Claude Code created shows up before anyone runs `git add`.",
    question: "Will DiffHub show files Claude Code just created?",
  },
  {
    answer:
      "Yes. Switch the scope to All to see the whole branch since it left main, or Committed for the commits alone. Pass `--base <branch>` if your base isn’t main, master, develop or dev.",
    question: "What if Claude Code already committed its changes?",
  },
  {
    answer:
      "Yes, on macOS with cmux installed. `npx diffhub@latest cmux` opens the viewer in a browser split beside the terminal Claude Code is running in.",
    question: "Can you run DiffHub next to Claude Code in cmux?",
  },
];

const pageJsonLd = zoneGraph({
  faqs,
  nodes: [
    articleNode({
      description: entry.description,
      headline: entry.heading,
      publishedAt,
      updatedAt,
      url,
    }),
  ],
  page: { description: entry.description, name: entry.title, url },
  trail: [{ name: entry.label, url }],
  updatedAt,
});

export default function ClaudeCodeReviewPage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      <GuideArticle crumb={entry.label} heading={entry.heading} updatedAt={updatedAt}>
        <p className={lead}>
          Run <code className={code}>npx diffhub@latest</code> in the repository Claude Code is
          working in. Every file it has changed and you haven’t committed, new files included, opens
          in a browser tab on localhost. Comment on the lines you want changed, press Copy &amp;
          clear, and paste the prompt back into Claude Code.
        </p>

        <GuideCommand command="npx diffhub@latest" variant="Browser" />

        <p className={body}>
          DiffHub isn’t made by Anthropic and isn’t part of Claude Code. It doesn’t talk to Claude
          Code at all: no plugin, no API key. It works with Claude Code’s output because Claude Code
          edits files in your repository, and DiffHub reads the repository.
        </p>

        <h2 className={heading}>Why read Claude Code’s diff outside the terminal?</h2>
        <p className={body}>
          Because the question changes once it says it’s done. While it works, Claude Code shows you
          each edit in the conversation, one at a time. Before you commit, you want the total: every
          file that’s different from your last commit, in one place, in an order you choose. By then
          the first edits have scrolled a long way up.
        </p>
        <p className={body}>
          A diff viewer answers that from git, so it doesn’t matter how long the session was or how
          many times Claude Code changed its mind about a file. You see where it ended up.
        </p>

        <h2 className={heading}>Which view shows what Claude Code changed?</h2>
        <p className={body}>
          The default one. DiffHub opens on Touched: HEAD against your working tree, plus untracked
          files. If Claude Code hasn’t committed, that’s exactly its work.
        </p>
        <p className={body}>
          Commit your own changes before you start a session and Touched shows nothing but Claude
          Code’s edits. If you let it commit on a branch, switch the scope to All for the whole
          branch since it left main, or Committed for just the commits. The{" "}
          <Link className={link} href="/git-diff-viewer">
            git diff viewer guide
          </Link>{" "}
          lists all five scopes.
        </p>

        <h2 className={heading}>Can you review while Claude Code is still working?</h2>
        <p className={body}>
          Yes. DiffHub watches the repository, and when Claude Code writes another file the status
          bar says Updates available. The diff doesn’t move until you press{" "}
          <code className={code}>r</code>, so you can finish the file you’re reading, then refresh
          and carry on.
        </p>

        <h2 className={heading}>How do you send your review back to Claude Code?</h2>
        <ol className={`${body} list-decimal space-y-2 pl-5`}>
          <li>Hover a line in the diff, click the plus and write the note.</li>
          <li>
            Save it with <code className={code}>Cmd+Enter</code> or the Comment button. Repeat for
            every line you want changed.
          </li>
          <li>
            Press Copy &amp; clear in the status bar. Every comment becomes one Markdown prompt, and
            the list empties so the next pass starts clean.
          </li>
          <li>Paste the prompt into Claude Code.</li>
        </ol>
        <p className={body}>Two comments come out like this:</p>
        <PromptExample comments={example} />
        <p className={body}>
          The prompt says what to fix. It doesn’t say how to behave, so it’s worth adding a line or
          two after it:
        </p>
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-secondary/50 p-4 font-mono text-muted-foreground text-sm">
          <code>{followUp}</code>
        </pre>
        <p className={body}>
          Copy &amp; clear empties the list as it copies. Paste the prompt before you copy anything
          else.
        </p>

        <h2 className={heading}>Why not ask Claude Code to review its own work?</h2>
        <p className={body}>
          You can, and it’ll find things. It’s a second opinion from the same kind of model that
          wrote the code, working from the same conversation, so it tends to agree with the choices
          it already made. It can’t tell you whether those were the choices you wanted. That read is
          yours, and it’s faster with the whole diff in front of you.{" "}
          <Link className={link} href="/review-ai-generated-code">
            What to check in AI-generated code
          </Link>{" "}
          is a short list to read it against.
        </p>

        <h2 className={heading}>What are the limits?</h2>
        <ul className={`${body} list-disc space-y-3 pl-5`}>
          <li>
            It only sees what’s in git. Changes Claude Code made outside the repository won’t show.
          </li>
          <li>
            The prompt goes back by paste. Nothing reaches Claude Code unless you put it there.
          </li>
          <li>It needs Node 20.11+ or Bun 1.0.23+, and it runs on your machine only.</li>
          <li>
            A file with 500 or more changed lines isn’t rendered inline, so a regenerated lockfile
            won’t fill the page.
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCta
            className={primaryCta}
            href={siteConfig.links.demo}
            label="Open the live demo"
            location="/diffhub/claude-code-review"
            opensDemo
          >
            Open the live demo
          </TrackedCta>
          <p className="text-muted-foreground text-sm">
            See the viewer on a real pull request before you install it.
          </p>
        </div>

        <GuideFaq faqs={faqs} heading="What else do people ask about reviewing Claude Code?" />
        <RelatedGuides current={entry.path} />
        <GuideChangelog entries={CHANGELOG} />
      </GuideArticle>
    </div>
  );
}
