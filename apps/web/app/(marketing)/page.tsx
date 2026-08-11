"use client";

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

/** The date every checkable number on this page was last read from its source. */
const CHECKED = "2026-08-10";

const updatedAt = latestDate(CHANGELOGS["/"]);

/**
 * Four rows, each answering something a reader needs before typing the command:
 * what it costs to pull, whether it runs on their machine, where it listens,
 * and whether it phones home. Every value carries the source it came from.
 *
 * Licence, published version, release count and star count were cut. Licence is
 * already stated twice in the hero and once at install; `npx @latest` means
 * nobody picks a version; and a release count and a 19-star badge are signals
 * about the project, not answers about the command. A spec sheet is not proof.
 */
const facts = [
  { label: "Install size", source: "npm registry", value: "35.7 MB unpacked, 1,827 files" },
  { label: "Runtime floor", source: "apps/cli/package.json", value: "Node 20.11, or Bun 1.0.23" },
  { label: "Where it runs", source: "apps/cli/bin/diffhub.mjs", value: "localhost, port 2047" },
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
      "No. `npx diffhub@latest` opens the same viewer in a browser tab. The `cmux` subcommand just adds the browser split, and that path is macOS only: it expects cmux.app in /Applications.",
    question: "Do you need cmux to use DiffHub?",
  },
  {
    answer:
      "No. It runs on localhost, port 2047, against the repo you point it at. Comments go to `.git/diffhub-comments.json` in that repo. The CLI makes no outbound requests.",
    question: "Does DiffHub send your code anywhere?",
  },
];

// pr-3 below sm: at 390px the 4-column tables overflowed their container by
// ~40px and scrolled with no affordance, which hid the last column entirely.
// Tightening the gutter removes the overflow rather than hinting at it.
const cell = "border-border/60 border-b py-3 pr-2 align-top sm:pr-6";

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
            {/* One sentence, no inline code. This used to carry the full 53-word
                answer block with two `<code>` spans in it, which set six ragged
                centred lines under the h1 and buried the command pill below the
                fold. The command belongs in the pill; the h1 and this line
                together still answer the question a reader arrives with. */}
            <motion.p
              {...blurUp}
              className="mx-auto mt-4 max-w-[46ch] text-pretty text-lg text-muted-foreground"
              transition={{ ...blurUp.transition, delay: 0.35 }}
            >
              A free git diff viewer for cmux. Your whole branch opens in a browser split next to
              the agent, and it refreshes while you edit.
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
            {/* One line of fine print, not three. The alternate command and the
                proof were separate stacked lines, which turned the space under
                the CTA into a pile of small grey text. */}
            <motion.p
              {...blurUp}
              className="mx-auto mt-4 max-w-[48ch] text-pretty text-sm text-muted-foreground"
              transition={{ ...blurUp.transition, delay: 0.55 }}
            >
              No cmux? Run <code>npx diffhub@latest</code>. MIT licensed, no account.
            </motion.p>
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
              {/* DiffHub reviewing this repository. The one it replaced was a
                  light-theme diff of a single file with no browser chrome,
                  which read as a generic diff rather than as this product.
                  This one carries the DiffHub tab, the branch picker, the file
                  tree with M and A markers, and real added and removed lines. */}
              <Image
                alt="DiffHub reviewing a branch of its own repository: the file tree on the left with modified and added markers, and a split diff with added and removed lines on the right"
                className="w-full rounded"
                height={1411}
                priority
                src={asset("/screenshot.png")}
                width={2111}
              />
            </Link>
          </motion.div>

          {/* Try-before-install sits with the screenshot, not in the hero. Both
              answer "show me it working", and in the hero its solid Open button
              was the loudest thing on the page, competing with the install
              command every other line is about. */}
          <motion.div
            className="mx-auto mt-8 max-w-5xl px-6"
            {...blurUp}
            transition={{ ...blurUp.transition, delay: 0.75 }}
          >
            <DemoLauncher />
          </motion.div>
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
            {/* The three facts the six feature cards carried that nothing else
                on the page states. Six cards for three facts was the reason the
                grid went. */}
            <p className="mt-4 max-w-[60ch] text-pretty text-muted-foreground">
              DiffHub opens your whole branch against the detected base branch, usually{" "}
              <code className="font-mono text-sm">origin/main</code>. Toggle between side-by-side
              and inline diffs, and leave notes on any line: they&rsquo;ll copy out as a prompt when
              you&rsquo;re done. Right-click any file to open it in VS Code, Zed, Ghostty, Terminal,
              or Finder.
            </p>
            {/* The comparison table lived here. /cmux-git-diff sets DiffHub
                against four cmux tools with languages and star counts, and
                /review-ai-generated-code sets it against the wider field. Three
                comparison tables across three pages was two too many, and the
                homepage owned the weakest one. */}
            <p className="mt-4 max-w-[60ch] text-pretty text-muted-foreground">
              If you only need one question answered, run{" "}
              <code className="font-mono text-sm">git diff main...HEAD</code> and skip all of this.
              If you never want to leave the terminal, DiffHub isn&rsquo;t the pick:{" "}
              <Link
                className="text-link transition-colors hover:text-link/90"
                href="/cmux-git-diff"
              >
                how to view a git diff in cmux
              </Link>{" "}
              sets it against cmux diff and hunk, and{" "}
              <Link
                className="text-link transition-colors hover:text-link/90"
                href="/review-ai-generated-code"
              >
                how to review code an AI agent wrote
              </Link>{" "}
              covers the rest of the field.
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
              Every row read from its source on {CHECKED}.
            </p>
            {/* The byline sits with the facts, not in the hero. A named author
                and a last-updated stamp under an h1 reads as a blog post, and
                it was one more line between the promise and the command. Here
                it does the job it is for: saying who stands behind the numbers
                directly above it. */}
            <AuthorByline updated={updatedAt} />
            {/* The same action as the hero and the install section, placed
                where the reader has just been handed the reasons to trust it.
                Between the hero and the foot of the page there were six
                sections and roughly fifteen phone screens with nothing to act
                on. */}
            <div className="mt-10 flex justify-center">
              <code className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-foreground text-sm">
                <span>npx diffhub@latest cmux</span>
                <CopyButton content="npx diffhub@latest cmux" />
              </code>
            </div>
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
            {/* The heading matches every other h2 on the page. It used to be
                text-4xl/5xl, the same size as the h1, which made the foot of the
                page shout louder than the top of it.

                The command repeats on purpose: a reader who scrolled the whole
                page should not have to scroll back. Everything around it that
                merely restated the hero is gone, including a second copy of the
                "no cmux" line and the licence. What is left is the two things
                this section adds, the docs and the source. */}
            <motion.div {...blurUp} className="text-center">
              <h2
                key="heading"
                className="mx-auto max-w-[40ch] text-balance text-2xl font-medium tracking-tight"
              >
                How do you install DiffHub?
              </h2>
              <div key="install" className="mt-8 flex justify-center">
                <code className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-2 font-mono text-foreground text-sm">
                  <span>npx diffhub@latest cmux</span>
                  <CopyButton content="npx diffhub@latest cmux" />
                </code>
              </div>
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
              <p key="guide" className="mx-auto mt-8 max-w-[60ch] text-muted-foreground text-sm">
                Or read{" "}
                <a
                  className="text-link transition-colors hover:text-link/90"
                  href={siteConfig.links.github}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  the source
                </a>
                ,{" "}
                <Link
                  className="text-link transition-colors hover:text-link/90"
                  href="/cmux-git-diff"
                >
                  how to view a git diff in cmux
                </Link>
                , or{" "}
                <Link
                  className="text-link transition-colors hover:text-link/90"
                  href="/review-ai-generated-code"
                >
                  how to review code an AI agent wrote
                </Link>
                .
              </p>
            </motion.div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
