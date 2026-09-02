import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { resolveVisitUserId } from "@/lib/device-visits";
import {
  parseNotificationClientSource,
  recordNotificationApiHit,
  resolveStatsUserId,
} from "@/lib/notification-stats";
import {
  getLatestNotifications,
  listHamsterNotifications,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** 公开接口：敲敲英语仍返回各类型最新一条；仓鼠单词会附带该用户的个人消息。
 *  query `source=web` 表示在线版；缺省或其它值按客户端计。 */
export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const source = parseNotificationClientSource(url.searchParams.get("source"));
    const userId = await resolveStatsUserId(req);
    // 统计失败不影响通知返回
    void recordNotificationApiHit(userId, source).catch((err) => {
      console.error("notification api stats:", err);
    });

    const appId = clientAppFromRequest(req);
    const notifications =
      appId === "hamster"
        ? await listHamsterNotifications(await resolveVisitUserId(req))
        : await getLatestNotifications(appId);
    return withAuthCors(jsonOk({ notifications }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500));
  }
}
