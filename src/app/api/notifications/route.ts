import { jsonError, jsonOk } from "@/lib/api";
import { getLatestNotifications } from "@/lib/notifications";

/** 公开接口：返回各类型最新通知，最多 2 条（更新 + 消息）。 */
export async function GET() {
  try {
    const notifications = await getLatestNotifications();
    return jsonOk({ notifications });
  } catch (err) {
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
