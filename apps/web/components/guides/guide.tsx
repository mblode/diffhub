import Link from "next/link";
import type { ReactNode } from "react";

import { AuthorByline } from "@/components/shared/author-byline";
import { FaqSection } from "@/components/shared/faq-section";
import { ZoneBreadcrumb } from "@/components/shared/zone-breadcrumb";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { Faq } from "@/lib/faq";
import { GUIDES } from "@/lib/guides";
import type { GuidePath } from "@/lib/guides";
import { formatReviewPrompt } from "@/lib/review-prompt";
import type { ReviewComment } from "@/lib/review-prompt";
import type { Shortcut } from "@/lib/shortcuts";

/**
 * The pieces every guide page shares. The guides are prose whose whole job is
 * to be read, so all of this is server-rendered: no `"use client"`, no motion
 * helpers. The only client island a guide needs is `GuideCommand`, for the
 * copy event.
 *
 * Each piece is here because two or more guides render it identically. Page
 * copy stays in the page file.
 */

export const guideClass = {
  // 65ch: the max-w-3xl column ran body text to 75–84 characters a line at
  // desktop. Tables, commands and demos stay the full column width.
  body: "mt-4 max-w-[65ch] text-pretty text-muted-foreground",
  // pr-2 below sm: at 390px the multi-column tables overflowed their container
  // by ~40px and scrolled with no affordance, which hid the last column.
  cell: "border-border/60 border-b py-3 pr-2 align-top sm:pr-6",
  // Relative to the paragraph, so code keeps its size against the 18px lead
  // as well as 16px body. The tint marks commands apart from prose.
  code: "rounded bg-secondary/70 px-1 py-0.5 font-mono text-[0.875em] text-foreground/80 whitespace-nowrap",
  heading: "mt-16 text-balance text-2xl font-medium tracking-tight",
  lead: "mt-6 max-w-[65ch] text-pretty text-lg text-muted-foreground",
  // Underlined at rest: the link colour alone is ~1.2:1 against the grey body
  // text, under the 3:1 WCAG 1.4.1 needs. The focus ring replaces the global
  // `outline-ring/50`, which is barely visible on these links.
  link: "rounded-sm text-link underline decoration-link/40 underline-offset-4 transition-colors hover:decoration-link focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2",
  primaryCta:
    "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2",
} as const;

/** The article wrapper, the zone trail, the one H1 and the byline. */
export const GuideArticle = ({
  children,
  crumb,
  heading,
  updatedAt,
}: {
  children: ReactNode;
  /** Must be the same string the page passes to `zoneGraph`'s `trail`. */
  crumb: string;
  heading: string;
  updatedAt: string;
}): React.JSX.Element => (
  <article className="@container py-16 sm:py-24">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <ZoneBreadcrumb page={crumb} product="DiffHub" />
      <h1 className="mt-6 text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl sm:tracking-[-0.03em]">
        {heading}
      </h1>
      <AuthorByline credential updated={updatedAt} />
      {children}
    </div>
  </article>
);

/**
 * Wraps a table that can overflow on a phone. Focusable so it can be scrolled
 * sideways from the keyboard (axe `scrollable-region-focusable`), and named so
 * a screen reader announces what the focus landed on. `scroll-fade-x` marks
 * the cut-off edge; the ring is inset because the mask clips anything outside.
 */
export const TableScroll = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}): React.JSX.Element => (
  <section
    aria-label={label}
    className="scroll-fade-x mt-6 overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-link focus-visible:-outline-offset-2"
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    tabIndex={0}
  >
    {children}
  </section>
);

/** A table of facts, each with the file or page it was read from. */
export const FactTable = ({
  caption,
  facts,
}: {
  caption: string;
  facts: readonly { label: string; source: string; value: string }[];
}): React.JSX.Element => (
  <TableScroll label={caption}>
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-muted-foreground">
          <th className={`${guideClass.cell} font-medium`} scope="col">
            Fact
          </th>
          <th className={`${guideClass.cell} font-medium`} scope="col">
            Value
          </th>
          <th className={`${guideClass.cell} font-medium`} scope="col">
            Source
          </th>
        </tr>
      </thead>
      <tbody>
        {facts.map((fact) => (
          <tr key={fact.label}>
            <th className={`${guideClass.cell} font-normal`} scope="row">
              {fact.label}
            </th>
            <td className={guideClass.cell}>{fact.value}</td>
            <td className={`${guideClass.cell} break-words text-muted-foreground`}>
              {fact.source}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </TableScroll>
);

/**
 * The prompt "Copy & clear" produces, built by the same `formatReviewPrompt`
 * the landing demo uses. `review-prompt.test.ts` holds that function to the
 * CLI's `exportCommentsAsPrompt`, so an example here cannot show a format the
 * product no longer writes.
 */
export const PromptExample = ({
  comments,
}: {
  comments: readonly ReviewComment[];
}): React.JSX.Element => (
  <pre className="mt-6 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-secondary/50 p-4 font-mono text-muted-foreground text-sm">
    <code>{formatReviewPrompt(comments)}</code>
  </pre>
);

export const ShortcutTable = ({
  caption,
  shortcuts,
}: {
  caption: string;
  shortcuts: readonly Shortcut[];
}): React.JSX.Element => (
  <table className="mt-6 w-full text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead>
      <tr className="text-muted-foreground">
        <th className={`${guideClass.cell} font-medium`} scope="col">
          Key
        </th>
        <th className={`${guideClass.cell} font-medium`} scope="col">
          What it does
        </th>
      </tr>
    </thead>
    <tbody>
      {shortcuts.map((shortcut) => (
        <tr key={shortcut.label}>
          <td className={guideClass.cell}>
            <KbdGroup>
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </td>
          <td className={guideClass.cell}>{shortcut.label}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** The FAQ block. `faqs` must be the same array the page hands `zoneGraph`. */
export const GuideFaq = ({
  faqs,
  heading,
}: {
  faqs: readonly Faq[];
  heading: string;
}): React.JSX.Element => (
  <>
    <h2 className={guideClass.heading}>{heading}</h2>
    <FaqSection
      answerClassName={guideClass.body}
      faqs={faqs}
      questionClassName="mt-8 text-balance font-medium text-lg tracking-tight"
    />
  </>
);

/**
 * Every other guide plus the landing page, so no guide is a dead end and each
 * one links to all the others. Driven by `GUIDES`, so a new guide shows up on
 * every existing one without editing them.
 */
export const RelatedGuides = ({ current }: { current: GuidePath }): React.JSX.Element => (
  <nav aria-labelledby="related-guides">
    <h2 className={guideClass.heading} id="related-guides">
      Related guides
    </h2>
    <ul className="mt-4 divide-y divide-border/60 border-border/60 border-y">
      {GUIDES.filter((entry) => entry.path !== current).map((entry) => (
        <li className="py-4" key={entry.path}>
          <Link className={`${guideClass.link} font-medium`} href={entry.path}>
            {entry.label}
          </Link>
          <p className="mt-1 text-muted-foreground text-sm">{entry.pitch}</p>
        </li>
      ))}
      <li className="py-4">
        <Link className={`${guideClass.link} font-medium`} href="/">
          DiffHub
        </Link>
        <p className="mt-1 text-muted-foreground text-sm">
          The tool itself, with a review demo you can comment on.
        </p>
      </li>
    </ul>
  </nav>
);
