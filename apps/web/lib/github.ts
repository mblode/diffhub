// Server-side helpers for the live PR demo. The browser never talks to GitHub
// directly (the site CSP only allows same-origin connect-src); these run on the
// server and rely on Next's data cache (revalidate) to stay under GitHub's
// unauthenticated rate limit.

const GITHUB_API = "https://api.github.com";
const OWNER_REPO_PATTERN = /^[A-Za-z0-9._-]+$/;

// Cache each PR response for an hour. A burst of distinct PRs can still exhaust
// the ~60 req/hr/IP unauthenticated limit; that surfaces as a 429 to the client.
const REVALIDATE_SECONDS = 3600;

export interface RepoParams {
  owner: string;
  repo: string;
  number: string;
}

export interface PrMeta {
  title: string;
  number: number;
  state: "open" | "closed";
  merged: boolean;
  htmlUrl: string;
  authorLogin: string | null;
  authorUrl: string | null;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface GithubError {
  status: number;
  message: string;
}

/** Validate untrusted route params before they reach a GitHub URL. */
export const parseRepoParams = (params: {
  owner: string;
  repo: string;
  number: string;
}): RepoParams | null => {
  const { owner, repo, number } = params;
  if (!OWNER_REPO_PATTERN.test(owner) || !OWNER_REPO_PATTERN.test(repo)) {
    return null;
  }
  if (!/^\d+$/.test(number) || number.length > 12) {
    return null;
  }
  return { number, owner, repo };
};

const baseHeaders = {
  "User-Agent": "diffhub-live-demo",
};

const messageForStatus = (status: number, fallback: string): string => {
  if (status === 404) {
    return "Pull request not found.";
  }
  if (status === 403 || status === 429) {
    return "GitHub rate limit reached. Try again in a little while.";
  }
  if (status === 406 || status === 422) {
    return "This diff is too large for GitHub to generate.";
  }
  return fallback;
};

/** Fetch the PR metadata used for the header. Returns a GithubError on failure. */
export const fetchPrMeta = async ({
  owner,
  repo,
  number,
}: RepoParams): Promise<PrMeta | GithubError> => {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
    headers: { ...baseHeaders, Accept: "application/vnd.github+json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return {
      message: messageForStatus(response.status, "Failed to load this pull request."),
      status: response.status,
    };
  }

  const data = (await response.json()) as {
    title: string;
    number: number;
    state: "open" | "closed";
    merged: boolean;
    html_url: string;
    user: { login: string; html_url: string } | null;
    base: { ref: string };
    head: { ref: string };
    additions: number;
    deletions: number;
    changed_files: number;
  };

  return {
    additions: data.additions,
    authorLogin: data.user?.login ?? null,
    authorUrl: data.user?.html_url ?? null,
    baseRef: data.base.ref,
    changedFiles: data.changed_files,
    deletions: data.deletions,
    headRef: data.head.ref,
    htmlUrl: data.html_url,
    merged: data.merged,
    number: data.number,
    state: data.state,
    title: data.title,
  };
};

export const isGithubError = (value: PrMeta | GithubError): value is GithubError =>
  "status" in value && typeof (value as GithubError).status === "number";

/** Fetch the raw unified diff for a PR (text/plain). */
export const fetchPrDiff = async ({
  owner,
  repo,
  number,
}: RepoParams): Promise<{ ok: true; diff: string } | { ok: false; error: GithubError }> => {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
    headers: { ...baseHeaders, Accept: "application/vnd.github.diff" },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return {
      error: {
        message: messageForStatus(response.status, "Failed to load this diff."),
        status: response.status,
      },
      ok: false,
    };
  }

  return { diff: await response.text(), ok: true };
};

export const githubPrUrl = ({ owner, repo, number }: RepoParams): string =>
  `https://github.com/${owner}/${repo}/pull/${number}`;
