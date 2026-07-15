import type { RowDataPacket } from "mysql2";
import { jsonError, jsonOk } from "@/lib/api";
import { mapUser, type SessionUser } from "@/lib/auth";
import { requireDevAdmin } from "@/lib/dev-admin";
import { query } from "@/lib/db";
import { ensureNotificationStatsTables } from "@/lib/notification-stats";

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  vip_expires_at: Date | string | null;
  created_at: Date | string | null;
  token_version: number;
  has_client: number | boolean;
  last_notification_at: Date | string | null;
  notification_hit_count: number | null;
};

export type AdminUserDto = SessionUser & {
  tokenVersion: number;
  /** 是否曾以登录态请求过通知接口（客户端代理指标） */
  hasClient: boolean;
  lastNotificationAt: string | null;
  notificationHitCount: number;
};

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

async function listUsers(): Promise<AdminUserDto[]> {
  await ensureNotificationStatsTables();
  const rows = await query<UserRow[]>(
    `SELECT u.id, u.username, u.nickname, u.vip_expires_at, u.created_at, u.token_version,
            CASE WHEN n.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_client,
            n.last_notification_at,
            COALESCE(n.notification_hit_count, 0) AS notification_hit_count
     FROM users u
     LEFT JOIN (
       SELECT user_id,
              MAX(stat_date) AS last_notification_at,
              SUM(hit_count) AS notification_hit_count
       FROM notification_api_daily_users
       GROUP BY user_id
     ) n ON n.user_id = u.id
     ORDER BY u.id ASC`,
  );
  return rows.map((row) => ({
    ...mapUser(row),
    tokenVersion: row.token_version ?? 0,
    hasClient: Boolean(row.has_client),
    lastNotificationAt: formatDate(row.last_notification_at),
    notificationHitCount: Number(row.notification_hit_count) || 0,
  }));
}

export async function GET() {
  try {
    await requireDevAdmin();
    const users = await listUsers();
    return jsonOk({ users, total: users.length });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
