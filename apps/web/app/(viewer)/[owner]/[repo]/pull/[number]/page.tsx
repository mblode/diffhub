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
