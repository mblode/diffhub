import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { fetchPrMeta, githubPrUrl, isGithubError, parseRepoParams } from "@/lib/github";
import { PrDiffViewer } from "./PrDiffViewer";

interface PageParams {
  owner: string;
  repo: string;
  number: string;
}

/**
 * Allowed to block, outside the instant-navigation link graph. The header reads
 * `params` and GitHub per URL before anything renders, and the viewer is a
 * client app that loads the diff after mount, so there is no meaningful shell
 * to show first.
 *
 * Under Cache Components this route still streams an (empty) PPR shell, so the
 * `notFound()` calls below can only render a soft 404 (status 200, `noindex`).
 * `proxy.ts` catches malformed URLs and missing PRs first to send a real 404;
 * these calls remain as the fallback when that check lets a request through.
 */
export const instant = false;

export const generateMetadata = async ({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> => {
  const { owner, repo, number } = await params;
  const url = `${siteConfig.url}/${owner}/${repo}/pull/${number}`;
  const title = `${owner}/${repo} #${number}`;
  const description = `Browse the diff for ${owner}/${repo} pull request #${number} in DiffHub's live PR viewer: explore changed files side by side or inline, with syntax highlighting and line notes.`;
  return {
    // Self-canonical. Inheriting the root layout's canonical made every demo
    // URL a noindexed page that also claimed to be the landing page: an
    // exclusion signal and a consolidation signal on one URL, pointing
    // opposite ways. `openGraph` is restated for the same reason (its `url`
    // was the landing page's), and declaring it replaces the layout's block,
    // so the card image and siteName come with it.
    alternates: { canonical: url },
    description,
    openGraph: {
      description,
      images: [{ alt: title, height: 630, url: "/opengraph-image", width: 1200 }],
      siteName: "Matthew Blode",
      title: `${title} | ${siteConfig.name}`,
      type: "website",
      url,
    },
    robots: { follow: true, index: false },
    // Bare: the root layout's `title.template` appends " | DiffHub". Spelling
    // the product out here too would render it twice.
    title,
  };
};

export default async function PullRequestPage({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<React.JSX.Element> {
  const raw = await params;
  const repoParams = parseRepoParams(raw);
  if (repoParams === null) {
    notFound();
  }

  const meta = await fetchPrMeta(repoParams);
  if (isGithubError(meta) && meta.status === 404) {
    notFound();
  }

  const { owner, repo, number } = repoParams;
  const hasMeta = !isGithubError(meta);

  return (
    <>
      {/* The viewer chrome is full-bleed and has no room for a visible title, so
          the document heading is exposed to assistive tech only. */}
      <h1 className="sr-only">
        {hasMeta ? `${meta.title} · ${owner}/${repo} #${number}` : `${owner}/${repo} #${number}`}
      </h1>
      <PrDiffViewer
        baseRef={hasMeta ? meta.baseRef : "base"}
        headRef={hasMeta ? meta.headRef : `pull/${number}`}
        number={number}
        owner={owner}
        prUrl={githubPrUrl(repoParams)}
        repo={repo}
      />
    </>
  );
}
