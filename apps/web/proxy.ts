import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { basePath } from "@/lib/config";
import { fetchPrMeta, isGithubError, parseRepoParams } from "@/lib/github";

const DOCS_ORIGIN = "https://diffhub.blode.md";
const CURRENT_DEPLOYMENT_ID = process.env.VERCEL_DEPLOYMENT_ID ?? "";

const PULL_PATH = /^\/([^/]+)\/([^/]+)\/pull\/([^/]+)$/;

// A rewrite to a path no route matches renders the app's 404 page, and the
// status is still unset at this point, so it goes out as a real 404.
const NOT_FOUND_PATH = `${basePath}/_missing-pull-request`;

// Proxy `fetch` bypasses Next's data cache, so without this every PR view
// would spend one of GitHub's ~60 unauthenticated requests per hour. Holds
// only a yes/no per public PR URL, for as long as the page caches its meta.
const EXISTS_TTL_MS = 60 * 60 * 1000;
const EXISTS_MAX_ENTRIES = 500;
const existsCache = new Map<string, { exists: boolean; expires: number }>();

const pullRequestExists = async (params: {
  owner: string;
  repo: string;
  number: string;
}): Promise<boolean> => {
  const key = `${params.owner}/${params.repo}/${params.number}`.toLowerCase();
  const cached = existsCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.exists;
  }

  let exists = true;
  try {
    const meta = await fetchPrMeta(params);
    // Only a definite 404 counts as missing. A rate limit or outage lets the
    // page render and show its own error state, and is not cached.
    if (isGithubError(meta)) {
      if (meta.status !== 404) {
        return true;
      }
      exists = false;
    }
  } catch {
    return true;
  }

  if (existsCache.size >= EXISTS_MAX_ENTRIES) {
    existsCache.delete(existsCache.keys().next().value as string);
  }
  existsCache.set(key, { exists, expires: Date.now() + EXISTS_TTL_MS });
  return exists;
};

/**
 * Under Cache Components the live PR page streams a static shell before its
 * `notFound()` runs, which locks the status at 200. The Next docs' answer is to
 * check the resource here, before the response starts: a malformed URL or a
 * PR GitHub says is missing is rewritten to the 404 page instead.
 */
const guardPullRequest = async (pathname: string, request: NextRequest) => {
  const match = PULL_PATH.exec(pathname);
  if (!match) {
    return NextResponse.next();
  }
  const [, owner = "", repo = "", number = ""] = match;
  const params = parseRepoParams({ number, owner, repo });
  if (params === null || !(await pullRequestExists(params))) {
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
  }
  return NextResponse.next();
};

export const proxy = (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/_next/")) {
    return guardPullRequest(pathname, request);
  }

  if (!CURRENT_DEPLOYMENT_ID) {
    return NextResponse.next();
  }

  const dpl = request.nextUrl.searchParams.get("dpl");
  if (dpl && dpl !== CURRENT_DEPLOYMENT_ID) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, DOCS_ORIGIN));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/_next/static/:path*", "/:owner/:repo/pull/:number"],
};
