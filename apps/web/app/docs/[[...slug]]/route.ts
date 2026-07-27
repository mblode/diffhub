import type { NextRequest } from "next/server";

import { proxyDocsRequest } from "@/lib/docs-proxy";

export const dynamic = "force-dynamic";

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
