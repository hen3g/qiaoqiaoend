import { jsonError, jsonOk } from "@/lib/api";
import {
  recordNotificationApiHit,
  resolveStatsUserId,
} from "@/lib/notification-stats";
import { getLatestNotifications } from "@/lib/notifications";

/** 公开接口：返回各类型最新通知，最多 2 条（更新 + 消息）。 */
export async function GET(req: Request) {
  try {
    const userId = await resolveStatsUserId(req);
    // 统计失败不影响通知返回
    void recordNotificationApiHit(userId).catch((err) => {
      console.error("notification api stats:", err);
    });

    const notifications = await getLatestNotifications();
    return jsonOk({ notifications });
  } catch (err) {
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
