/**
 * Per-route changelogs, newest entry first.
 *
 * No imports, deliberately. The marketing pages, `app/sitemap.ts` and
 * `app/llms.txt/route.ts` pull this in. A leaf module is safe in every graph
 * and cannot participate in a cycle. Reaching into `app/(marketing)/page.tsx`
 * for these dates instead would drag the page's client islands into a metadata
 * route's server graph.
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
        "Made the visible headline the H1 and rendered the page on the server. Added a review demo on a real DiffHub diff that builds the agent prompt as you comment, live GitHub stars and npm downloads, and three more FAQ answers. Folded the keyboard shortcuts into the feature rows. Retitled the page to say what DiffHub is, and corrected two FAQ answers: the default scope is uncommitted work against HEAD, and the viewer has no label picker.",
      date: "2026-09-22",
    },
    {
      change:
        "Aligned the page title, heading and opening answer around its job as a cmux git diff viewer for agent code review.",
      date: "2026-08-30",
    },
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
      change:
        "Added how to install DiffHub for cmux, the full keyboard shortcut list read from the viewer's source, and the agent review loop in a split. Removed the right-click Open in menu, which the CLI no longer has, and corrected the default scope: DiffHub opens on uncommitted changes, with the base-branch comparison one scope away.",
      date: "2026-09-22",
    },
    {
      change:
        "Added an interactive working-tree refresh demonstration and a direct live-review step, and replaced stale popularity metrics with links to each project's primary repository.",
      date: "2026-09-07",
    },
    {
      change:
        "Retitled the guide around cmux diff viewer searches and clarified the three choices in the opening answer.",
      date: "2026-08-30",
    },
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
  "/agent-diff": [
    {
      change:
        "First published. Diff scopes, worktree comment storage, the port range and the prompt format checked against the CLI source on this date.",
      date: "2026-09-22",
    },
  ],
  "/claude-code-review": [
    {
      change:
        "First published. Default scope, untracked files, change detection and the prompt format checked against the CLI source on this date.",
      date: "2026-09-22",
    },
  ],
  "/git-diff-viewer": [
    {
      change:
        "First published. Split view, the five diff scopes, the port, the 127.0.0.1 bind and the inline render limits checked against the CLI source on this date.",
      date: "2026-09-22",
    },
  ],
  "/review-ai-generated-code": [
    {
      change:
        "Rebuilt around what to check in AI-generated code and where an AI code reviewer helps. Retitled, added a checklist and two FAQ answers, re-read the npm figures for diffhub 1.0.0, and corrected the prompt example to the format the CLI writes, which names the diff side. Removed the claim that comments carry a tag you pick: the viewer has no tag picker.",
      date: "2026-09-22",
    },
    {
      change:
        "First published. Competitor claims quoted from hunk.dev, github.com/umputun/revdiff and the two cmux issues, all checked on this date.",
      date: "2026-08-10",
    },
  ],
} as const satisfies Record<string, readonly ChangelogEntry[]>;
