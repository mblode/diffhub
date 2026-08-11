/**
 * Per-route changelogs, newest entry first.
 *
 * No imports, deliberately. Three consumers pull this in: two Server Component
 * pages, the `"use client"` landing page, and `app/sitemap.ts`. A leaf module
 * is safe in all four graphs and cannot participate in a cycle. Reaching into
 * `app/(marketing)/page.tsx` for these dates instead would drag griffo, motion
 * and blode-icons-react into a metadata route's server graph, and a non-
 * component export crossing a `"use client"` boundary can fail Turbopack's
 * checks at build rather than at dev.
 *
 * Only dates live here. Page copy stays in the page file; a changelog is
 * metadata about the page, and it has a second reader.
 *
 * Dates are date-only strings on purpose. `new Date("2026-08-10")` parses as
 * UTC midnight; the `"2026-08-10T00:00:00"` form parses as local and drifts.
 */
export interface ChangelogEntry {
  change: string;
  date: string;
}

/**
 * Both ends come off one sorted list, so neither depends on how the entries
 * happen to be ordered in the source. `latestDate` used to sort while
 * `firstDate` read `.at(-1)` and trusted newest-first: appending a new entry to
 * the bottom, which is the natural way to edit a changelog, would then hand
 * `datePublished` the newest date and claim the page was first published on the
 * day it was last edited.
 *
 * An empty changelog yields `""`. Callers that build a `Date` have to treat
 * that as "no date" rather than passing it to `new Date`, which returns an
 * Invalid Date and fails sitemap serialisation.
 */
const dates = (entries: readonly ChangelogEntry[]): string[] =>
  entries.map((entry) => entry.date).toSorted();

/** The oldest entry's date, whatever order the entries are written in. */
export const firstDate = (entries: readonly ChangelogEntry[]): string => dates(entries)[0] ?? "";

/** The newest entry's date, whatever order the entries are written in. */
export const latestDate = (entries: readonly ChangelogEntry[]): string =>
  dates(entries).at(-1) ?? "";

export const CHANGELOGS = {
  "/": [
    {
      change:
        "Cut the page roughly in half: the feature grid, the keyboard shortcuts, the pain list and the tool comparison all restated something already on the page or on one of the two guides. The comparison now lives only on those guides.",
      date: "2026-08-11",
    },
    {
      change:
        "Added a comparison against cmux diff, hunk and revdiff, a table of facts you can check before installing, and an FAQ.",
      date: "2026-08-10",
    },
    { change: "First published.", date: "2026-07-20" },
  ],
  "/cmux-git-diff": [
    {
      change: "Replaced the list of alternatives with a comparison table, and added an FAQ.",
      date: "2026-08-10",
    },
    {
      change:
        "First published. cmux version numbers and the two linked issues checked on this date.",
      date: "2026-08-06",
    },
  ],
  "/review-ai-generated-code": [
    {
      change:
        "First published. Competitor claims quoted from hunk.dev, github.com/umputun/revdiff and the two cmux issues, all checked on this date.",
      date: "2026-08-10",
    },
  ],
} as const satisfies Record<string, readonly ChangelogEntry[]>;
