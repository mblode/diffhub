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
import { ReviewDemo } from "@/components/marketing/review-demo";
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
 * Agent-agnostic: the review loop for whatever agent wrote the change, Codex,
 * Cursor or Claude Code. Its own intent is the mechanics (which scope matches
 * how the agent works, worktrees, pull requests, what the prompt carries),
 * not the checklist (`/review-ai-generated-code`) or one agent's workflow
 * (`/claude-code-review`).
 *
 * Nothing here says how a particular agent behaves by default (whether it
 * commits, stages, or uses worktrees). Those change often and this page can't
 * check them, so the scopes are matched to behaviour, not to product names.
 *
 * The review demo is the landing page's, reused as the proof: comment on a
 * line and the prompt underneath rebuilds from the same formatter the CLI's
 * export is tested against.
 */

const entry = guide("/agent-diff");
const url = guideUrl(entry);
const CHANGELOG = CHANGELOGS[entry.path];
const publishedAt = firstDate(CHANGELOG);
const updatedAt = latestDate(CHANGELOG);

export const metadata: Metadata = guideMetadata(entry);

const { body, cell, code, heading, lead, link } = guideClass;

const scopes = [
  { agent: "Edits files and leaves them uncommitted", scope: "Touched, the default" },
  { agent: "Commits as it goes, on a branch", scope: "All, or Committed for just the commits" },
  { agent: "Stages the changes it wants you to see", scope: "Staged" },
];

const example: ReviewComment[] = [
  {
    body: "The old guard returned early on an empty id. Keep it.",
    file: "app/routes/users.ts",
    lineNumber: 31,
    side: "left",
    tag: "",
  },
  {
    body: "[must-fix] This test now expects a 500 for an empty id. It should still be a 400.",
    file: "app/routes/users.test.ts",
    lineNumber: 24,
    side: "right",
    tag: "",
  },
];

const faqs: Faq[] = [
  {
    answer:
      "Yes. DiffHub reads git, not the agent, so it works with any tool that edits files in your repository.",
    question: "Does DiffHub work with Codex, Cursor and Claude Code?",
  },
  {
    answer:
      "No. DiffHub never talks to an agent. Copy & clear puts the prompt on your clipboard and you paste it wherever the agent is running.",
    question: "Can DiffHub send the prompt to the agent for you?",
  },
  {
    answer:
      "The comment is on a removed line. Its line number points into the old version of the file, so it may not exist in the file on disk now. Ask the agent to read the diff before it edits.",
    question: "Why does a comment in the prompt say old side?",
  },
  {
    answer:
      "Yes. They’re saved in `diffhub-comments.json` in the repository’s git directory and stay there until you copy and clear them or delete them.",
    question: "Do comments survive closing the browser?",
  },
  {
    answer:
      "Yes, if each works in its own checkout or worktree. Start DiffHub in each one. The second takes the next free port after 2047.",
    question: "Can you review two agents at once?",
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

// Dev flags anything that would block navigating here. Not in
// e2e/instant.spec.ts, which covers the landing page and three guides.
export const instant = true;

export default function AgentDiffPage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      <GuideArticle crumb={entry.label} heading={entry.heading} updatedAt={updatedAt}>
        <p className={lead}>
          Every coding agent that works in your repository ends the same way: files on disk that
          differ from what git last saw. That’s a git diff, whichever agent wrote it. Run{" "}
          <code className={code}>npx diffhub@latest</code> in the checkout the agent changed, read
          every changed file in one browser tab, comment on lines, then paste one prompt back into
          Codex, Cursor or Claude Code.
        </p>

        <GuideCommand command="npx diffhub@latest" variant="Browser" />

        <h2 className={heading}>What does the review loop look like?</h2>
        <p className={body}>
          Four steps, and the agent does the fixing. Read the whole diff. Comment on the lines that
          are wrong, saying what you expect instead. Press Copy &amp; clear. Paste the prompt into
          the agent. When it’s done, refresh and read the diff again.
        </p>
        <p className={body}>
          Try it here. This is a real hunk from DiffHub’s own history. Click the plus beside a line,
          write a note, and watch the prompt underneath change.
        </p>
        <div className="mt-6">
          <ReviewDemo />
        </div>

        <h2 className={heading}>Which diff scope matches how your agent works?</h2>
        <p className={body}>
          Pick the scope by what the agent did with its changes, not by which agent it is.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Which DiffHub scope to use for each way of working
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className={`${cell} font-medium`} scope="col">
                  If the agent
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Use
                </th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((row) => (
                <tr key={row.agent}>
                  <th className={`${cell} font-normal`} scope="row">
                    {row.agent}
                  </th>
                  <td className={cell}>{row.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={body}>
          All is the whole-branch view: everything since the branch left its base, committed or not,
          plus untracked files. It’s the one to read before you push. DiffHub finds the base from{" "}
          <code className={code}>origin/main</code>, <code className={code}>master</code>,{" "}
          <code className={code}>develop</code> or <code className={code}>dev</code>, and{" "}
          <code className={code}>--base &lt;branch&gt;</code> overrides it.
        </p>

        <h2 className={heading}>What about agents in separate worktrees?</h2>
        <p className={body}>
          Review each worktree on its own. Start DiffHub from inside it, or point at it with{" "}
          <code className={code}>--repo</code>:
        </p>
        <GuideCommand command="npx diffhub@latest --repo ../feature-worktree" variant="Browser" />
        <p className={body}>
          A linked worktree has its own git directory, so its comments stay separate from the main
          checkout’s. If port 2047 is taken, DiffHub uses the next free one up to 2056, so a few can
          run side by side. Starting it again for the same checkout replaces the one already
          running.
        </p>
        <p className={body}>
          Keep each prompt with the checkout you reviewed. Two worktrees can hold the same filename
          with different code in it.
        </p>

        <h2 className={heading}>What if the agent opened a pull request?</h2>
        <p className={body}>
          If it’s on a public GitHub repository, paste its URL into the live demo and read it in the
          same viewer, no install. Comments need the local CLI, because they’re saved in your
          repository, so for a full review check the branch out and run DiffHub with the All scope.
        </p>
        <div className="mt-6">
          <TrackedCta
            className={guideClass.primaryCta}
            href={siteConfig.links.demo}
            label="Open the live demo"
            location="/diffhub/agent-diff"
            opensDemo
          >
            Open the live demo
          </TrackedCta>
        </div>

        <h2 className={heading}>What does the agent receive?</h2>
        <p className={body}>
          Plain Markdown: a heading, one line of instruction, then a bullet per comment with the
          file, the line, the side of the diff and your note. A comment on a removed line and one on
          an added line come out like this:
        </p>
        <PromptExample comments={example} />
        <p className={body}>
          Any agent that takes text can act on that. For what to look for before you write a single
          comment, read{" "}
          <Link className={link} href="/review-ai-generated-code">
            how to review AI-generated code
          </Link>
          . For Claude Code specifically,{" "}
          <Link className={link} href="/claude-code-review">
            reviewing Claude Code’s changes
          </Link>{" "}
          covers the details.
        </p>

        <h2 className={heading}>What are the limits?</h2>
        <ul className={`${body} list-disc space-y-3 pl-5`}>
          <li>
            It reads one checkout at a time. Two agents in two worktrees mean two tabs and two
            prompts.
          </li>
          <li>
            It only sees git. An agent that writes outside the repository, or into ignored files,
            won’t show up.
          </li>
          <li>It needs Node 20.11+ or Bun 1.0.23+ and runs on your machine only.</li>
          <li>It doesn’t review anything itself. The notes are yours.</li>
        </ul>

        <GuideFaq faqs={faqs} heading="What else do people ask about reviewing agent diffs?" />
        <RelatedGuides current={entry.path} />
        <GuideChangelog entries={CHANGELOG} />
      </GuideArticle>
    </div>
  );
}
