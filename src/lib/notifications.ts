import type { RowDataPacket } from "mysql2";
import type { ClientAppFilter, ClientAppId } from "@/lib/client-app";
import { isClientAppId } from "@/lib/client-app";
import { execute, query } from "@/lib/db";

export type NotificationType = "update" | "message";

export type NotificationAppTarget = ClientAppFilter;

type NotificationRow = RowDataPacket & {
  id: number;
  type: NotificationType;
  app_id: string | null;
  user_id: number | null;
  username: string | null;
  nickname: string | null;
  version: string | null;
  title: string;
  summary: string;
  image_url: string | null;
  link_url: string | null;
  created_at?: Date | string;
};

export type NotificationDto = {
  id: number;
  type: NotificationType;
  appId: NotificationAppTarget;
  userId: number | null;
  username: string | null;
  nickname: string | null;
  version: string | null;
  title: string;
  summary: string;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string | null;
};

export type NotificationTargetUser = {
  id: number;
  username: string;
  nickname: string | null;
};

let schemaEnsured = false;

export async function ensureNotificationsSchema(): Promise<void> {
  if (schemaEnsured) return;
  type ColRow = RowDataPacket & { Field: string };

  const appCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM notifications LIKE 'app_id'`,
  );
  if (appCols.length === 0) {
    await execute(
      `ALTER TABLE notifications
       ADD COLUMN app_id VARCHAR(32) NOT NULL DEFAULT 'all' AFTER type`,
    );
  }

  const userCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM notifications LIKE 'user_id'`,
  );
  if (userCols.length === 0) {
    await execute(
      `ALTER TABLE notifications
       ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER app_id`,
    );
  }

  type IndexRow = RowDataPacket & { Key_name: string };
  const indexes = await query<IndexRow[]>(`SHOW INDEX FROM notifications`);
  const names = new Set(indexes.map((row) => row.Key_name));
  if (!names.has("idx_notifications_app_type_id")) {
    await execute(
      `ALTER TABLE notifications
       ADD KEY idx_notifications_app_type_id (app_id, type, id)`,
    );
  }
  if (!names.has("idx_notifications_user_id")) {
    await execute(
      `ALTER TABLE notifications ADD KEY idx_notifications_user_id (user_id, id)`,
    );
  }
  schemaEnsured = true;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function normalizeAppId(value: string | null | undefined): NotificationAppTarget {
  if (value === "all" || value == null || value === "") return "all";
  return isClientAppId(value) ? value : "all";
}

export function mapNotification(row: NotificationRow): NotificationDto {
  const userId = row.user_id == null ? null : Number(row.user_id);
  return {
    id: row.id,
    type: row.type,
    appId: normalizeAppId(row.app_id),
    userId: userId && userId > 0 ? userId : null,
    username: row.username || null,
    nickname: row.nickname || null,
    version: row.version || null,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url || null,
    linkUrl: row.link_url || null,
    createdAt: toIso(row.created_at),
  };
}

const SELECT_NOTIFICATIONS = `SELECT n.id, n.type, n.app_id, n.user_id, u.username, u.nickname,
         n.version, n.title, n.summary, n.image_url, n.link_url, n.created_at
     FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id`;

export async function findUserByUsernameOrId(
  input: string,
): Promise<NotificationTargetUser | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const username = trimmed.toLowerCase();
  const asId = Number(trimmed);
  const byId = /^\d+$/.test(trimmed) && Number.isInteger(asId) && asId > 0;

  const rows = await query<
    (RowDataPacket & {
      id: number;
      username: string;
      nickname: string | null;
    })[]
  >(
    byId
      ? `SELECT id, username, nickname FROM users
         WHERE id = :id OR username = :username
         LIMIT 1`
      : `SELECT id, username, nickname FROM users
         WHERE username = :username
         LIMIT 1`,
    byId ? { id: asId, username } : { username },
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    nickname: row.nickname,
  };
}

export async function listNotifications(): Promise<NotificationDto[]> {
  await ensureNotificationsSchema();
  const rows = await query<NotificationRow[]>(
    `${SELECT_NOTIFICATIONS}
     ORDER BY n.created_at DESC, n.id DESC`,
  );
  return rows.map(mapNotification);
}

/**
 * Latest of each type for one client app.
 * Broadcast only (user_id IS NULL) so per-user hamster messages never leak
 * into 敲敲英语 or the public "latest" slot.
 */
export async function getLatestNotifications(
  appId: ClientAppId,
): Promise<NotificationDto[]> {
  await ensureNotificationsSchema();
  const rows = await query<NotificationRow[]>(
    `SELECT n.id, n.type, n.app_id, n.user_id, u.username, u.nickname,
            n.version, n.title, n.summary, n.image_url, n.link_url, n.created_at
     FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id
     INNER JOIN (
       SELECT type, MAX(id) AS max_id
       FROM notifications
       WHERE app_id IN ('all', :appId)
         AND user_id IS NULL
       GROUP BY type
     ) latest ON n.id = latest.max_id
     ORDER BY FIELD(n.type, 'update', 'message'), n.id DESC`,
    { appId },
  );
  return rows.map(mapNotification);
}

/**
 * 仓鼠单词 inbox: latest broadcast of each type, plus this user's personal messages.
 * Does not change the qiaoqiao "latest only" contract.
 */
export async function listHamsterNotifications(
  userId: number | null,
): Promise<NotificationDto[]> {
  const latest = await getLatestNotifications("hamster");
  if (userId == null) return latest;

  await ensureNotificationsSchema();
  const personal = await query<NotificationRow[]>(
    `${SELECT_NOTIFICATIONS}
     WHERE n.type = 'message'
       AND n.app_id = 'hamster'
       AND n.user_id = :userId
     ORDER BY n.id DESC
     LIMIT 50`,
    { userId },
  );

  const byId = new Map<number, NotificationDto>();
  for (const item of personal.map(mapNotification)) {
    byId.set(item.id, item);
  }
  for (const item of latest) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => b.id - a.id);
}

export async function createNotification(input: {
  type: NotificationType;
  appId: NotificationAppTarget;
  userId: number | null;
  version: string | null;
  title: string;
  summary: string;
  imageUrl: string | null;
  linkUrl: string | null;
}): Promise<NotificationDto> {
  await ensureNotificationsSchema();
  const userId = input.userId;
  const appId = userId != null ? "hamster" : input.appId;
  const type = userId != null ? "message" : input.type;
  if (userId != null && input.type === "update") {
    throw new Error("指定用户仅支持消息通知");
  }

  const result = await execute(
    `INSERT INTO notifications (type, app_id, user_id, version, title, summary, image_url, link_url)
     VALUES (:type, :appId, :userId, :version, :title, :summary, :imageUrl, :linkUrl)`,
    {
      type,
      appId,
      userId,
      version: input.version,
      title: input.title,
      summary: input.summary,
      imageUrl: input.imageUrl,
      linkUrl: input.linkUrl,
    },
  );

  const rows = await query<NotificationRow[]>(
    `${SELECT_NOTIFICATIONS} WHERE n.id = :id LIMIT 1`,
    { id: result.insertId },
  );
  const row = rows[0];
  if (!row) throw new Error("创建失败");
  return mapNotification(row);
}

export async function deleteNotification(id: number): Promise<void> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM notifications WHERE id = :id LIMIT 1`,
    { id },
  );
  if (!rows[0]) throw new Error("通知不存在");
  await execute(`DELETE FROM notifications WHERE id = :id`, { id });
}
