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

/** 公开接口：敲敲英语仍返回各类型最新一条；仓鼠单词会附带该用户的个人消息。
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
    const notifications =
      appId === "hamster"
        ? await listHamsterNotifications(visitUserId, localeHint)
        : await getLatestNotifications(appId, null);
    return withAuthCors(jsonOk({ notifications }));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500));
  }
}
