import { getConfiguredRepoPath } from "@/lib/repo-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () =>
  Response.json({
    bootId: process.env.DIFFHUB_SERVER_BOOT_ID ?? null,
    cmux: process.env.DIFFHUB_CMUX === "1",
    ok: true,
    pid: process.pid,
    repoPath: getConfiguredRepoPath(),
  });
