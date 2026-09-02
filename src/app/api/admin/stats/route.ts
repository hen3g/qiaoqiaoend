import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import { parseClientAppFilter } from "@/lib/client-app";
import {
  getVisitStatsForDate,
  listDailyVisitStats,
} from "@/lib/device-visits";
import { todayInShanghai } from "@/lib/notification-stats";

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
  app: z.enum(["all", "qiaoqiao", "hamster"]).optional().default("all"),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      days: url.searchParams.get("days") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
      app: url.searchParams.get("app") ?? undefined,
    });
    const app = parseClientAppFilter(parsed.app);

    const days = await listDailyVisitStats(parsed.days, app);
    const detailDate = parsed.date ?? todayInShanghai();
    const today =
      days.find((d) => d.date === todayInShanghai()) ??
      (await getVisitStatsForDate(todayInShanghai(), app));
    const detail =
      days.find((d) => d.date === detailDate) ??
      (await getVisitStatsForDate(detailDate, app));

    return jsonOk({
      today,
      detail,
      detailDate,
      app,
      days,
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
