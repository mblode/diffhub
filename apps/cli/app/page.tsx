import { DiffApp } from "@/components/DiffApp";
import { getConfiguredRepoPath } from "@/lib/repo-path";

export default function Home() {
  const repoPath = getConfiguredRepoPath();
  return <DiffApp repoPath={repoPath} />;
}
