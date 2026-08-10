import { jsonError, jsonOk } from "@/lib/api";
import {
  parseNotificationClientSource,
  recordNotificationApiHit,
  resolveStatsUserId,
} from "@/lib/notification-stats";
import { getLatestNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** 公开接口：返回各类型最新通知，最多 2 条（更新 + 消息）。
 *  query `source=web` 表示在线版；缺省或其它值按客户端计。 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const source = parseNotificationClientSource(url.searchParams.get("source"));
    const userId = await resolveStatsUserId(req);
    // 统计失败不影响通知返回
    void recordNotificationApiHit(userId, source).catch((err) => {
      console.error("notification api stats:", err);
    });

    const notifications = await getLatestNotifications();
    return jsonOk({ notifications });
  } catch (err) {
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
