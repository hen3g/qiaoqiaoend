import type { RowDataPacket } from "mysql2";
import { getSessionUserById } from "@/lib/auth";
import { extendVip } from "@/lib/courses";
import { execute, query } from "@/lib/db";

/** Nickname promo: 「爱吃」+ at least 2 more characters → 99 years VIP (once). */
export const AICHI_VIP_PREFIX = "爱吃";
export const AICHI_VIP_MIN_EXTRA_CHARS = 2;
/** 99 years, counted as 365-day years (stackable via extendVip). */
export const AICHI_VIP_DAYS = 99 * 365;

export type AichiVipGrantSource = "register" | "rename";

export type AichiVipGrantDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string;
  source: AichiVipGrantSource | string;
  daysGranted: number;
  createdAt: string | null;
};

export type AichiVipPromoSettings = {
  enabled: boolean;
};

export type AichiVipGrantResult =
  | { granted: true; days: number }
  | {
      granted: false;
      reason:
        | "disabled"
        | "no_match"
        | "already_vip"
        | "already_granted"
        | "user_not_found";
    };

let grantsEnsured = false;
let settingsEnsured = false;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

/**
 * Product field is nickname (改名 / 起名). Username is ASCII-only and cannot match.
 * Rule: trimmed nickname starts with 「爱吃」 and has ≥2 characters after the prefix.
 */
export function matchesAichiPromoNickname(
  raw: string | null | undefined,
): boolean {
  const name = (raw ?? "").trim();
  if (!name.startsWith(AICHI_VIP_PREFIX)) return false;
  return name.length >= AICHI_VIP_PREFIX.length + AICHI_VIP_MIN_EXTRA_CHARS;
}

export async function ensureAichiVipGrantsTable(): Promise<void> {
  if (grantsEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS aichi_vip_grants (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      nickname VARCHAR(64) NOT NULL,
      source VARCHAR(32) NOT NULL,
      days_granted INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_aichi_vip_user (user_id),
      KEY idx_aichi_vip_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  grantsEnsured = true;
}

export async function ensureAichiVipSettingsTable(): Promise<void> {
  if (settingsEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS aichi_vip_promo_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(
    `INSERT IGNORE INTO aichi_vip_promo_settings (id, enabled) VALUES (1, 1)`,
  );
  settingsEnsured = true;
}

export async function getAichiVipPromoSettings(): Promise<AichiVipPromoSettings> {
  await ensureAichiVipSettingsTable();
  const rows = await query<(RowDataPacket & { enabled: number | boolean })[]>(
    `SELECT enabled FROM aichi_vip_promo_settings WHERE id = 1 LIMIT 1`,
  );
  return { enabled: Boolean(rows[0]?.enabled ?? true) };
}

export async function setAichiVipPromoEnabled(
  enabled: boolean,
): Promise<AichiVipPromoSettings> {
  await ensureAichiVipSettingsTable();
  await execute(
    `INSERT INTO aichi_vip_promo_settings (id, enabled) VALUES (1, :enabled)
     ON DUPLICATE KEY UPDATE enabled = :enabled`,
    { enabled: enabled ? 1 : 0 },
  );
  return { enabled };
}

async function hasAichiVipGrant(userId: number): Promise<boolean> {
  await ensureAichiVipGrantsTable();
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM aichi_vip_grants WHERE user_id = :userId LIMIT 1`,
    { userId },
  );
  return Boolean(rows[0]);
}

/**
 * Grant 99y VIP when nickname matches, unless already VIP or already granted.
 * Safe to call after register / rename; never throws for business skip reasons.
 */
export async function tryGrantAichiVipPromo(input: {
  userId: number;
  nickname: string | null | undefined;
  source: AichiVipGrantSource;
}): Promise<AichiVipGrantResult> {
  const settings = await getAichiVipPromoSettings();
  if (!settings.enabled) return { granted: false, reason: "disabled" };

  const nickname = (input.nickname ?? "").trim();
  if (!matchesAichiPromoNickname(nickname)) {
    return { granted: false, reason: "no_match" };
  }

  if (await hasAichiVipGrant(input.userId)) {
    return { granted: false, reason: "already_granted" };
  }

  const user = await getSessionUserById(input.userId);
  if (!user) return { granted: false, reason: "user_not_found" };
  if (user.isVip) return { granted: false, reason: "already_vip" };

  await extendVip(input.userId, AICHI_VIP_DAYS);
  await ensureAichiVipGrantsTable();
  try {
    await execute(
      `INSERT INTO aichi_vip_grants (user_id, nickname, source, days_granted)
       VALUES (:userId, :nickname, :source, :days)`,
      {
        userId: input.userId,
        nickname,
        source: input.source,
        days: AICHI_VIP_DAYS,
      },
    );
  } catch (err) {
    // Unique race: another request granted first — treat as already granted.
    if (await hasAichiVipGrant(input.userId)) {
      return { granted: false, reason: "already_granted" };
    }
    throw err;
  }

  return { granted: true, days: AICHI_VIP_DAYS };
}

export async function listRecentAichiVipGrants(
  limit = 50,
): Promise<AichiVipGrantDto[]> {
  await ensureAichiVipGrantsTable();
  const take = Math.min(200, Math.max(1, Math.floor(limit)));
  const rows = await query<
    (RowDataPacket & {
      id: number;
      user_id: number;
      username: string | null;
      nickname: string;
      source: string;
      days_granted: number;
      created_at: Date | string | null;
    })[]
  >(
    `SELECT g.id, g.user_id, u.username, g.nickname, g.source, g.days_granted, g.created_at
     FROM aichi_vip_grants g
     LEFT JOIN users u ON u.id = g.user_id
     ORDER BY g.id DESC
     LIMIT ${take}`,
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username ?? null,
    nickname: row.nickname,
    source: row.source,
    daysGranted: row.days_granted,
    createdAt: toIso(row.created_at),
  }));
}

export async function countAichiVipGrants(): Promise<number> {
  await ensureAichiVipGrantsTable();
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM aichi_vip_grants`,
  );
  return Number(rows[0]?.total ?? 0);
}

/** All user ids that received VIP via the 爱吃 nickname promo (deduped). */
export async function listAllAichiVipGrantUserIds(): Promise<number[]> {
  await ensureAichiVipGrantsTable();
  const rows = await query<(RowDataPacket & { user_id: number })[]>(
    `SELECT user_id FROM aichi_vip_grants ORDER BY id ASC`,
  );
  return rows.map((row) => Number(row.user_id)).filter((id) => id > 0);
}
