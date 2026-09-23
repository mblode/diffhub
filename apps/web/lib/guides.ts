import type { CHANGELOGS } from "@/lib/changelog";

/**
 * Every guide page in the zone, in one list, so the four places that name them
 * cannot disagree: each page's own metadata, the landing page's guides row, the
 * related links at the foot of every guide, `app/sitemap.ts` and
 * `app/llms.txt/route.ts`.
 *
 * `path` is keyed to `CHANGELOGS`, so a guide added here without a changelog
 * fails `tsc` instead of shipping a sitemap entry with no date.
 *
 * Each guide owns one search intent. Before adding one, check the intents
 * below: two pages chasing the same query split the clicks between them and
 * usually rank neither.
 *
 * - `/git-diff-viewer`: the category. "git diff viewer", "diff viewer online",
 *   "git diff side by side", "code diff viewer".
 * - `/review-ai-generated-code`: the method. "review ai generated code", "ai
 *   code review tool", "ai code reviewer". What to check, and where an AI
 *   reviewer does and doesn't help.
 * - `/claude-code-review`: one agent's workflow. Reading Claude Code's
 *   uncommitted changes before a commit.
 * - `/agent-diff`: any agent. The whole-branch diff and the comment loop for
 *   Codex, Cursor and Claude Code alike, including agents in worktrees.
 * - `/cmux-git-diff`: the cmux cluster, which already converts. Don't retitle it.
 *
 * Type-only import, so this stays a leaf at runtime like `lib/changelog.ts`.
 */
export interface Guide {
  /** Meta description. Also the WebPage and article description. */
  description: string;
  /** The visible H1. */
  heading: string;
  /** Short name for the breadcrumb leaf and for links to the page. */
  label: string;
  /** One line under the link in guide lists. */
  pitch: string;
  path: keyof typeof CHANGELOGS & `/${string}`;
  /** The `llms.txt` summary. */
  summary: string;
  /** Bare `<title>`; the root layout's template appends " | DiffHub". */
  title: string;
}

export const GUIDES = [
  {
    description:
      "Run npx diffhub@latest in any git repo to read every changed file side by side or unified in your browser. Local, nothing uploaded, free and MIT licensed.",
    heading: "A git diff viewer for your whole branch",
    label: "Git diff viewer",
    path: "/git-diff-viewer",
    pitch: "Every changed file, split or unified, in a local browser tab.",
    summary:
      "What DiffHub is as a git diff viewer: one command, every changed file in a browser tab on localhost, split or unified, five diff scopes, and an honest comparison with paste-two-boxes online diff tools.",
    title: "Git diff viewer that runs in your browser, side by side",
  },
  {
    description:
      "Tests pass and the AI reviewer signed off. What still needs a human: scope, deleted checks, invented APIs. A checklist, and a local way to read the diff.",
    heading: "How to review AI-generated code before you merge it",
    label: "Review AI-generated code",
    path: "/review-ai-generated-code",
    pitch: "What to check that tests and AI reviewers miss.",
    summary:
      "A checklist for reviewing code an AI agent wrote, where an AI code reviewer helps and where it can't, and five places to read the diff compared, with stated limits.",
    title: "How to review AI-generated code before you merge it",
  },
  {
    description:
      "Claude Code edits your working tree, so a git diff viewer can read its work. Open every change in a local tab, comment on lines, paste the notes back in.",
    heading: "Review Claude Code’s changes before you commit",
    label: "Review Claude Code’s changes",
    path: "/claude-code-review",
    pitch: "Read its diff and hand the notes back before you commit.",
    summary:
      "Reviewing Claude Code's changes locally before committing: open its uncommitted work in DiffHub, keep the view open while it edits, and paste line comments back as one prompt. DiffHub is not an Anthropic product.",
    title: "Review Claude Code’s changes locally before you commit",
  },
  {
    description:
      "Codex, Cursor and Claude Code all end in a git diff. Read the whole branch in one local tab, comment inline, then paste one prompt back into the agent.",
    heading: "Review any coding agent’s diff",
    label: "Review any agent’s diff",
    path: "/agent-diff",
    pitch: "Codex, Cursor or Claude Code: one review loop for all of them.",
    summary:
      "One review loop for any coding agent: pick the diff scope that matches how the agent works, read the whole branch, comment inline, and paste one prompt back. Covers agents in separate worktrees.",
    title: "Agent code review: read any coding agent’s diff locally",
  },
  {
    description:
      "Compare three cmux diff viewer options: the built-in cmux diff, git diff in a pane, or DiffHub for a branch view that detects changes while you edit.",
    heading: "cmux diff viewer: three ways to review a branch",
    label: "cmux diff viewer",
    path: "/cmux-git-diff",
    pitch: "Three ways to review a branch in cmux.",
    summary:
      "The three ways to read a branch diff in cmux, what the built-in cmux diff does, why it does not refresh yet, how to install and drive DiffHub in a cmux split, and the other tools people have built.",
    title: "cmux diff viewer: three ways to review a branch",
  },
] as const satisfies readonly Guide[];

export type GuideEntry = (typeof GUIDES)[number];

export type GuidePath = GuideEntry["path"];

export const guide = (path: GuidePath): GuideEntry => {
  const found = GUIDES.find((entry) => entry.path === path);
  if (!found) {
    throw new Error(`No guide at ${path}`);
  }
  return found;
};
