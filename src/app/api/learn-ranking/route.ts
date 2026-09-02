import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { clientAppFromRequest } from "@/lib/client-app";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import {
  getLearnRankingMe,
  getLearnRankingOverview,
  MAX_TOTAL_CORRECT,
  syncLearnCorrectTotal,
} from "@/lib/learn-ranking-db";

export async function OPTIONS() {
  return authPreflight();
}

/**
 * GET /api/learn-ranking
 *   Public week + month boards (top 100). `me` and `totalCorrect` only
 *   when logged in — total is never shown on the public list.
 *
 * GET /api/learn-ranking?me=1
 *   Logged-in personal totals / ranks only.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const appId = clientAppFromRequest(req);
    const user = await getCurrentUser(req);
    const meOnly = url.searchParams.get("me");

    if (meOnly === "1" || meOnly === "true") {
      if (!user) {
        return withAuthCors(jsonError("请先登录", 401));
      }
      const me = await getLearnRankingMe(user.id, appId);
      return withAuthCors(jsonOk({ me }));
    }

    const data = await getLearnRankingOverview(appId, user?.id ?? null);
    return withAuthCors(jsonOk(data));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读取排行失败", 500),
    );
  }
}

/**
 * POST /api/learn-ranking
 * Body: { totalCorrect: number }
 *
 * Client sends its local cumulative correct-answer count. Server only
 * increases, and attributes the delta to today.
 */
export async function POST(req: Request) {
  try {
    const limited = await ipRateLimited(req, "learn-ranking-sync", {
      max: 40,
    });
    if (limited) return withAuthCors(limited);

    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    let body: { totalCorrect?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    const totalCorrect = Number(body.totalCorrect);
    if (
      !Number.isFinite(totalCorrect) ||
      !Number.isInteger(totalCorrect) ||
      totalCorrect < 0 ||
      totalCorrect > MAX_TOTAL_CORRECT
    ) {
      return withAuthCors(jsonError("答题数量无效"));
    }

    const appId = clientAppFromRequest(req);
    const me = await syncLearnCorrectTotal(user.id, appId, totalCorrect);
    return withAuthCors(jsonOk({ me }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "同步答题数失败", 500),
    );
  }
}
