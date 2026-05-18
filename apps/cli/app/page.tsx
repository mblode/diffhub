import { cookies } from "next/headers";
import { DiffApp } from "@/components/DiffApp";
import { getConfiguredRepoPath } from "@/lib/repo-path";

export default async function Home() {
  const repoPath = getConfiguredRepoPath();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const watchMode =
    process.env.DIFFHUB_CMUX === "1" && process.env.DIFFHUB_EXTERNAL_WATCHER !== "1"
      ? "poll"
      : "stream";

  return (
    <DiffApp repoPath={repoPath} defaultSidebarOpen={defaultSidebarOpen} watchMode={watchMode} />
  );
}
