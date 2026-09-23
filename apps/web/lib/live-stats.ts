/**
 * Live proof numbers for the landing page, fetched on the server.
 *
 * Both fail closed: any network error, non-200, timeout or unexpected shape
 * returns `null`, and `ProofStats` renders nothing for a null. A missing number
 * is honest; a stale or guessed one is not, so there is no fallback value.
 *
 * Cached for a day through Next's data cache. The GitHub call is
 * unauthenticated (60 requests an hour per IP), which a daily revalidate stays
 * well inside.
 *
 * Two layers, on purpose. The fetch `revalidate` is the Data Cache, which
 * persists across deployments and serverless instances, so it is what keeps the
 * GitHub call inside its rate limit. `"use cache"` on top (Cache Components)
 * is what lets the landing page prerender the numbers into its static shell
 * instead of blocking the navigation on two network calls. A null is cached
 * for minutes, not a day, so one failed build or timeout does not hide the
 * block until tomorrow.
 */

import { cacheLife } from "next/cache";

const REVALIDATE_SECONDS = 86_400;
const TIMEOUT_MS = 5000;

const getJson = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "diffhub-web" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

const readCount = (data: unknown, key: string): number | null => {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
};

const cachedCount = async (url: string, key: string): Promise<number | null> => {
  "use cache";
  const value = readCount(await getJson(url), key);
  if (value === null) {
    cacheLife("minutes");
  } else {
    cacheLife("days");
  }
  return value;
};

/** `owner/repo` on GitHub. */
export const fetchGithubStars = async (repo: string): Promise<number | null> =>
  await cachedCount(`https://api.github.com/repos/${repo}`, "stargazers_count");

/** Downloads over the last full week (npm's `last-week` point range). */
export const fetchNpmWeeklyDownloads = async (pkg: string): Promise<number | null> =>
  await cachedCount(
    `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`,
    "downloads",
  );
