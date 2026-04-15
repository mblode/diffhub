import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Disable HTTP keep-alive to prevent spawn EBADF errors in standalone mode.
 *
 * There's a bug in Next.js standalone server where reusing HTTP connections
 * corrupts the file descriptor table, causing child process spawning to fail.
 * Forcing `Connection: close` ensures each request uses a fresh connection.
 */
export const proxy = (_request: NextRequest): NextResponse => {
  const response = NextResponse.next();
  response.headers.set("Connection", "close");
  return response;
};

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
