import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  const title = `${owner}/${repo} #${number} · DiffHub`;
  return {
    description: `Browse the diff for ${owner}/${repo} pull request #${number} in DiffHub's live PR viewer: explore changed files side by side or inline, with syntax highlighting and line notes.`,
    robots: { follow: true, index: false },
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
    <PrDiffViewer
      baseRef={hasMeta ? meta.baseRef : "base"}
      headRef={hasMeta ? meta.headRef : `pull/${number}`}
      number={number}
      owner={owner}
      prUrl={githubPrUrl(repoParams)}
      repo={repo}
    />
  );
}
