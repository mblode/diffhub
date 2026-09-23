import type { NextRequest } from "next/server";

import { proxyDocsRequest } from "@/lib/docs-proxy";

// Always dynamic: it proxies every request upstream. This was
// `dynamic = "force-dynamic"`; under Cache Components route handlers are
// dynamic by default and reading `request` keeps it out of any prerender.

interface DocsRouteContext {
  params: Promise<{ slug?: string[] }>;
}

const getSlug = async (params: DocsRouteContext["params"]) => {
  const { slug } = await params;
  return slug ?? [];
};

export const GET = async (request: NextRequest, { params }: DocsRouteContext) =>
  await proxyDocsRequest(request, await getSlug(params));

export const HEAD = async (request: NextRequest, { params }: DocsRouteContext) =>
  await proxyDocsRequest(request, await getSlug(params));
