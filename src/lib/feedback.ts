import type { RowDataPacket } from "mysql2";

import { execute, query } from "@/lib/db";

export type FeedbackType = "problem" | "promo";

export type FeedbackSubmissionDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  type: FeedbackType;
  wechat: string;
  content: string;
  createdAt: string | null;
};

type FeedbackRow = RowDataPacket & {
  id: number;
  user_id: number;
  username: string | null;
  nickname: string | null;
  type: string;
  wechat: string;
  content: string;
  created_at: Date | string | null;
};

let tableEnsured = false;

export async function ensureFeedbackTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS feedback_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      type ENUM('problem', 'promo') NOT NULL,
      wechat VARCHAR(64) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_feedback_created (created_at),
      KEY idx_feedback_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function normalizeType(value: unknown): FeedbackType {
  return value === "promo" ? "promo" : "problem";
}

function mapRow(row: FeedbackRow): FeedbackSubmissionDto {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: row.username,
    nickname: row.nickname,
    type: normalizeType(row.type),
    wechat: row.wechat,
    content: row.content,
    createdAt: toIso(row.created_at),
  };
}

export function feedbackTypeLabel(type: FeedbackType): string {
  return type === "promo" ? "推广合作" : "问题反馈";
}

export async function createFeedbackSubmission(input: {
  userId: number;
  type: FeedbackType;
  wechat: string;
  content: string;
}): Promise<FeedbackSubmissionDto> {
  await ensureFeedbackTable();
  const wechat = input.wechat.trim();
  const content = input.content.trim();
  if (!wechat) throw new Error("请填写微信号");
  if (!content) throw new Error("请填写内容");

  const result = await execute(
    `INSERT INTO feedback_submissions (user_id, type, wechat, content, created_at)
     VALUES (:userId, :type, :wechat, :content, UTC_TIMESTAMP())`,
    {
      userId: input.userId,
      type: input.type,
      wechat: wechat.slice(0, 64),
      content: content.slice(0, 2000),
    },
  );

  const id = Number(result.insertId);
  const rows = await query<FeedbackRow[]>(
    `SELECT f.id, f.user_id, u.username, u.nickname, f.type, f.wechat, f.content, f.created_at
     FROM feedback_submissions f
     LEFT JOIN users u ON u.id = f.user_id
     WHERE f.id = :id
     LIMIT 1`,
    { id },
  );
  const row = rows[0];
  if (!row) throw new Error("提交失败，请重试");
  return mapRow(row);
}

export async function listFeedbackSubmissions(): Promise<FeedbackSubmissionDto[]> {
  await ensureFeedbackTable();
  const rows = await query<FeedbackRow[]>(
    `SELECT f.id, f.user_id, u.username, u.nickname, f.type, f.wechat, f.content, f.created_at
     FROM feedback_submissions f
     LEFT JOIN users u ON u.id = f.user_id
     ORDER BY f.id DESC
     LIMIT 500`,
  );
  return rows.map(mapRow);
}
