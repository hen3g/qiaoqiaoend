import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { mapUser, type SessionUser } from "@/lib/auth";
import type { ClientAppId } from "@/lib/client-app";
import { DEFAULT_CLIENT_APP, isClientAppId } from "@/lib/client-app";
import { requireAdmin } from "@/lib/dev-admin";
import { query } from "@/lib/db";
import { ensureNotificationStatsTables } from "@/lib/notification-stats";
import { setUserIsPromoter } from "@/lib/promoter";
import {
  ensureShareCustomCoursesColumn,
  ensureUserAppColumns,
  ensureUserDiamondsColumn,
  ensureUserPromoterColumns,
} from "@/lib/user-schema";

export const dynamic = "force-dynamic";

export type ClientUsage = "none" | "client" | "web" | "both";

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  vip_expires_at: Date | string | null;
  diamonds: number;
  share_custom_courses?: number | boolean | null;
  is_promoter?: number | boolean | null;
  promoter_id?: number | null;
  register_app_id?: string | null;
  last_app_id?: string | null;
  created_at: Date | string | null;
  token_version: number;
  unlocked_difficulty: number | null;
  has_client: number | boolean;
  has_web: number | boolean;
  last_notification_at: Date | string | null;
  notification_hit_count: number | null;
};

export type AdminUserDto = SessionUser & {
  tokenVersion: number;
  /** 用户当前解锁星级（1–5），无进度记录时默认为 1 */
  unlockedDifficulty: number;
  /** 是否曾以登录态从客户端请求过通知接口 */
  hasClient: boolean;
  /** 是否曾以登录态从在线版请求过通知接口 */
  hasWeb: boolean;
  /** 客户端使用情况：未检测到 / 仅客户端 / 仅在线版 / 都使用了 */
  clientUsage: ClientUsage;
  lastNotificationAt: string | null;
  notificationHitCount: number;
  registerAppId: ClientAppId;
  lastAppId: ClientAppId | null;
};

const patchSchema = z.object({
  userId: z.coerce.number().int().positive(),
  isPromoter: z.boolean(),
});

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "NOT_FOUND") return jsonError("不可用", 404);
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

function formatDate(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }
  return String(value).slice(0, 10);
}

function toClientUsage(hasClient: boolean, hasWeb: boolean): ClientUsage {
  if (hasClient && hasWeb) return "both";
  if (hasClient) return "client";
  if (hasWeb) return "web";
  return "none";
}

async function listUsers(): Promise<AdminUserDto[]> {
  await ensureNotificationStatsTables();
  await ensureUserDiamondsColumn();
  await ensureShareCustomCoursesColumn();
  await ensureUserPromoterColumns();
  await ensureUserAppColumns();
  const rows = await query<UserRow[]>(
    `SELECT u.id, u.username, u.nickname, u.vip_expires_at, u.diamonds,
            u.share_custom_courses, u.is_promoter, u.promoter_id,
            u.register_app_id, u.last_app_id,
            u.created_at, u.token_version,
            sp.unlocked_difficulty,
            COALESCE(n.has_client, 0) AS has_client,
            COALESCE(n.has_web, 0) AS has_web,
            n.last_notification_at,
            COALESCE(n.notification_hit_count, 0) AS notification_hit_count
     FROM users u
     LEFT JOIN user_skill_progress sp ON sp.user_id = u.id
     LEFT JOIN (
       SELECT user_id,
              MAX(CASE WHEN source = 'client' THEN 1 ELSE 0 END) AS has_client,
              MAX(CASE WHEN source = 'web' THEN 1 ELSE 0 END) AS has_web,
              MAX(stat_date) AS last_notification_at,
              SUM(hit_count) AS notification_hit_count
       FROM notification_api_daily_users
       GROUP BY user_id
     ) n ON n.user_id = u.id
     ORDER BY u.id ASC`,
  );
  return rows.map((row) => {
    const hasClient = Boolean(row.has_client);
    const hasWeb = Boolean(row.has_web);
    const unlockedDifficulty = Math.min(
      5,
      Math.max(1, Number(row.unlocked_difficulty) || 1),
    );
    return {
      ...mapUser(row),
      tokenVersion: row.token_version ?? 0,
      unlockedDifficulty,
      hasClient,
      hasWeb,
      clientUsage: toClientUsage(hasClient, hasWeb),
      lastNotificationAt: formatDate(row.last_notification_at),
      notificationHitCount: Number(row.notification_hit_count) || 0,
      registerAppId: isClientAppId(row.register_app_id)
        ? row.register_app_id
        : DEFAULT_CLIENT_APP,
      lastAppId: isClientAppId(row.last_app_id) ? row.last_app_id : null,
    };
  });
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await listUsers();
    return jsonOk({ users, total: users.length });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    await setUserIsPromoter(body.userId, body.isPromoter);
    return jsonOk({
      message: body.isPromoter ? "已设为推广者" : "已取消推广者",
      userId: body.userId,
      isPromoter: body.isPromoter,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("更新失败", 500);
  }
}
