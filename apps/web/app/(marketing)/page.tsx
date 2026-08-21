"use client";

import { SplitText } from "griffo/motion";
import { ArrowRightIcon } from "blode-icons-react";
import { stagger } from "motion";
import { MotionConfig, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { DemoLauncher } from "@/components/shared/demo-launcher";
import { FaqSection } from "@/components/shared/faq-section";
import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { CopyButton } from "@/components/ui/copy-button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { asset, siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { zoneGraph } from "@/lib/schema";

const blurUp = {
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
  initial: { filter: "blur(8px)", opacity: 0, y: 12 },
  transition: {
    duration: 0.65,
    ease: [0.25, 1, 0.5, 1] as const,
  },
};

/** The date every checkable claim on this page was last read from its source. */
const CHECKED = "10 Aug 2026";

const updatedAt = latestDate(CHANGELOGS["/"]);

const facts = [
  { label: "Network requests", source: "CLI source", value: "0" },
  { label: "Port", source: "bin/diffhub.mjs", value: "2047" },
  { label: "Node.js", source: "package.json", value: "20.11+" },
  { label: "Licence", source: "GitHub", value: "MIT" },
];

const shortcuts = [
  { keys: ["j", "k"], label: "Move between files" },
  { keys: ["s"], label: "Switch diff view" },
  { keys: ["/"], label: "Filter the tree" },
  { keys: ["r"], label: "Refresh changes" },
  { keys: ["c"], label: "Collapse a file" },
];

/** Shared with zoneGraph so the visible answers and structured data stay identical. */
const faqs: Faq[] = [
  {
    answer:
      "No. \u0060npx diffhub@latest\u0060 opens DiffHub in a normal browser tab. Add \u0060cmux\u0060 to open it in cmux on macOS. That option needs cmux.app in /Applications.",
    question: "Do you need cmux to use DiffHub?",
  },
  {
    answer:
      "No. DiffHub runs on localhost:2047 and stores comments in \u0060.git/diffhub-comments.json\u0060. It does not make network requests.",
    question: "Does DiffHub send your code anywhere?",
  },
  {
    answer:
      "Use \u0060git diff\u0060 for quick checks and scripts. Use DiffHub when you need to review several files or leave comments for the next agent pass.",
    question: "When is git diff enough?",
  },
];

export default function HomePage(): React.JSX.Element {
  return (
    <MotionConfig reducedMotion="user">
      <div className="isolate overflow-clip">
        <JsonLd data={zoneGraph({ faqs, updatedAt })} />

        <section className="relative overflow-hidden bg-[#111111] text-[#f7f7f4]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-[12%] h-full w-px bg-white/10"
          />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="pt-6 [&_[data-slot=breadcrumb-list]]:text-white/45 [&_[data-slot=breadcrumb-page]]:text-white [&_a:hover]:text-white">
              <ZoneBreadcrumb product="DiffHub" />
            </div>

            <div className="grid gap-12 py-12 sm:py-16 lg:min-h-[calc(100svh-6.5rem)] lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-16 lg:py-20">
              <div className="relative z-10">
                <h1 className="sr-only">Review the whole branch.</h1>
                <SplitText
                  animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                  aria-hidden="true"
                  as="p"
                  className="max-w-[13ch] text-balance text-5xl leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl"
                  initial={{ filter: "blur(10px)", opacity: 0, y: 28 }}
                  options={{ type: "words" }}
                  transition={{
                    delay: stagger(0.055),
                    duration: 0.7,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                  waitForFonts={false}
                >
                  <span>Review the whole branch.</span>
                </SplitText>
                <motion.p
                  {...blurUp}
                  className="mt-6 max-w-[44ch] text-pretty text-lg text-white/65"
                  transition={{ ...blurUp.transition, delay: 0.38 }}
                >
                  See every changed file, leave line comments, and send your notes back to your
                  coding agent.
                </motion.p>

                <motion.div
                  {...blurUp}
                  className="mt-8 flex flex-col items-start gap-4"
                  transition={{ ...blurUp.transition, delay: 0.5 }}
                >
                  <code className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#f7f7f4] py-2.5 pr-2 pl-4 font-mono text-[#26251e] text-sm shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
                    <span className="truncate">npx diffhub@latest cmux</span>
                    <CopyButton content="npx diffhub@latest cmux" />
                  </code>
                  <Link
                    className="relative inline-flex items-center gap-1.5 py-2 text-white/65 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white"
                    href={siteConfig.links.demo}
                  >
                    Try a live review
                    <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
                  </Link>
                </motion.div>

                <motion.p
                  {...blurUp}
                  className="mt-7 font-mono text-sm text-white/50"
                  transition={{ ...blurUp.transition, delay: 0.58 }}
                >
                  Runs locally{"\u2009·\u2009"}no account{"\u2009·\u2009"}MIT licensed
                </motion.p>
              </div>

              <motion.div
                animate={{ filter: "blur(0px)", opacity: 1, x: 0 }}
                className="relative -mr-20 lg:mr-[-36vw]"
                initial={{ filter: "blur(12px)", opacity: 0, x: 48 }}
                transition={{ delay: 0.62, duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
              >
                <Link
                  aria-label="Open the live DiffHub demo for oven-sh/bun #16000"
                  className="relative block w-[125%] overflow-hidden rounded-[min(1.4vw,var(--radius-2xl))] bg-[#eceae5] shadow-[0_32px_100px_rgba(0,0,0,0.5)] outline-1 -outline-offset-1 outline-white/15 lg:w-[min(72vw,64rem)]"
                  href={siteConfig.links.demo}
                >
                  <Image
                    alt="DiffHub reviewing a branch with a file tree on the left and added and removed code on the right"
                    className="w-full"
                    height={1411}
                    loading="eager"
                    sizes="(max-width: 1024px) 125vw, 72vw"
                    src={asset("/screenshot.png")}
                    width={2111}
                  />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="border-foreground/10 border-b py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex items-end justify-between gap-8 border-foreground/10 border-b pb-5">
              <p className="font-medium">What the command does</p>
              <p className="text-muted-foreground text-sm">Checked {CHECKED}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4 sm:gap-x-8">
              {facts.map((fact) => (
                <div className="py-7 sm:py-8" key={fact.label}>
                  <dd className="text-3xl tracking-tight sm:text-4xl">{fact.value}</dd>
                  <dt className="mt-3 font-medium">{fact.label}</dt>
                  <dd className="mt-1 font-mono text-muted-foreground text-sm">{fact.source}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 border-foreground/10 border-t pt-8 lg:grid-cols-[7fr_5fr] lg:gap-16">
              <h2 className="max-w-[18ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
                Stop scrolling through diffs.
              </h2>
              <p className="max-w-[48ch] text-pretty text-muted-foreground">
                Terminal output disappears as soon as it scrolls past. DiffHub keeps the whole
                branch open and updates it as files change.
              </p>
            </div>

            <div className="mt-20 sm:mt-24">
              <FeatureShowcase />
            </div>
          </div>
        </section>

        <section className="bg-[#f54e00] py-16 text-[#151611] sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-end lg:gap-16">
              <div>
                <p className="font-mono text-sm">Keyboard shortcuts</p>
                <h2 className="mt-4 max-w-[16ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
                  Review without reaching for the mouse.
                </h2>
              </div>
              <p className="max-w-[48ch] text-pretty text-[#151611]/90">
                Move between files, switch views, filter, refresh, and collapse files from the
                keyboard.
              </p>
            </div>

            <ul className="mt-12 grid border-[#151611]/20 border-y sm:grid-cols-2 lg:grid-cols-5">
              {shortcuts.map((shortcut) => (
                <li
                  className="flex items-center justify-between gap-4 border-[#151611]/20 border-t py-5 first:border-t-0 sm:px-5 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(2n)]:border-l lg:border-t-0 lg:border-l lg:first:border-l-0"
                  key={shortcut.label}
                >
                  <p className="font-medium">{shortcut.label}</p>
                  <KbdGroup>
                    {shortcut.keys.map((key) => (
                      <Kbd className="bg-[#151611] text-[#f7f7f4] ring-transparent" key={key}>
                        {key}
                      </Kbd>
                    ))}
                  </KbdGroup>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-10 rounded-[min(2vw,var(--radius-2xl))] bg-secondary p-6 sm:p-10 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-16 lg:p-14">
              <div>
                <p className="font-mono text-link text-sm">Live demo</p>
                <h2 className="mt-4 max-w-[18ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
                  Open a public pull request.
                </h2>
                <p className="mt-5 max-w-[48ch] text-pretty text-muted-foreground">
                  Paste a GitHub pull request URL to open it in DiffHub. No account or install
                  needed.
                </p>
              </div>
              <DemoLauncher />
            </div>
          </div>
        </section>

        <section className="border-foreground/10 border-t py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
              <div>
                <h2 className="max-w-[16ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
                  A few things to know.
                </h2>
              </div>
              <FaqSection
                answerClassName="mt-3 max-w-[64ch] text-pretty text-muted-foreground"
                className="divide-y divide-foreground/10 border-foreground/10 border-t"
                faqs={faqs}
                itemClassName="py-7 first:pt-0"
                questionClassName="font-medium text-xl tracking-tight"
              />
            </div>

            <p className="mt-12 max-w-[65ch] border-foreground/10 border-t pt-6 text-muted-foreground">
              Compare{" "}
              <Link className="text-link underline-offset-4 hover:underline" href="/cmux-git-diff">
                DiffHub, cmux diff, and hunk
              </Link>
              , or read{" "}
              <Link
                className="text-link underline-offset-4 hover:underline"
                href="/review-ai-generated-code"
              >
                how to review agent-written code
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="bg-[#151611] py-24 text-[#f7f7f4] sm:py-32" id="install">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-10 border-white/10 border-t pt-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-16">
              <div>
                <h2 className="max-w-[17ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
                  Review before you push.
                </h2>
                <p className="mt-5 max-w-[48ch] text-pretty text-white/55">
                  Run DiffHub in any git repository. It finds the base branch and opens the diff on
                  localhost.
                </p>
              </div>
              <div className="flex flex-col items-start gap-5 lg:items-end">
                <code className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#f7f7f4] py-2.5 pr-2 pl-4 font-mono text-[#26251e] text-sm">
                  <span className="truncate">npx diffhub@latest cmux</span>
                  <CopyButton content="npx diffhub@latest cmux" />
                </code>
                <a
                  className="inline-flex items-center gap-1.5 py-2 text-white/55 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white"
                  href={siteConfig.links.docs}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Read the install guide
                  <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
