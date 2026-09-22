import { ArrowRightIcon } from "blode-icons-react";
import Image from "next/image";
import Link from "next/link";

import { CtaClose } from "@/components/marketing/cta-close";
import { FeatureRows } from "@/components/marketing/feature-rows";
import { HomeFaq, HomeInstallCommand } from "@/components/marketing/home-islands";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { ProofStats } from "@/components/marketing/proof-stats";
import { Reveal } from "@/components/marketing/reveal";
import { ReviewDemo } from "@/components/marketing/review-demo";
import { WorkingTreeDemo } from "@/components/marketing/working-tree-demo";
import { DemoLauncher } from "@/components/shared/demo-launcher";
import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { TrackedCta } from "@/components/tracked-cta";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { asset, siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { fetchGithubStars, fetchNpmWeeklyDownloads } from "@/lib/live-stats";
import { zoneGraph } from "@/lib/schema";

/**
 * A Server Component. The hero, feature rows, facts and FAQ answers are in the
 * initial HTML; the review demo, install tabs, FAQ toggles and PR launcher are
 * the only client islands. Nothing above the fold animates on mount.
 */

/** The date the facts table was last read from its sources. */
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

/**
 * Rendered by `<HomeFaq>` and passed to `zoneGraph`, so the FAQPage answers
 * and the visible answers are the same strings.
 */
const faqs: Faq[] = [
  {
    answer:
      "No. `npx diffhub@latest` opens DiffHub in a normal browser tab. Add `cmux` to open it in cmux on macOS. That option needs cmux.app in /Applications.",
    question: "Do you need cmux to use DiffHub?",
  },
  {
    answer:
      "Comment on any line and give it a label: must-fix, suggestion, nit or question. When you’re done, copy every comment as one Markdown prompt and paste it into your agent. Each line names the file, the line number and the side of the diff. Copying clears the list for the next pass.",
    question: "How do review comments get to the agent?",
  },
  {
    answer:
      "No. DiffHub runs on localhost:2047 and stores comments in `.git/diffhub-comments.json`. It does not make network requests.",
    question: "Does DiffHub send your code anywhere?",
  },
  {
    answer:
      "DiffHub diffs your branch from its merge base with main, master, develop or dev, whichever exists locally. Pass `--base <branch>` to pick another. You can also narrow the view to committed, staged or unstaged changes.",
    question: "Which branch does DiffHub compare against?",
  },
  {
    answer:
      "Yes. The live demo opens any public GitHub pull request in the DiffHub viewer, with no account or install. Comments need the local CLI, because they are saved inside your repository.",
    question: "Can you try DiffHub without installing it?",
  },
  {
    answer:
      "Use `git diff` for quick checks and scripts. Use DiffHub when you need to review several files or leave comments for the next agent pass.",
    question: "When is git diff enough?",
  },
];

const features = [
  {
    description: "Compare the branch with its base and jump between changed files from the tree.",
    media: (
      <TrackedCta
        aria-label="Open the live DiffHub demo for oven-sh/bun #16000"
        className="block overflow-hidden rounded-[min(1.4vw,var(--radius-2xl))] bg-[#eceae5] shadow-soft outline-1 -outline-offset-1 outline-foreground/10 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-4"
        href={siteConfig.links.demo}
        label="Live demo screenshot"
        opensDemo
      >
        <Image
          alt="DiffHub reviewing a branch with a file tree on the left and added and removed code on the right"
          className="w-full"
          height={1411}
          sizes="(max-width: 1024px) 100vw, 55vw"
          src={asset("/screenshot.png")}
          width={2111}
        />
      </TrackedCta>
    ),
    title: "See every changed file",
  },
  {
    description:
      "DiffHub watches the repository and tells you when the agent changes a file. You refresh when you’re ready, so the code never moves mid-review.",
    media: (
      <div className="[&>div]:mt-0">
        <WorkingTreeDemo />
      </div>
    ),
    title: "Keep the diff open while the agent works",
  },
  {
    description: "Move between files, switch views, filter and refresh without the mouse.",
    media: (
      <ul className="divide-y divide-foreground/10 border-foreground/10 border-y">
        {shortcuts.map((shortcut) => (
          <li className="flex items-center justify-between gap-4 py-4" key={shortcut.label}>
            <span>{shortcut.label}</span>
            <KbdGroup>
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </li>
        ))}
      </ul>
    ),
    title: "Review from the keyboard",
  },
  {
    description:
      "Paste a GitHub pull request URL and read it in the DiffHub viewer. No account or install.",
    media: <DemoLauncher />,
    title: "Try it on a public pull request",
  },
];

export default async function HomePage(): Promise<React.JSX.Element> {
  const [stars, downloads] = await Promise.all([
    fetchGithubStars("mblode/diffhub"),
    fetchNpmWeeklyDownloads("diffhub"),
  ]);

  return (
    <div className="isolate overflow-clip">
      <JsonLd data={zoneGraph({ faqs, updatedAt })} />

      <section className="bg-[#111111] text-[#f7f7f4]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="pt-6 [&_[data-slot=breadcrumb-list]]:text-white/45 [&_[data-slot=breadcrumb-page]]:text-white [&_a:hover]:text-white">
            <ZoneBreadcrumb product="DiffHub" />
          </div>

          <MarketingHero
            action={
              <TrackedCta
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f54e00] py-3 pr-5 pl-6 font-medium text-[#151611] transition-[background-color,transform] hover:bg-[#ff6a1f] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
                href={siteConfig.links.demo}
                label="Try a live review"
                opensDemo
              >
                Open the live demo
                <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
              </TrackedCta>
            }
            description="For people running coding agents in cmux: review the whole branch, comment on any line, then copy every note into the agent’s next prompt."
            eyebrow="DiffHub, a git diff viewer for cmux"
            secondary={<HomeInstallCommand />}
            title="Review agent code in cmux"
          >
            <ReviewDemo />
          </MarketingHero>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 pb-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
            <h2 className="max-w-[18ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
              Stop scrolling through diffs.
            </h2>
            <p className="max-w-[48ch] text-pretty text-muted-foreground">
              Terminal output disappears as soon as it scrolls past. DiffHub keeps the whole branch
              open beside your agent.
            </p>
          </div>
          <FeatureRows items={features} />
        </div>
      </section>

      <section className="border-foreground/10 border-t bg-secondary py-20 sm:py-28">
        <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:gap-16">
            <div>
              <h2 className="max-w-[16ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
                Not a review bot.
              </h2>
              <p className="mt-5 max-w-[48ch] text-pretty text-muted-foreground">
                DiffHub doesn’t review code for you. You read the diff, it keeps your notes and
                hands them to the agent. No account, and your code stays on your machine.
              </p>
            </div>
            <ProofStats
              className="lg:self-end"
              stats={[
                { href: siteConfig.links.github, label: "GitHub stars", value: stars },
                {
                  href: siteConfig.links.npm,
                  label: "npm downloads last week",
                  value: downloads,
                },
              ]}
            />
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-6 border-foreground/10 border-t sm:grid-cols-4 sm:gap-x-8">
            {facts.map((fact) => (
              <div className="flex flex-col-reverse pt-6" key={fact.label}>
                <dt className="mt-2 font-medium">
                  {fact.label}
                  <span className="mt-0.5 block font-mono font-normal text-muted-foreground text-xs">
                    {fact.source}
                  </span>
                </dt>
                <dd className="text-2xl tracking-tight sm:text-3xl">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-muted-foreground text-sm">Facts checked {CHECKED}.</p>
        </Reveal>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
            <h2 className="max-w-[16ch] text-balance text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]">
              A few things to know.
            </h2>
            <div>
              <HomeFaq items={faqs} />
              <p className="mt-10 max-w-[65ch] text-muted-foreground">
                Compare{" "}
                <Link
                  className="text-link underline-offset-4 hover:underline"
                  href="/cmux-git-diff"
                >
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
          </div>
        </div>
      </section>

      <section className="bg-[#151611] py-20 text-[#f7f7f4] sm:py-28" id="install">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <CtaClose
            action={
              <TrackedCta
                className="inline-flex items-center gap-1.5 py-2 text-white/60 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                href={siteConfig.links.docs}
                label="Read the install guide"
              >
                Read the install guide
                <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
              </TrackedCta>
            }
            command={<HomeInstallCommand />}
            description="Run DiffHub in any git repository. It finds the base branch and opens the diff on localhost."
            title="Review before you push."
          />
        </div>
      </section>
    </div>
  );
}
