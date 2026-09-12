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
import { parseAppUiLocale } from "@/lib/user-schema";

export const dynamic = "force-dynamic";

/** Optional client hint when users.locale is not yet synced. */
function localeHintFromRequest(req: Request): ReturnType<typeof parseAppUiLocale> {
  return (
    parseAppUiLocale(req.headers.get("x-app-locale")) ??
    parseAppUiLocale(req.headers.get("accept-language"))
  );
}

/** 敲敲英语：公开，各类型最新一条广播（不含指定用户消息）。
 *  仓鼠单词 inbox：必须登录；未登录 401，不返回广播或个人消息。
 *  query `source=web` 表示在线版；缺省或其它值按客户端计。
 *  仓鼠按用户 locale（或 x-app-locale）返回对应语言文案，并过滤受众语言。 */
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
    const visitUserId = await resolveVisitUserId(req);
    const localeHint = localeHintFromRequest(req);
    if (appId === "hamster") {
      if (visitUserId == null) {
        return withAuthCors(jsonError("请先登录", 401));
      }
      const notifications = await listHamsterNotifications(
        visitUserId,
        localeHint,
      );
      return withAuthCors(jsonOk({ notifications }));
    }
    const notifications = await getLatestNotifications(appId, null);
    return withAuthCors(jsonOk({ notifications }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500));
  }
}
