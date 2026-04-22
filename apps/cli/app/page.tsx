import { cookies } from "next/headers";
import { DiffApp } from "@/components/DiffApp";
import { getConfiguredRepoPath } from "@/lib/repo-path";

export default async function Home() {
  const repoPath = getConfiguredRepoPath();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  return <DiffApp repoPath={repoPath} defaultSidebarOpen={defaultSidebarOpen} />;
}
