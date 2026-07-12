import { NextResponse } from "next/server";
import { jsonOk } from "@/lib/api";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/oauth";

export async function POST() {
  await clearSessionCookie();
  return jsonOk({ message: "已退出登录" });
}

/**
 * Browser navigation helper for OAuth "切换账号".
 * Uses a relative Location so nginx/reverse-proxy internal hosts
 * (e.g. localhost:4891) never leak into the redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeNextPath(url.searchParams.get("next")) || "/login";
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: next },
  });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
