import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** HTML / RSC must not sit in nginx for a year; hashed /_next/static stays immutable. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return response;
  }

  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
