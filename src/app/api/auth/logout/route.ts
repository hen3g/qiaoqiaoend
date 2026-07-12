import { jsonOk } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return jsonOk({ message: "已退出登录" });
}
