import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DOCS_ORIGIN = "https://diffhub.blode.md";
const CURRENT_DEPLOYMENT_ID = process.env.VERCEL_DEPLOYMENT_ID ?? "";

export const proxy = (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;

  if (!(pathname.startsWith("/_next/") && CURRENT_DEPLOYMENT_ID)) {
    return NextResponse.next();
  }

  const dpl = request.nextUrl.searchParams.get("dpl");
  if (dpl && dpl !== CURRENT_DEPLOYMENT_ID) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, DOCS_ORIGIN));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/_next/static/:path*"],
};
