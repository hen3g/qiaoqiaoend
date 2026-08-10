import { jsonOk } from "@/lib/api";
import {
  bumpUserTokenVersion,
  clearSessionCookie,
  getSessionTokenFromRequest,
  readSessionUserId,
} from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  const token = await getSessionTokenFromRequest(req);
  if (token) {
    const userId = await readSessionUserId(token);
    if (userId) {
      await bumpUserTokenVersion(userId);
    }
  }
  await clearSessionCookie();
  return withAuthCors(jsonOk({ message: "已退出登录" }));
}
