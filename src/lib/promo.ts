import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { extendVip } from "@/lib/courses";

export type PromoStatus = "pending" | "rewarded" | "rejected";

const DAYS_PER_MONTH = 30;

type PromoRow = RowDataPacket & {
  id: number;
  user_id: number;
  username?: string;
  nickname?: string | null;
  video_url: string;
  likes_claimed: number | null;
  note: string | null;
  status: PromoStatus;
  months_granted: number;
  admin_note: string | null;
  rewarded_at: Date | string | null;
  created_at: Date | string | null;
  updated_at?: Date | string | null;
};

export type PromoSubmissionDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  videoUrl: string;
  likesClaimed: number | null;
  note: string | null;
  status: PromoStatus;
  monthsGranted: number;
  adminNote: string | null;
  rewardedAt: string | null;
  createdAt: string | null;
};

let ensured = false;

export async function ensurePromoTable(): Promise<void> {
  if (ensured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS promo_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      video_url VARCHAR(500) NOT NULL,
      likes_claimed INT UNSIGNED NULL,
      note VARCHAR(255) NULL,
      status ENUM('pending', 'rewarded', 'rejected') NOT NULL DEFAULT 'pending',
      months_granted INT UNSIGNED NOT NULL DEFAULT 0,
      admin_note VARCHAR(500) NULL,
      rewarded_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_promo_user_id (user_id),
      KEY idx_promo_status (status),
      KEY idx_promo_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ensured = true;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapPromoSubmission(row: PromoRow): PromoSubmissionDto {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    videoUrl: row.video_url,
    likesClaimed: row.likes_claimed,
    note: row.note,
    status: row.status,
    monthsGranted: row.months_granted,
    adminNote: row.admin_note,
    rewardedAt: toIso(row.rewarded_at),
    createdAt: toIso(row.created_at),
  };
}

export async function createPromoSubmission(input: {
  userId: number;
  videoUrl: string;
  likesClaimed: number | null;
  note: string | null;
}): Promise<PromoSubmissionDto> {
  await ensurePromoTable();
  const result = await execute(
    `INSERT INTO promo_submissions (user_id, video_url, likes_claimed, note)
     VALUES (:userId, :videoUrl, :likesClaimed, :note)`,
    {
      userId: input.userId,
      videoUrl: input.videoUrl,
      likesClaimed: input.likesClaimed,
      note: input.note,
    },
  );
  const id = Number(result.insertId);
  const rows = await query<PromoRow[]>(
    `SELECT id, user_id, video_url, likes_claimed, note, status,
            months_granted, admin_note, rewarded_at, created_at
     FROM promo_submissions WHERE id = :id LIMIT 1`,
    { id },
  );
  const row = rows[0];
  if (!row) throw new Error("提交失败，请重试");
  return mapPromoSubmission(row);
}

export async function listPromoSubmissionsForUser(
  userId: number,
): Promise<PromoSubmissionDto[]> {
  await ensurePromoTable();
  const rows = await query<PromoRow[]>(
    `SELECT id, user_id, video_url, likes_claimed, note, status,
            months_granted, admin_note, rewarded_at, created_at
     FROM promo_submissions
     WHERE user_id = :userId
     ORDER BY id DESC`,
    { userId },
  );
  return rows.map(mapPromoSubmission);
}

export async function listAllPromoSubmissions(): Promise<PromoSubmissionDto[]> {
  await ensurePromoTable();
  const rows = await query<PromoRow[]>(
    `SELECT p.id, p.user_id, u.username, u.nickname,
            p.video_url, p.likes_claimed, p.note, p.status,
            p.months_granted, p.admin_note, p.rewarded_at, p.created_at
     FROM promo_submissions p
     INNER JOIN users u ON u.id = p.user_id
     ORDER BY FIELD(p.status, 'pending', 'rewarded', 'rejected'), p.id DESC`,
  );
  return rows.map(mapPromoSubmission);
}

export async function rewardPromoSubmission(input: {
  id: number;
  months: number;
  adminNote: string | null;
}): Promise<PromoSubmissionDto> {
  await ensurePromoTable();
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 120) {
    throw new Error("发放月数需在 1–120 之间");
  }

  const rows = await query<PromoRow[]>(
    `SELECT id, user_id, video_url, likes_claimed, note, status,
            months_granted, admin_note, rewarded_at, created_at
     FROM promo_submissions WHERE id = :id LIMIT 1`,
    { id: input.id },
  );
  const row = rows[0];
  if (!row) throw new Error("投稿不存在");
  if (row.status === "rewarded") {
    throw new Error("该投稿已发放过会员");
  }

  const days = input.months * DAYS_PER_MONTH;
  await extendVip(row.user_id, days);
  await execute(
    `UPDATE promo_submissions
     SET status = 'rewarded',
         months_granted = :months,
         admin_note = :adminNote,
         rewarded_at = NOW()
     WHERE id = :id`,
    {
      id: input.id,
      months: input.months,
      adminNote: input.adminNote,
    },
  );

  const updated = await query<PromoRow[]>(
    `SELECT p.id, p.user_id, u.username, u.nickname,
            p.video_url, p.likes_claimed, p.note, p.status,
            p.months_granted, p.admin_note, p.rewarded_at, p.created_at
     FROM promo_submissions p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.id = :id LIMIT 1`,
    { id: input.id },
  );
  const next = updated[0];
  if (!next) throw new Error("发放失败，请重试");
  return mapPromoSubmission(next);
}

export async function rejectPromoSubmission(input: {
  id: number;
  adminNote: string | null;
}): Promise<PromoSubmissionDto> {
  await ensurePromoTable();
  const rows = await query<PromoRow[]>(
    `SELECT id, user_id, status FROM promo_submissions WHERE id = :id LIMIT 1`,
    { id: input.id },
  );
  const row = rows[0];
  if (!row) throw new Error("投稿不存在");
  if (row.status === "rewarded") {
    throw new Error("已发放会员的投稿不能改为驳回");
  }

  await execute(
    `UPDATE promo_submissions
     SET status = 'rejected',
         admin_note = :adminNote,
         months_granted = 0,
         rewarded_at = NULL
     WHERE id = :id`,
    { id: input.id, adminNote: input.adminNote },
  );

  const updated = await query<PromoRow[]>(
    `SELECT p.id, p.user_id, u.username, u.nickname,
            p.video_url, p.likes_claimed, p.note, p.status,
            p.months_granted, p.admin_note, p.rewarded_at, p.created_at
     FROM promo_submissions p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.id = :id LIMIT 1`,
    { id: input.id },
  );
  const next = updated[0];
  if (!next) throw new Error("操作失败，请重试");
  return mapPromoSubmission(next);
}
