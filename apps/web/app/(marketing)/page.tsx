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

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { siteConfig } from "@/lib/config";

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

export default function HomePage(): React.JSX.Element {
  return (
    <MotionConfig reducedMotion="user">
      <div>
        <section className="@container py-16 sm:py-24">
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
            >
              <p>Review your branch in cmux</p>
            </SplitText>
            <motion.p
              {...blurUp}
              className="mx-auto mt-4 max-w-[48ch] text-pretty text-lg text-muted-foreground"
              transition={{ ...blurUp.transition, delay: 0.35 }}
            >
              DiffHub opens your branch in a cmux browser split and compares it with the detected
              base branch, usually origin/main.
            </motion.p>
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
              className="mt-4 flex items-center justify-center"
              transition={{ ...blurUp.transition, delay: 0.6 }}
            >
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
            <div className="overflow-hidden rounded">
              <Image
                alt="DiffHub showing a branch diff with file sidebar and split view"
                className="w-full"
                height={777}
                priority
                src="/screenshot-2.png"
                width={1400}
              />
            </div>
          </motion.div>
        </section>

        <section className="@container py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="max-w-[40ch] text-balance text-2xl font-medium tracking-tight">
              Why use it
            </h2>
            <dl className="mt-12 space-y-3">
              {painSolution.map((item, index) => (
                <motion.div
                  {...blurUp}
                  className="grid grid-cols-1 gap-2 rounded bg-card p-6 text-sm @sm:grid-cols-2 @sm:gap-8"
                  key={item.pain}
                  transition={{ ...blurUp.transition, delay: 0.1 * index }}
                >
                  <dt className="text-muted-foreground">{item.pain}</dt>
                  <dd className="text-foreground">
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
              What it does
            </h2>

            <dl className="mt-12 grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  {...blurUp}
                  className="rounded bg-card p-6"
                  key={feature.title}
                  transition={{ ...blurUp.transition, delay: 0.1 * index }}
                >
                  <feature.icon aria-hidden="true" className="size-4 shrink-0 text-link" />
                  <dt className="mt-3 text-sm font-semibold text-foreground">{feature.title}</dt>
                  <dd className="mt-1 text-sm text-pretty text-muted-foreground">
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
              Shortcuts
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-5">
              {shortcuts.map((shortcut, index) => (
                <motion.div
                  {...blurUp}
                  className="flex flex-col items-center gap-2 rounded bg-card p-4 text-center"
                  key={shortcut.label}
                  transition={{ ...blurUp.transition, delay: 0.06 * index }}
                >
                  <KbdGroup>
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                  <span className="text-sm text-muted-foreground">{shortcut.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="@container py-16 sm:py-24" id="install">
          <div className="mx-auto max-w-4xl px-6">
            <motion.div {...blurUp} className="rounded bg-card p-12 text-center">
              <h2 className="mx-auto max-w-[30ch] text-balance text-2xl font-medium tracking-tight">
                Run it in any repo
              </h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-pretty text-muted-foreground">
                Use the cmux command if you want the diff in cmux. Use the default command if you
                want it in a normal browser window.
              </p>
              <div className="mt-8 flex justify-center">
                <code className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-sm text-foreground">
                  <span>npx diffhub@latest cmux</span>
                  <CopyButton content="npx diffhub@latest cmux" />
                </code>
              </div>
              <p className="mx-auto mt-4 max-w-[40ch] text-pretty text-sm text-muted-foreground">
                No cmux? Run <code>npx diffhub@latest</code>.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  render={
                    <a href={siteConfig.links.docs} rel="noopener noreferrer" target="_blank" />
                  }
                >
                  Read the docs
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
                <Button
                  render={
                    <a href={siteConfig.links.github} rel="noopener noreferrer" target="_blank" />
                  }
                  variant="outline"
                >
                  View on GitHub
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
