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
import { motion } from "motion/react";
import Image from "next/image";

import { Kbd } from "@/components/marketing/kbd";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
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
    keyword: "PR-style viewer",
    pain: "Scrolling through git diff output",
    solution: "PR-style viewer with file tree and per-file stats",
  },
  {
    keyword: "Inline comments",
    pain: "No way to leave notes before pushing",
    solution: "Inline comments tagged must-fix, suggestion, nit, or question",
  },
  {
    keyword: "Right-click",
    pain: "Switching between terminal and editor",
    solution: "Right-click any file to open in VS Code, Zed, or your terminal",
  },
];

const primaryFeature = {
  description:
    "Diffs against your merge-base, not HEAD. See exactly what changed since you branched \u2014 the same view GitHub shows in Files Changed.",
  icon: FileTextIcon,
  title: "PR-style diffs",
};

const secondaryFeatures = [
  {
    description: "Toggle between side-by-side and inline diffs. Press s to switch.",
    icon: SplitIcon,
    title: "Split and unified",
  },
  {
    description:
      "Leave notes on any line. Tag as must-fix, suggestion, nit, or question. Export all comments as a formatted prompt.",
    icon: Bubble2Icon,
    title: "Inline comments",
  },
  {
    description:
      "Navigate changes in a collapsible file tree. Press / to filter. Per-file insertions and deletions at a glance.",
    icon: ArrowRightIcon,
    title: "File sidebar",
  },
  {
    description: "Watches your working tree. Diffs update automatically when files change.",
    icon: RotateIcon,
    title: "Live refresh",
  },
  {
    description: "Right-click any file to open in VS Code, Zed, Ghostty, Terminal, or Finder.",
    icon: ConsoleIcon,
    title: "Context menu",
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
    <div>
      {/* Hero */}
      <section className="@container py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <SplitText
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            as="h1"
            className="text-balance text-4xl font-medium tracking-tight sm:text-5xl sm:tracking-[-0.03em]"
            initial={{ filter: "blur(8px)", opacity: 0, y: 20 }}
            options={{ type: "words" }}
            transition={{
              delay: stagger(0.04),
              duration: 0.65,
              ease: [0.25, 1, 0.5, 1],
            }}
          >
            <p>See every change before you push.</p>
          </SplitText>
          <motion.p
            {...blurUp}
            className="mx-auto mt-4 max-w-[48ch] text-pretty text-lg text-muted-foreground"
            transition={{ ...blurUp.transition, delay: 0.35 }}
          >
            DiffHub opens a PR-style diff viewer in your browser &mdash; split and unified views,
            file tree, inline comments, live refresh. One command, no config.
          </motion.p>
          <motion.div
            {...blurUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
            transition={{ ...blurUp.transition, delay: 0.5 }}
          >
            <code className="relative inline-flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <span>npx diffhub@latest</span>
              <CopyButton content="npx diffhub@latest" />
            </code>
          </motion.div>
          <motion.div
            {...blurUp}
            className="mt-4 flex items-center justify-center"
            transition={{ ...blurUp.transition, delay: 0.6 }}
          >
            <a
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              href={siteConfig.links.loom}
              rel="noopener noreferrer"
              target="_blank"
            >
              <PlayIcon aria-hidden="true" className="size-3.5" />
              Watch demo
            </a>
          </motion.div>
        </div>

        {/* Screenshot */}
        <motion.div
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          className="hero-glow relative mx-auto mt-16 max-w-5xl px-6"
          initial={{ filter: "blur(8px)", opacity: 0, y: 40 }}
          transition={{
            delay: 0.7,
            duration: 0.8,
            ease: [0.25, 1, 0.5, 1],
          }}
        >
          <div className="overflow-hidden rounded-xl shadow-soft">
            <Image
              alt="DiffHub showing a split-view code diff with file sidebar"
              className="w-full"
              height={2090}
              priority
              src="/screenshot.png"
              width={3454}
            />
          </div>
        </motion.div>
      </section>

      {/* Pain / Solution */}
      <section className="@container py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-balance text-2xl font-medium tracking-tight">
            Terminal diffs weren&rsquo;t built for review.
          </h2>
          <dl className="mt-12 space-y-0">
            {painSolution.map((item) => (
              <div
                className="grid grid-cols-1 gap-2 border-t py-6 text-sm @sm:grid-cols-2 @sm:gap-8"
                key={item.pain}
              >
                <dt className="text-muted-foreground">{item.pain}</dt>
                <dd className="text-foreground">
                  <span className="font-medium text-primary">{item.keyword}</span>
                  {item.solution.slice(item.keyword.length)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="@container py-16 sm:py-24" id="features">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-balance text-2xl font-medium tracking-tight">
            Everything you need to review your own code.
          </h2>

          {/* Primary feature */}
          <div className="mt-12 border-t pt-8">
            <primaryFeature.icon aria-hidden="true" className="size-4 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              <span className="font-medium text-foreground">{primaryFeature.title}</span>{" "}
              {primaryFeature.description}
            </p>
          </div>

          {/* Secondary features */}
          <div className="mt-8 grid grid-cols-1 gap-6 @sm:grid-cols-2">
            {secondaryFeatures.map((feature) => (
              <div className="feature-card space-y-3 border-t pt-6" key={feature.title}>
                <feature.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{feature.title}</span>{" "}
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="@container py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-balance text-2xl font-medium tracking-tight">Keyboard-first.</h2>
          <div className="mt-8 flex flex-wrap gap-6">
            {shortcuts.map((shortcut) => (
              <div className="flex items-center gap-2" key={shortcut.label}>
                <span className="flex gap-1">
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
                <span className="text-sm text-muted-foreground">{shortcut.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install / CTA */}
      <section className="@container py-16 sm:py-24" id="install">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-balance text-2xl font-medium tracking-tight">
            One command. Any repo.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Run inside any git repository. DiffHub auto-detects your base branch and opens at
            localhost.
          </p>
          <div className="mt-8 space-y-3">
            <code className="relative inline-flex items-center gap-2 font-mono text-sm text-foreground">
              <span>npx diffhub@latest</span>
              <CopyButton content="npx diffhub@latest" />
            </code>
            <code className="block font-mono text-sm text-muted-foreground">
              diffhub --base develop
            </code>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              render={<a href={siteConfig.links.docs} rel="noopener noreferrer" target="_blank" />}
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
        </div>
      </section>
    </div>
  );
}
