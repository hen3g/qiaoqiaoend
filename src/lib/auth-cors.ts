import { NextResponse } from "next/server";

/** CORS for mobile / Expo clients calling /api/* with Bearer tokens. */
export function authCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function authPreflight() {
  return new NextResponse(null, { status: 204, headers: authCorsHeaders() });
}

export function withAuthCors(res: NextResponse) {
  const headers = authCorsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}
