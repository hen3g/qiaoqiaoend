import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";

export type NotificationType = "update" | "message";

type NotificationRow = RowDataPacket & {
  id: number;
  type: NotificationType;
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
  version: string | null;
  title: string;
  summary: string;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapNotification(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    version: row.version || null,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url || null,
    linkUrl: row.link_url || null,
    createdAt: toIso(row.created_at),
  };
}

export async function listNotifications(): Promise<NotificationDto[]> {
  const rows = await query<NotificationRow[]>(
    `SELECT id, type, version, title, summary, image_url, link_url, created_at
     FROM notifications
     ORDER BY created_at DESC, id DESC`,
  );
  return rows.map(mapNotification);
}

/** Latest of each type (update + message), at most 2. */
export async function getLatestNotifications(): Promise<NotificationDto[]> {
  const rows = await query<NotificationRow[]>(
    `SELECT n.id, n.type, n.version, n.title, n.summary, n.image_url, n.link_url, n.created_at
     FROM notifications n
     INNER JOIN (
       SELECT type, MAX(id) AS max_id
       FROM notifications
       GROUP BY type
     ) latest ON n.id = latest.max_id
     ORDER BY FIELD(n.type, 'update', 'message'), n.id DESC`,
  );
  return rows.map(mapNotification);
}

export async function createNotification(input: {
  type: NotificationType;
  version: string | null;
  title: string;
  summary: string;
  imageUrl: string | null;
  linkUrl: string | null;
}): Promise<NotificationDto> {
  const result = await execute(
    `INSERT INTO notifications (type, version, title, summary, image_url, link_url)
     VALUES (:type, :version, :title, :summary, :imageUrl, :linkUrl)`,
    {
      type: input.type,
      version: input.version,
      title: input.title,
      summary: input.summary,
      imageUrl: input.imageUrl,
      linkUrl: input.linkUrl,
    },
  );

  const rows = await query<NotificationRow[]>(
    `SELECT id, type, version, title, summary, image_url, link_url, created_at
     FROM notifications WHERE id = :id LIMIT 1`,
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
