import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { GuideCommand } from "@/components/guides/guide-command";
import {
  FactTable,
  GuideArticle,
  GuideChangelog,
  GuideFaq,
  RelatedGuides,
  guideClass,
} from "@/components/guides/guide";
import { DemoLauncher } from "@/components/shared/demo-launcher";
import { JsonLd } from "@/components/shared/json-ld";
import { TrackedCta } from "@/components/tracked-cta";
import { CHANGELOGS, firstDate, latestDate } from "@/lib/changelog";
import { asset, siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { guideMetadata, guideUrl } from "@/lib/guide-metadata";
import { guide } from "@/lib/guides";
import { articleNode, zoneGraph } from "@/lib/schema";

/**
 * The category page: "git diff viewer", "diff viewer online", "git diff side
 * by side", "code diff viewer". Most of that demand wants a website you paste
 * two blocks into. DiffHub isn't one, and the page says so in its own section
 * rather than letting "online" in a heading imply otherwise. What it offers
 * instead is the whole working tree of a real repository, which a paste box
 * can't see.
 *
 * Every product claim is checked against apps/cli on the changelog date:
 * split view (`diffStyle` in DiffViewer.tsx), the scopes (`resolveDiff` in
 * lib/git.ts), the 127.0.0.1 bind and the port range (bin/diffhub.mjs), the
 * inline limits (lib/diff-file-stat.ts). Re-read those before editing.
 */

const entry = guide("/git-diff-viewer");
const url = guideUrl(entry);
const CHANGELOG = CHANGELOGS[entry.path];
const publishedAt = firstDate(CHANGELOG);
const updatedAt = latestDate(CHANGELOG);

/** The npm figures were read from the registry on this date, for diffhub 1.0.0. */
const CHECKED = "2026-09-22";

export const metadata: Metadata = guideMetadata(entry);

const { body, cell, code, heading, lead, link, primaryCta } = guideClass;

const faqs: Faq[] = [
  {
    answer:
      "No. DiffHub runs on your machine, because it reads your repository from disk. The closest thing is the live demo, which opens any public GitHub pull request in the same viewer with no install.",
    question: "Is there a hosted online version of DiffHub?",
  },
  {
    answer:
      "No. It serves the viewer from 127.0.0.1, makes no outbound requests while it runs, and keeps comments in `.git/diffhub-comments.json` inside your repository.",
    question: "Does DiffHub upload your code?",
  },
  {
    answer:
      "Yes. Press `s`, or use the layout button in the status bar, to switch between split and unified views. Unified is the default, and the viewer remembers your choice.",
    question: "Can DiffHub show a git diff side by side?",
  },
  {
    answer:
      "No. DiffHub only reads git. For two loose files, `git diff --no-index old.txt new.txt` works in a terminal, and a paste-in diff site works in a browser.",
    question: "Can it compare two files that aren’t in a git repository?",
  },
  {
    answer:
      "`git difftool` hands each changed file to an external tool, one at a time unless you pass `--dir-diff`. DiffHub puts every changed file on one page with a file tree, and keeps line comments you can copy out.",
    question: "How is DiffHub different from git difftool?",
  },
  {
    answer: "Yes. It’s MIT licensed, on npm as `diffhub`, with no account and no paid tier.",
    question: "Is DiffHub free?",
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

const scopes = [
  {
    compares: "HEAD against the working tree, plus untracked files",
    name: "Touched (default)",
  },
  {
    compares: "The merge base with the base branch against the working tree, plus untracked files",
    name: "All",
  },
  { compares: "The merge base against HEAD: your branch’s commits only", name: "Committed" },
  { compares: "HEAD against the index, like git diff --cached", name: "Staged" },
  { compares: "The index against the working tree, like plain git diff", name: "Unstaged" },
];

/**
 * "Typical" on purpose. There are hundreds of paste-in diff sites and some do
 * more than this; the column describes the shape, not any one of them.
 */
const comparison = [
  {
    diffhub: "Every changed file in a git repository",
    paste: "Two blocks of text you paste in",
    row: "What you compare",
  },
  { diffhub: "Node 20.11+ or Bun 1.0.23+, then one command", paste: "None", row: "Setup" },
  {
    diffhub: "A server on 127.0.0.1, on your machine",
    paste: "A page someone else hosts",
    row: "Where your code goes",
  },
  {
    diffhub: "Base branch, merge base, staged, unstaged, untracked",
    paste: "Nothing",
    row: "What it knows about git",
  },
  { diffhub: "The whole change, with a file tree", paste: "One pair", row: "Files at once" },
  { diffhub: "Per line, copied out as one prompt", paste: "Usually none", row: "Comments" },
];

const facts = [
  { label: "Command", source: "npm registry", value: "npx diffhub@latest" },
  {
    label: "Runtime",
    source: "apps/cli/package.json engines",
    value: "Node 20.11+, or Bun 1.0.23+",
  },
  {
    label: "Port",
    source: "apps/cli/bin/diffhub.mjs",
    value: "2047, or the next free port up to 2056",
  },
  { label: "Listens on", source: "apps/cli/bin/diffhub.mjs", value: "127.0.0.1 only" },
  { label: "Outbound requests while running", source: "CLI source", value: "0" },
  {
    label: "Inline render limit, per file",
    source: "apps/cli/lib/diff-file-stat.ts",
    value: "500 changed lines, or 500,000 bytes of patch",
  },
  {
    label: "Package size",
    source: `npm registry, diffhub 1.0.0, read ${CHECKED}`,
    value: "35.6 MB unpacked, 1,829 files",
  },
  { label: "Licence", source: "GitHub", value: "MIT" },
];

const limits = [
  "It isn’t a website. There’s no hosted version for your own code, and the live demo only opens public GitHub pull requests.",
  "It only reads git. It won’t diff two loose files or folders, and it won’t start outside a repository.",
  "It needs Node 20.11+ or Bun 1.0.23+. There’s no standalone binary, and the package is 35.6 MB unpacked.",
  "A file with 500 or more changed lines, or 500,000 bytes of patch, isn’t rendered inline. Lockfiles hit this constantly.",
  "It doesn’t review anything for you. You read the diff. It keeps your notes.",
];

// Dev flags anything that would block navigating here; e2e/instant.spec.ts
// checks it against a production build.
export const instant = true;

export default function GitDiffViewerPage(): React.JSX.Element {
  return (
    <div>
      <JsonLd data={pageJsonLd} />

      <GuideArticle crumb={entry.label} heading={entry.heading} updatedAt={updatedAt}>
        <p className={lead}>
          DiffHub is a git diff viewer that runs on your own machine and opens in your browser. Run{" "}
          <code className={code}>npx diffhub@latest</code> inside a git repository and it serves
          every changed file on <code className={code}>localhost:2047</code>: a file tree on the
          left, the diff on the right, split or unified, with syntax highlighting. Nothing is
          uploaded and there’s no account.
        </p>

        <GuideCommand command="npx diffhub@latest" variant="Browser" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCta
            className={primaryCta}
            href={siteConfig.links.demo}
            label="Open the live demo"
            location="/diffhub/git-diff-viewer"
            opensDemo
          >
            Open the live demo
          </TrackedCta>
          <p className="text-muted-foreground text-sm">
            A real pull request in the same viewer. No install.
          </p>
        </div>

        <TrackedCta
          aria-label="Open the live DiffHub demo for oven-sh/bun #16000"
          className="mt-10 block overflow-hidden rounded-xl bg-[#eceae5] shadow-soft outline-1 -outline-offset-1 outline-foreground/10 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-4"
          href={siteConfig.links.demo}
          label="Git diff viewer screenshot"
          location="/diffhub/git-diff-viewer"
          opensDemo
        >
          <Image
            alt="DiffHub showing a file tree of changed files on the left and a diff with added and removed lines on the right"
            className="w-full"
            height={1411}
            sizes="(max-width: 768px) 100vw, 720px"
            src={asset("/screenshot.png")}
            width={2111}
          />
        </TrackedCta>

        <h2 className={heading}>What does DiffHub show you?</h2>
        <p className={body}>
          Every file that changed, on one page. The tree on the left lists them with their added and
          removed line counts, and filters as you type. The diff on the right runs one file after
          another, so you can scroll the whole change like a pull request, or jump between files
          with <code className={code}>j</code> and <code className={code}>k</code>.
        </p>
        <p className={body}>
          It watches the repository while it’s open. When a file changes, the status bar says
          updates are available, and the diff moves when you press <code className={code}>r</code>.
          Not before, so the line you’re reading doesn’t jump.
        </p>

        <h2 className={heading}>Can you see a git diff side by side?</h2>
        <p className={body}>
          Yes. Press <code className={code}>s</code>, or use the layout button in the status bar, to
          switch between split view, with the old file on the left and the new one on the right, and
          unified view, with removed and added lines in one column. Unified is the default. The
          viewer remembers whichever you picked last.
        </p>

        <h2 className={heading}>Which changes does it compare?</h2>
        <p className={body}>
          By default, everything you haven’t committed: HEAD against your working tree, plus
          untracked files. The scope menu in the status bar has four more views.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">DiffHub diff scopes and what each compares</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className={`${cell} font-medium`} scope="col">
                  Scope
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Compares
                </th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((scope) => (
                <tr key={scope.name}>
                  <th className={`${cell} font-normal`} scope="row">
                    {scope.name}
                  </th>
                  <td className={cell}>{scope.compares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={body}>
          All and Committed need a base branch. DiffHub looks for{" "}
          <code className={code}>origin/main</code>, <code className={code}>origin/master</code>,{" "}
          <code className={code}>origin/develop</code> and <code className={code}>origin/dev</code>,
          then local branches with the same names. Pass{" "}
          <code className={code}>--base &lt;branch&gt;</code> if yours is called something else. The
          merge base is what keeps commits that landed on main after you branched out of your
          review.
        </p>

        <h2 className={heading}>DiffHub or a paste-in online diff tool?</h2>
        <p className={body}>
          Most “diff tool online” results are a page with two boxes. DiffHub runs in a browser too,
          but the page comes from a server on your machine, and it reads the change straight from
          git.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              A typical paste-in online diff tool compared with DiffHub
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className={`${cell} font-medium`} scope="col">
                  <span className="sr-only">Question</span>
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  Typical paste-in site
                </th>
                <th className={`${cell} font-medium`} scope="col">
                  DiffHub
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((item) => (
                <tr key={item.row}>
                  <th className={`${cell} font-normal`} scope="row">
                    {item.row}
                  </th>
                  <td className={cell}>{item.paste}</td>
                  <td className={cell}>{item.diffhub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={body}>
          Use a paste-in site for two snippets that aren’t in a repository: a config from two
          servers, two API responses, a paragraph someone edited. Use DiffHub when the change lives
          in git and spans more than a file or two, and you want to read all of it before you commit
          or push.
        </p>

        <h2 className={heading}>Can you try it without installing anything?</h2>
        <p className={body}>
          Yes, on a public pull request. The live demo is the one hosted part of DiffHub: paste a
          GitHub pull request URL and it opens in the same viewer. It reads the pull request from
          GitHub, so it only works for public repositories, and comments need the local CLI.
        </p>
        <div className="mt-6 rounded-xl bg-secondary/60 px-4 py-6 sm:px-6">
          <DemoLauncher />
        </div>

        <h2 className={heading}>What does it need, and where does it stop?</h2>
        <FactTable caption={`DiffHub facts, checked ${CHECKED}`} facts={facts} />
        <ul className={`${body} list-disc space-y-3 pl-5`}>
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <p className={body}>
          Reviewing what a coding agent wrote is where the comments earn their place.{" "}
          <Link className={link} href="/review-ai-generated-code">
            How to review AI-generated code
          </Link>{" "}
          covers what to look for.
        </p>

        <GuideFaq faqs={faqs} heading="What else do people ask about git diff viewers?" />
        <RelatedGuides current={entry.path} />
        <GuideChangelog entries={CHANGELOG} />
      </GuideArticle>
    </div>
  );
}
