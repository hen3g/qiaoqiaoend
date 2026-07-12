import { jsonOk } from "@/lib/api";
import {
  bumpUserTokenVersion,
  clearSessionCookie,
  readSessionUserId,
  SESSION_COOKIE,
} from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const userId = await readSessionUserId(token);
    if (userId) {
      await bumpUserTokenVersion(userId);
    }
  }
  await clearSessionCookie();
  return jsonOk({ message: "已退出登录" });
}
