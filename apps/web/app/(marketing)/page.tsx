import { ArrowRightIcon } from "blode-icons-react";
import Link from "next/link";

import { CtaClose } from "@/components/marketing/cta-close";
import { HomeInstallCommand, SectionViews } from "@/components/marketing/home-islands";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { ReviewDemo } from "@/components/marketing/review-demo";
import { DemoLauncher } from "@/components/shared/demo-launcher";
import { FaqSection } from "@/components/shared/faq-section";
import { JsonLd } from "@/components/shared/json-ld";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { TrackedCta } from "@/components/tracked-cta";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { CHANGELOGS, latestDate } from "@/lib/changelog";
import { siteConfig } from "@/lib/config";
import type { Faq } from "@/lib/faq";
import { GUIDES } from "@/lib/guides";
import { zoneGraph } from "@/lib/schema";

/**
 * A Server Component. The hero, features and FAQ answers are in the
 * initial HTML, and nothing above the fold animates on mount.
 */

const updatedAt = latestDate(CHANGELOGS["/"]);

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
      "No. `npx diffhub@latest` opens DiffHub in a normal browser tab. Add `cmux` to open it in cmux on macOS. That option needs cmux.app in /Applications.",
    question: "Do you need cmux to use DiffHub?",
  },
  {
    answer:
      "Hover a line, click the plus and write the note. When you’re done, Copy & clear turns every comment into one Markdown prompt to paste into your agent. Each line names the file, the line number and the side of the diff. Copying clears the list for the next pass.",
    question: "How do review comments get to the agent?",
  },
  {
    answer:
      "No. DiffHub runs on localhost:2047 and stores comments in `.git/diffhub-comments.json`. It does not make network requests.",
    question: "Does DiffHub send your code anywhere?",
  },
  {
    answer:
      "By default it shows everything you haven’t committed, against HEAD, plus untracked files. Switch the scope to All for the whole branch from its merge base with main, master, develop or dev, whichever it finds first. Pass `--base <branch>` to pick another.",
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

// Dev flags anything that would block navigating here; e2e/instant.spec.ts
// checks it against a production build.
export const instant = true;

export default function HomePage(): React.JSX.Element {
  return (
    <div className="isolate overflow-clip">
      <JsonLd data={zoneGraph({ faqs, updatedAt })} />
      <SectionViews />

      <section>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="pt-6">
            <ZoneBreadcrumb product="DiffHub" />
          </div>

          <MarketingHero
            action={
              <TrackedCta
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-link py-3 pr-5 pl-6 font-medium text-primary-foreground transition-[background-color,transform] hover:bg-link/90 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2 active:translate-y-px"
                href={siteConfig.links.demo}
                label="Try a live review"
                opensDemo
              >
                Open the live demo
                <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
              </TrackedCta>
            }
            description="For people running coding agents in cmux: review the whole branch, comment on any line, then copy every note into the agent’s next prompt."
            secondary={<HomeInstallCommand />}
            title="Review agent code in cmux"
          >
            <ReviewDemo />
          </MarketingHero>
        </div>
      </section>

      <section className="py-16 sm:py-24" data-section="features" id="features">
        <div className="mx-auto grid max-w-6xl gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-balance font-medium text-2xl tracking-tight sm:text-3xl">
              Review from the keyboard
            </h2>
            <p className="mt-3 max-w-[46ch] text-pretty text-muted-foreground">
              Move between files, switch views, filter and refresh without the mouse.
            </p>
            <ul className="mt-8 divide-y divide-foreground/10 border-foreground/10 border-y">
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
          </div>
          <div>
            <h2 className="text-balance font-medium text-2xl tracking-tight sm:text-3xl">
              Try it on a public pull request
            </h2>
            <p className="mt-3 max-w-[46ch] text-pretty text-muted-foreground">
              Paste a GitHub pull request URL and read it in the DiffHub viewer. No account or
              install.
            </p>
            <div className="mt-8">
              <DemoLauncher />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24" data-section="faq" id="faq">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
            <h2 className="max-w-[16ch] text-balance font-medium text-3xl tracking-tight sm:text-4xl">
              A few things to know.
            </h2>
            <div>
              <FaqSection
                answerClassName="mt-3 max-w-[64ch] text-pretty text-muted-foreground"
                className="divide-y divide-foreground/10"
                faqs={faqs}
                itemClassName="py-7 first:pt-0"
                questionClassName="font-medium text-xl tracking-tight"
              />
              <nav aria-labelledby="guides" className="mt-14">
                <h2 className="font-medium text-xl tracking-tight" id="guides">
                  Guides
                </h2>
                <ul className="mt-4 grid gap-x-8 border-foreground/10 border-t sm:grid-cols-2">
                  {GUIDES.map((entry) => (
                    <li className="relative border-foreground/10 border-b py-4" key={entry.path}>
                      {/* The whole row is the hit area: the title alone is 20px tall. */}
                      <Link
                        className="font-medium text-link underline-offset-4 after:absolute after:inset-0 hover:underline"
                        href={entry.path}
                      >
                        {entry.label}
                      </Link>
                      <p className="mt-1 text-muted-foreground text-sm">{entry.pitch}</p>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24" data-section="install" id="install">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <CtaClose
            action={
              <TrackedCta
                className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground underline decoration-foreground/25 underline-offset-4 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
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
