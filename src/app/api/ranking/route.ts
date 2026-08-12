import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  getRankingBoard,
  getRankingSummary,
  type RankingScope,
} from "@/lib/ranking-db";

export async function OPTIONS() {
  return authPreflight();
}

function parseScope(value: string | null): RankingScope | null {
  if (value === "total" || value === "today") return value;
  return null;
}

/**
 * GET /api/ranking?scope=total|today  → top 100 board (+ me if logged in)
 * GET /api/ranking?summary=1          → { total, today } ranks for current user
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const summary = url.searchParams.get("summary");
    const user = await getCurrentUser(req);

    if (summary === "1" || summary === "true") {
      if (!user) {
        return withAuthCors(jsonError("请先登录", 401));
      }
      const data = await getRankingSummary(user.id);
      return withAuthCors(jsonOk(data));
    }

    const scope = parseScope(url.searchParams.get("scope"));
    if (!scope) {
      return withAuthCors(jsonError("请提供 scope=total 或 scope=today"));
    }

    const board = await getRankingBoard(scope, user?.id ?? null, 100);
    return withAuthCors(jsonOk(board));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读取排行失败", 500),
    );
  }
}
