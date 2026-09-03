import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { listUserVipRecords } from "@/lib/vip-history";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

/** Current user's VIP time grants. No amounts. */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const records = await listUserVipRecords(
      user.id,
      clientAppFromRequest(req),
    );
    return withAuthCors(
      jsonOk({
        records,
        total: records.length,
      }),
    );
  } catch (err) {
    console.error("[vip/history]", err);
    return withAuthCors(jsonError("加载失败", 500));
  }
}
