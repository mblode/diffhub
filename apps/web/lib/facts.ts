/**
 * Facts about this repository that more than one page states, kept in one
 * place so two pages cannot publish different numbers for the same thing.
 *
 * The star count appears on the landing page's facts table and again in
 * `/cmux-git-diff`'s comparison table, where DiffHub sits alongside four other
 * projects. Both pages invite the reader to check these against GitHub in a
 * click, so two copies drifting apart is a contradiction a reader is being
 * encouraged to find.
 *
 * Strings, not numbers, because every consumer renders them directly and none
 * does arithmetic.
 *
 * No read-date here on purpose: each page already states its own, next to the
 * table making the claim, and those cover more than these two numbers. Re-read
 * these from the repository whenever you move either page's date.
 */
export const REPO = {
  forks: "4",
  stars: "19",
};
