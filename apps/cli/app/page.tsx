import { DiffApp } from "@/components/DiffApp";
import { getConfiguredRepoPath } from "@/lib/repo-path";

export default function Home() {
  const repoPath = getConfiguredRepoPath();
  // Always start expanded on launch; the in-session toggle still works.
  const defaultSidebarOpen = true;
  const watchMode =
    process.env.DIFFHUB_CMUX === "1" && process.env.DIFFHUB_EXTERNAL_WATCHER !== "1"
      ? "poll"
      : "stream";

  return (
    <DiffApp repoPath={repoPath} defaultSidebarOpen={defaultSidebarOpen} watchMode={watchMode} />
  );
}
