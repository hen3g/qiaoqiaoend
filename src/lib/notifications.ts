import type { RowDataPacket } from "mysql2";
import type { ClientAppFilter, ClientAppId } from "@/lib/client-app";
import { isClientAppId } from "@/lib/client-app";
import { execute, query } from "@/lib/db";
import {
  type AppUiLocale,
  ensureUserLocaleColumn,
  isAppUiLocale,
  parseAppUiLocale,
} from "@/lib/user-schema";

export type NotificationType = "update" | "message";

export type NotificationAppTarget = ClientAppFilter;

/** Audience language filter for hamster broadcasts; null = all locales. */
export type NotificationAudienceLocale = AppUiLocale | null;

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
  title_ja: string | null;
  summary_ja: string | null;
  locale: string | null;
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
  /** Resolved copy for the requesting locale (clients keep using these). */
  title: string;
  summary: string;
  titleZh: string | null;
  summaryZh: string | null;
  titleJa: string | null;
  summaryJa: string | null;
  /** Audience language for broadcasts; null = all. */
  locale: NotificationAudienceLocale;
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

  const localeCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM notifications LIKE 'locale'`,
  );
  if (localeCols.length === 0) {
    await execute(
      `ALTER TABLE notifications
       ADD COLUMN locale VARCHAR(8) NULL AFTER user_id`,
    );
  }

  const titleJaCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM notifications LIKE 'title_ja'`,
  );
  if (titleJaCols.length === 0) {
    await execute(
      `ALTER TABLE notifications
       ADD COLUMN title_ja VARCHAR(200) NULL AFTER title`,
    );
  }

  const summaryJaCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM notifications LIKE 'summary_ja'`,
  );
  if (summaryJaCols.length === 0) {
    await execute(
      `ALTER TABLE notifications
       ADD COLUMN summary_ja VARCHAR(500) NULL AFTER summary`,
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
  if (!names.has("idx_notifications_locale")) {
    await execute(
      `ALTER TABLE notifications ADD KEY idx_notifications_locale (locale)`,
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

function normalizeAudienceLocale(
  value: string | null | undefined,
): NotificationAudienceLocale {
  return isAppUiLocale(value) ? value : null;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Pick title/summary for a reader locale.
 * Prefer matching language; fall back to the other, then ZH storage fields.
 */
export function resolveNotificationCopy(
  input: {
    title: string;
    summary: string;
    titleJa?: string | null;
    summaryJa?: string | null;
  },
  prefer: AppUiLocale | null,
): { title: string; summary: string } {
  const zhTitle = input.title?.trim() || "";
  const zhSummary = input.summary?.trim() || "";
  const jaTitle = input.titleJa?.trim() || "";
  const jaSummary = input.summaryJa?.trim() || "";

  if (prefer === "ja") {
    return {
      title: jaTitle || zhTitle,
      summary: jaSummary || zhSummary,
    };
  }
  return {
    title: zhTitle || jaTitle,
    summary: zhSummary || jaSummary,
  };
}

export function mapNotification(
  row: NotificationRow,
  prefer: AppUiLocale | null = null,
): NotificationDto {
  const userId = row.user_id == null ? null : Number(row.user_id);
  const titleJa = trimOrNull(row.title_ja);
  const summaryJa = trimOrNull(row.summary_ja);
  const resolved = resolveNotificationCopy(
    {
      title: row.title,
      summary: row.summary,
      titleJa,
      summaryJa,
    },
    prefer,
  );
  return {
    id: row.id,
    type: row.type,
    appId: normalizeAppId(row.app_id),
    userId: userId && userId > 0 ? userId : null,
    username: row.username || null,
    nickname: row.nickname || null,
    version: row.version || null,
    title: resolved.title,
    summary: resolved.summary,
    titleZh: trimOrNull(row.title),
    summaryZh: trimOrNull(row.summary),
    titleJa,
    summaryJa,
    locale: normalizeAudienceLocale(row.locale),
    imageUrl: row.image_url || null,
    linkUrl: row.link_url || null,
    createdAt: toIso(row.created_at),
  };
}

const SELECT_NOTIFICATIONS = `SELECT n.id, n.type, n.app_id, n.user_id, n.locale,
         u.username, u.nickname,
         n.version, n.title, n.summary, n.title_ja, n.summary_ja,
         n.image_url, n.link_url, n.created_at
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

/** Split "id1, id2\\nname3" into unique non-empty tokens. */
export function parseTargetUserTokens(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[\s,，;；]+/)) {
    const token = part.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export async function listNotifications(options?: {
  appId?: ClientAppId | "all";
}): Promise<NotificationDto[]> {
  await ensureNotificationsSchema();
  const appId = options?.appId;
  const params: Record<string, string> = {};
  let where = "";
  if (appId && appId !== "all") {
    // Include legacy "all" rows so history stays visible on each app page.
    where = ` WHERE n.app_id IN ('all', :appId)`;
    params.appId = appId;
  }
  const rows = await query<NotificationRow[]>(
    `${SELECT_NOTIFICATIONS}${where}
     ORDER BY n.created_at DESC, n.id DESC`,
    params,
  );
  return rows.map((row) => mapNotification(row, null));
}

function audienceLocaleSql(
  userLocale: AppUiLocale | null,
  params: Record<string, string>,
): string {
  // null/unknown locale → treat as zh for audience matching.
  const effective = userLocale ?? "zh";
  params.audienceLocale = effective;
  return `(n.locale IS NULL OR n.locale = '' OR n.locale = :audienceLocale)`;
}

/**
 * Latest of each type for one client app.
 * Broadcast only (user_id IS NULL) so per-user hamster messages never leak
 * into 敲敲英语 or the public "latest" slot.
 * Hamster: also respect audience locale filter.
 */
export async function getLatestNotifications(
  appId: ClientAppId,
  userLocale: AppUiLocale | null = null,
): Promise<NotificationDto[]> {
  await ensureNotificationsSchema();
  const params: Record<string, string> = { appId };
  const localePred =
    appId === "hamster" ? `AND ${audienceLocaleSql(userLocale, params)}` : "";

  const rows = await query<NotificationRow[]>(
    `SELECT n.id, n.type, n.app_id, n.user_id, n.locale, u.username, u.nickname,
            n.version, n.title, n.summary, n.title_ja, n.summary_ja,
            n.image_url, n.link_url, n.created_at
     FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id
     INNER JOIN (
       SELECT type, MAX(id) AS max_id
       FROM notifications n
       WHERE n.app_id IN ('all', :appId)
         AND n.user_id IS NULL
         ${localePred}
       GROUP BY type
     ) latest ON n.id = latest.max_id
     ORDER BY FIELD(n.type, 'update', 'message'), n.id DESC`,
    params,
  );
  return rows.map((row) => mapNotification(row, userLocale));
}

/**
 * 仓鼠单词 inbox: latest broadcast of each type (locale-aware), plus this user's personal messages.
 * Requires a logged-in userId — guests get nothing (no broadcasts, no DMs).
 * Specific-user messages are never filtered by language.
 */
export async function listHamsterNotifications(
  userId: number | null,
  userLocale: AppUiLocale | null = null,
): Promise<NotificationDto[]> {
  if (userId == null) return [];

  await ensureUserLocaleColumn();
  const rows = await query<(RowDataPacket & { locale: string | null })[]>(
    `SELECT locale FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  // Prefer persisted users.locale; fall back to client hint (x-app-locale).
  const locale = parseAppUiLocale(rows[0]?.locale ?? null) ?? userLocale;

  const latest = await getLatestNotifications("hamster", locale);

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
  for (const item of personal.map((row) => mapNotification(row, locale))) {
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
  /** Broadcast audience language; ignored for specific-user sends. */
  locale?: NotificationAudienceLocale;
  version: string | null;
  title: string;
  summary: string;
  titleJa?: string | null;
  summaryJa?: string | null;
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

  const titleZh = trimOrNull(input.title);
  const summaryZh = trimOrNull(input.summary);
  const titleJa = trimOrNull(input.titleJa ?? null);
  const summaryJa = trimOrNull(input.summaryJa ?? null);

  // title/summary columns are NOT NULL — prefer ZH, else JA.
  const title = titleZh || titleJa;
  const summary = summaryZh || summaryJa;
  if (!title || !summary) {
    throw new Error("请至少填写一种语言的标题和简介");
  }

  const audienceLocale =
    userId != null ? null : normalizeAudienceLocale(input.locale ?? null);

  if (audienceLocale === "zh" && !titleZh) {
    throw new Error("中文受众请填写中文标题");
  }
  if (audienceLocale === "ja" && !titleJa) {
    throw new Error("日文受众请填写日文标题");
  }
  if (audienceLocale === "zh" && !summaryZh) {
    throw new Error("中文受众请填写中文简介");
  }
  if (audienceLocale === "ja" && !summaryJa) {
    throw new Error("日文受众请填写日文简介");
  }

  const result = await execute(
    `INSERT INTO notifications
       (type, app_id, user_id, locale, version, title, summary, title_ja, summary_ja, image_url, link_url)
     VALUES
       (:type, :appId, :userId, :locale, :version, :title, :summary, :titleJa, :summaryJa, :imageUrl, :linkUrl)`,
    {
      type,
      appId,
      userId,
      locale: audienceLocale,
      version: input.version,
      title,
      summary,
      titleJa,
      summaryJa,
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
  return mapNotification(row, null);
}

export async function deleteNotification(id: number): Promise<void> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM notifications WHERE id = :id LIMIT 1`,
    { id },
  );
  if (!rows[0]) throw new Error("通知不存在");
  await execute(`DELETE FROM notifications WHERE id = :id`, { id });
}
