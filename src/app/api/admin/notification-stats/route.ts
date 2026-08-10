import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  listDailyNotificationStats,
  listDailyNotificationUsers,
  todayInShanghai,
} from "@/lib/notification-stats";

export const dynamic = "force-dynamic";

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "NOT_FOUND") return jsonError("不可用", 404);
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      days: url.searchParams.get("days") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });

    const days = await listDailyNotificationStats(parsed.days);
    const detailDate = parsed.date ?? todayInShanghai();
    const users = await listDailyNotificationUsers(detailDate);

    const today = days.find((d) => d.date === todayInShanghai()) ?? {
      date: todayInShanghai(),
      totalHits: 0,
      loggedInHits: 0,
      uniqueUsers: 0,
    };

    return jsonOk({
      today,
      days,
      detailDate,
      users,
      total: days.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
