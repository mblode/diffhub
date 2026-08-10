"use client";

import {
  ArrowRightIcon,
  Bubble2Icon,
  ConsoleIcon,
  FileTextIcon,
  PlayIcon,
  RotateIcon,
  SplitIcon,
} from "blode-icons-react";
import { SplitText } from "griffo/motion";
import { stagger } from "motion";
import { MotionConfig, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import { AuthorByline } from "@/components/shared/author-byline";
import { DemoLauncher } from "@/components/shared/demo-launcher";
import { FaqSection } from "@/components/shared/faq-section";
import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { asset, siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { zoneGraph } from "@/lib/schema";

const blurUp = {
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
  initial: { filter: "blur(8px)", opacity: 0, y: 8 },
  transition: {
    duration: 0.65,
    ease: [0.25, 1, 0.5, 1] as const,
  },
};

const painSolution = [
  {
    keyword: "Stay in cmux",
    pain: "You want to review a branch without leaving your local workflow",
    solution: "Stay in cmux with a browser split for the diff.",
  },
  {
    keyword: "See the full branch",
    pain: "git diff is fine until the branch gets big",
    solution: "See the full branch against the detected base branch.",
  },
  {
    keyword: "Leave notes as you review",
    pain: "You want a quick review pass before opening a PR",
    solution: "Leave notes as you review, then jump back into your editor.",
  },
];

const features = [
  {
    description: "Run diffhub cmux and open the diff in a cmux browser split.",
    icon: FileTextIcon,
    title: "cmux",
  },
  {
    description: "DiffHub compares your branch to the detected base branch, usually origin/main.",
    icon: SplitIcon,
    title: "Branch diff",
  },
  {
    description: "Toggle between side-by-side and inline diffs.",
    icon: Bubble2Icon,
    title: "Views",
  },
  {
    description: "Leave notes on any line and copy them as a prompt.",
    icon: ArrowRightIcon,
    title: "Notes",
  },
  {
    description: "Keep the view open while you edit and refresh the diff as needed.",
    icon: RotateIcon,
    title: "Refresh",
  },
  {
    description: "Right-click any file to open it in VS Code, Zed, Ghostty, Terminal, or Finder.",
    icon: ConsoleIcon,
    title: "Open files",
  },
];

const shortcuts = [
  { keys: ["j", "k"], label: "Navigate files" },
  { keys: ["s"], label: "Toggle view" },
  { keys: ["/"], label: "Filter files" },
  { keys: ["r"], label: "Refresh" },
  { keys: ["c"], label: "Collapse file" },
];

/** The date every checkable number on this page was last read from its source. */
const CHECKED = "2026-08-10";

const updatedAt = latestDate(CHANGELOGS["/"]);

/**
 * The one axis that decides this choice is whether the view keeps up while the
 * branch is still moving, so it gets a column. Two rows answer with something
 * other than DiffHub, which is the test a comparison table has to pass to be a
 * comparison rather than an advert. Claims about hunk and cmux diff are the
 * same ones /review-ai-generated-code sources, checked on the same date.
 */
const options = [
  {
    cost: "npx, 35.7 MB unpacked",
    name: "DiffHub",
    refreshes: "Yes",
    where: "A browser tab, or a cmux split",
  },
  {
    cost: "None, it ships with cmux",
    name: "cmux diff",
    refreshes: "No, issue #7101 is open",
    where: "A cmux pane",
  },
  {
    cost: "None, it is git",
    name: "git diff main...HEAD",
    refreshes: "No, it runs once",
    where: "Whichever pane you ran it in",
  },
  {
    cost: "Install hunk",
    name: "hunk",
    refreshes: "Yes, it ships a watch mode",
    where: "The terminal",
  },
];

/**
 * Item 11's proof block. No case studies and no testimonials, because there are
 * none: every row here is a number a reader can check against npm, GitHub or
 * the source in a click. That includes the star count, which is small. A number
 * you can verify is worth more than a number that flatters.
 */
const facts = [
  { label: "Licence", source: "GitHub", value: "MIT" },
  { label: "Published version", source: "npm registry", value: "0.3.3, on 2026-08-06" },
  { label: "Releases published", source: "npm registry", value: "35, since 2026-04-13" },
  { label: "GitHub stars, forks", source: "GitHub", value: "19, 4" },
  { label: "Install size", source: "npm registry", value: "35.7 MB unpacked, 1,827 files" },
  { label: "Runtime floor", source: "apps/cli/package.json", value: "Node 20.11, or Bun 1.0.23" },
  { label: "Where it serves", source: "apps/cli/bin/diffhub.mjs", value: "localhost, port 2047" },
  { label: "Outbound requests", source: "CLI source", value: "None" },
];

/**
 * Read twice: by `<FaqSection>` for the markup and by `zoneGraph({ faqs })` for
 * `acceptedAnswer`. One array, so the two cannot disagree. Backticks become
 * `<code>` and are stripped for the schema; see `lib/faq.ts`.
 */
const faqs: Faq[] = [
  {
    answer:
      "Yes. It is MIT licensed and published on npm as `diffhub`. There is no account and no paid tier. `npx diffhub@latest cmux` runs the current version without installing anything globally.",
    question: "Is DiffHub free?",
  },
  {
    answer:
      "No. `npx diffhub@latest` opens the same viewer in an ordinary browser tab. The `cmux` subcommand only adds the browser split, and that path is macOS only, because it expects cmux.app in /Applications.",
    question: "Do you need cmux to use DiffHub?",
  },
  {
    answer:
      "The merge base with the detected base branch, preferring `origin/main` over a local `main` so unpushed commits still show up. It is what `git diff main...HEAD` gives you, rendered.",
    question: "What does DiffHub compare your branch against?",
  },
  {
    answer:
      "No. It runs on localhost, port 2047, against the repository you point it at. Comments go to `.git/diffhub-comments.json` inside that repository. The CLI makes no outbound requests.",
    question: "Does DiffHub send your code anywhere?",
  },
  {
    answer:
      "Node 20.11 or Bun 1.0.23. The package is 35.7 MB unpacked across 1,827 files, and there is no standalone binary. If install weight matters to you, that is a real reason to pick something else.",
    question: "What does DiffHub need to run?",
  },
];

const cell = "border-border/60 border-b py-3 pr-6 align-top";

/** What the 90-second demo covers, for anyone who would rather not watch it. */
const demoBeats = [
  "Opening a branch with npx diffhub@latest cmux",
  "The file sidebar, with per-file + and - counts",
  "Pressing s to flip between split and unified",
  "Leaving a comment on a line, tagged [must-fix]",
  "Copying the comments out as a markdown prompt",
  "The diff refreshing after an edit, with no reopen",
];

export default function HomePage(): React.JSX.Element {
  return (
    <MotionConfig reducedMotion="user">
      <div>
        {/* Moved here from app/layout.tsx, which emitted it on every route and
            so gave every inner page a second BreadcrumbList under the same
            `@id` as its own. The zone root's trail ends at the product, so it
            passes no `trail`. See lib/schema.ts. */}
        <JsonLd data={zoneGraph({ faqs, updatedAt })} />
        {/* Matched word for word by the BreadcrumbList `zoneGraph` emits above.
            Aligned to the navbar's container so the trail sits under the
            wordmark. */}
        <div className="mx-auto max-w-4xl px-6 pt-6">
          <ZoneBreadcrumb product="DiffHub" />
        </div>

        <section className="@container pt-8 pb-16 sm:pt-12 sm:pb-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <SplitText
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              as="h1"
              className="mx-auto max-w-[30ch] text-balance text-4xl font-medium tracking-tight sm:text-5xl sm:tracking-[-0.03em]"
              initial={{ filter: "blur(8px)", opacity: 0, y: 20 }}
              options={{ type: "words" }}
              transition={{
                delay: stagger(0.04),
                duration: 0.65,
                ease: [0.25, 1, 0.5, 1],
              }}
              /*
                griffo defaults this to true, and its wrapper style is
                `visibility: isReady || !waitForFonts ? "visible" : "hidden"`
                (dist/motion.js:2007) with `isReady` starting false and only
                flipping in a layout effect after document.fonts.ready. So the
                default shipped an inline `visibility: hidden` on the h1 in the
                server HTML, on the one element the rest of this page supports.
                Anything reading rendered text without waiting on font loading
                saw a hidden heading.

                Turning it off drops only the pre-split hide; the split still
                runs in the layout effect and the stagger is unchanged. If a
                cold font cache ever makes the split visibly reflow, the other
                fix is `style={{ visibility: "visible" }}`, which wins because
                userStyle is spread after visibility at that same line.
              */
              waitForFonts={false}
            >
              <span>Review your git diff in cmux</span>
            </SplitText>
            <motion.p
              {...blurUp}
              className="mx-auto mt-4 max-w-[48ch] text-pretty text-lg text-muted-foreground"
              transition={{ ...blurUp.transition, delay: 0.35 }}
            >
              DiffHub is a free git diff viewer for cmux. Run{" "}
              <code className="font-mono">npx diffhub@latest cmux</code> and your full branch diff
              opens in a browser split beside the agent, compared against the detected base branch,
              usually <code className="font-mono">origin/main</code>. It refreshes while you keep
              editing, so you never reopen it to see the fix you just made.
            </motion.p>
            <motion.div {...blurUp} transition={{ ...blurUp.transition, delay: 0.4 }}>
              <AuthorByline key="byline" className="justify-center" updated={updatedAt} />
            </motion.div>
            <motion.div
              {...blurUp}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
              transition={{ ...blurUp.transition, delay: 0.5 }}
            >
              <code className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-sm text-muted-foreground">
                <span>npx diffhub@latest cmux</span>
                <CopyButton content="npx diffhub@latest cmux" />
              </code>
            </motion.div>
            <motion.p
              {...blurUp}
              className="mx-auto mt-4 max-w-[48ch] text-pretty text-sm text-muted-foreground"
              transition={{ ...blurUp.transition, delay: 0.55 }}
            >
              Prefer a normal browser tab? Run <code>npx diffhub@latest</code>.
            </motion.p>
            <motion.div
              {...blurUp}
              className="mt-4 flex items-center justify-center gap-4"
              transition={{ ...blurUp.transition, delay: 0.6 }}
            >
              <Link
                className="inline-flex items-center gap-1.5 py-2 text-sm text-link transition-colors hover:text-link/90"
                href={siteConfig.links.demo}
              >
                <SplitIcon aria-hidden="true" className="size-3.5 shrink-0" />
                Try the live demo
              </Link>
              <a
                className="inline-flex items-center gap-1.5 py-2 text-sm text-link transition-colors hover:text-link/90"
                href={siteConfig.links.loom}
                rel="noopener noreferrer"
                target="_blank"
              >
                <PlayIcon aria-hidden="true" className="size-3.5 shrink-0" />
                Watch demo
              </a>
            </motion.div>
            <motion.div
              {...blurUp}
              className="mt-8"
              transition={{ ...blurUp.transition, delay: 0.65 }}
            >
              <DemoLauncher />
            </motion.div>
          </div>

          <motion.div
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            className="relative mx-auto mt-16 max-w-5xl px-6"
            initial={{ filter: "blur(8px)", opacity: 0, y: 40 }}
            transition={{
              delay: 0.7,
              duration: 0.8,
              ease: [0.25, 1, 0.5, 1],
            }}
          >
            <Link
              aria-label="Open the live DiffHub demo for oven-sh/bun #16000"
              className="block rounded bg-card p-6 transition-shadow hover:shadow-lg"
              href={siteConfig.links.demo}
            >
              <Image
                alt="DiffHub live demo rendering a GitHub pull request diff with a file sidebar and split view"
                className="w-full rounded"
                height={777}
                priority
                src={asset("/screenshot-2.png")}
                width={1400}
              />
            </Link>
          </motion.div>

          {/*
            Standing in for a transcript, and placed beside the screenshot
            rather than in the hero: six bullets of narration above the install
            command turned one clear next step into a wall.

            An embed was not an option. The demo is on Loom and next.config.js
            sets no frame-src, so `default-src 'self'` denies the iframe and it
            would render an empty box. A list of what the video covers carries
            the information a transcript would, and unlike the video it is text
            a crawler can read.
          */}
          <div className="mx-auto mt-8 max-w-5xl px-6">
            <p className="text-muted-foreground text-sm">
              What the 90-second{" "}
              <a
                className="text-link transition-colors hover:text-link/90"
                href={siteConfig.links.loom}
                rel="noopener noreferrer"
                target="_blank"
              >
                demo
              </a>{" "}
              shows:
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-muted-foreground text-sm @lg:grid-cols-2">
              {demoBeats.map((beat) => (
                <li key={beat}>{beat}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="@container py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              Why isn&rsquo;t git diff enough once the branch gets big?
            </h2>
            {/* The cost, in their words, before the answers. A problem block
                that only lists solutions is a feature grid wearing a hat. */}
            <p className="mt-4 max-w-[60ch] text-pretty text-muted-foreground">
              A forty-file change isn&rsquo;t a comprehension problem yet, it&rsquo;s a reading
              problem. <code className="font-mono text-sm">git diff</code> in a pane scrolls past
              you, and <code className="font-mono text-sm">cmux diff</code> doesn&rsquo;t watch the
              files, so every fix means running it again. The reading you skip is where the bugs
              stay.
            </p>
            <dl className="mt-8 space-y-3">
              {painSolution.map((item, index) => (
                <motion.div
                  {...blurUp}
                  className="grid grid-cols-1 gap-2 rounded bg-card p-6 text-sm @sm:grid-cols-2 @sm:gap-8"
                  key={item.pain}
                  transition={{ ...blurUp.transition, delay: 0.1 * index }}
                >
                  <dt key="dt" className="text-muted-foreground">
                    {item.pain}
                  </dt>
                  <dd key="dd" className="text-foreground">
                    <span className="font-semibold">{item.keyword}</span>
                    {item.solution.slice(item.keyword.length)}
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>
        </section>

        <section className="@container py-16 sm:py-24" id="features">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              What can you do in the DiffHub diff viewer?
            </h2>

            <dl className="mt-12 grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  {...blurUp}
                  className="rounded bg-card p-6"
                  key={feature.title}
                  transition={{ ...blurUp.transition, delay: 0.1 * index }}
                >
                  <feature.icon
                    key="icon"
                    aria-hidden="true"
                    className="size-4 shrink-0 text-link"
                  />
                  <dt key="dt" className="mt-3 text-sm font-semibold text-foreground">
                    {feature.title}
                  </dt>
                  <dd key="dd" className="mt-1 text-sm text-pretty text-muted-foreground">
                    {feature.description}
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>
        </section>

        <section className="@container py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              What are the keyboard shortcuts?
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-5">
              {shortcuts.map((shortcut, index) => (
                <motion.div
                  {...blurUp}
                  className="flex flex-col items-center gap-2 rounded bg-card p-4 text-center"
                  key={shortcut.label}
                  transition={{ ...blurUp.transition, delay: 0.06 * index }}
                >
                  <KbdGroup key="kbd">
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                  <span key="label" className="text-sm text-muted-foreground">
                    {shortcut.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="@container py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              How does DiffHub compare with cmux diff, git diff, and hunk?
            </h2>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Ways to read a branch diff while an agent is still working, checked {CHECKED}
                </caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th className={`${cell} font-medium`} scope="col">
                      Option
                    </th>
                    <th className={`${cell} font-medium`} scope="col">
                      Where you read it
                    </th>
                    <th className={`${cell} font-medium`} scope="col">
                      Refreshes as you edit
                    </th>
                    <th className={`${cell} font-medium`} scope="col">
                      Install cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((option) => (
                    <tr key={option.name}>
                      <th className={`${cell} font-normal`} scope="row">
                        <code className="font-mono text-sm">{option.name}</code>
                      </th>
                      <td className={cell}>{option.where}</td>
                      <td className={cell}>{option.refreshes}</td>
                      <td className={cell}>{option.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              If you only need one question answered, run{" "}
              <code className="font-mono text-sm">git diff main...HEAD</code> and skip all of this.
              If you never want to leave the terminal, DiffHub is the wrong pick.
            </p>
          </div>
        </section>

        <section className="@container py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              What can you check before you install it?
            </h2>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  DiffHub facts, every row read from its source on {CHECKED}
                </caption>
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
              Every row read from its source on {CHECKED}. There are no case studies here and no
              testimonials, because there are none to report.
            </p>
          </div>
        </section>

        <section className="@container py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              What else do people ask about DiffHub?
            </h2>
            <FaqSection
              answerClassName="mt-2 max-w-[70ch] text-pretty text-muted-foreground"
              faqs={faqs}
              questionClassName="mt-8 font-medium text-lg tracking-tight"
            />
          </div>
        </section>

        <section className="@container py-16 sm:py-24" id="install">
          <div className="mx-auto max-w-4xl px-6">
            <motion.div {...blurUp} className="text-center">
              <h2
                key="heading"
                className="mx-auto max-w-[30ch] text-balance text-4xl font-medium tracking-tight sm:text-5xl sm:tracking-[-0.03em]"
              >
                How do you install DiffHub?
              </h2>
              <p
                key="description"
                className="mx-auto mt-4 max-w-[48ch] text-pretty text-muted-foreground"
              >
                Free and MIT licensed. No account, no paid tier. Use the cmux command if you want
                the diff in cmux, or the default command if you want it in a normal browser window.
              </p>
              <div key="install" className="mt-8 flex justify-center">
                <code className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-sm text-foreground">
                  <span>npx diffhub@latest cmux</span>
                  <CopyButton content="npx diffhub@latest cmux" />
                </code>
              </div>
              <p
                key="alt"
                className="mx-auto mt-4 max-w-[40ch] text-pretty text-sm text-muted-foreground"
              >
                No cmux? Run <code>npx diffhub@latest</code>.
              </p>
              {/* One button. GitHub was a second `lg` button of equal weight,
                  which made the section ask for two decisions and answer
                  neither. It is a text link now; the copyable command above is
                  the actual next step. */}
              <div key="actions" className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  render={
                    <a href={siteConfig.links.docs} rel="noopener noreferrer" target="_blank" />
                  }
                  size="lg"
                >
                  Read the docs
                </Button>
              </div>
              <p key="source" className="mt-4 text-sm text-muted-foreground">
                Or read the source{" "}
                <a
                  className="text-link transition-colors hover:text-link/90"
                  href={siteConfig.links.github}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  on GitHub
                </a>
                .
              </p>
              <p key="guide" className="mt-8 text-sm text-muted-foreground">
                cmux has its own diff viewer now.{" "}
                <Link
                  className="text-link transition-colors hover:text-link/90"
                  href="/cmux-git-diff"
                >
                  How to view a git diff in cmux
                </Link>{" "}
                covers where each one fits, and{" "}
                <Link
                  className="text-link transition-colors hover:text-link/90"
                  href="/review-ai-generated-code"
                >
                  how to review code an AI agent wrote
                </Link>{" "}
                covers the wider field.
              </p>
            </motion.div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
