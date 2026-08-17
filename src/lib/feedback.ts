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
  adminReply: string | null;
  repliedAt: string | null;
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
  admin_reply: string | null;
  replied_at: Date | string | null;
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
      admin_reply TEXT NULL,
      replied_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_feedback_created (created_at),
      KEY idx_feedback_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  type ColRow = RowDataPacket & { Field: string };
  const replyCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM feedback_submissions LIKE 'admin_reply'`,
  );
  if (replyCols.length === 0) {
    await execute(
      `ALTER TABLE feedback_submissions
       ADD COLUMN admin_reply TEXT NULL AFTER content`,
    );
  }
  const repliedAtCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM feedback_submissions LIKE 'replied_at'`,
  );
  if (repliedAtCols.length === 0) {
    await execute(
      `ALTER TABLE feedback_submissions
       ADD COLUMN replied_at DATETIME NULL AFTER admin_reply`,
    );
  }

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

const SELECT_FEEDBACK = `
  SELECT f.id, f.user_id, u.username, u.nickname, f.type, f.wechat, f.content,
         f.admin_reply, f.replied_at, f.created_at
  FROM feedback_submissions f
  LEFT JOIN users u ON u.id = f.user_id
`;

function mapRow(row: FeedbackRow): FeedbackSubmissionDto {
  const adminReply =
    typeof row.admin_reply === "string" && row.admin_reply.trim().length > 0
      ? row.admin_reply
      : null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: row.username,
    nickname: row.nickname,
    type: normalizeType(row.type),
    wechat: row.wechat,
    content: row.content,
    adminReply,
    repliedAt: adminReply ? toIso(row.replied_at) : null,
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
    `${SELECT_FEEDBACK}
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
    `${SELECT_FEEDBACK}
     ORDER BY f.id DESC
     LIMIT 500`,
  );
  return rows.map(mapRow);
}

export async function listFeedbackSubmissionsForUser(
  userId: number,
): Promise<FeedbackSubmissionDto[]> {
  await ensureFeedbackTable();
  const rows = await query<FeedbackRow[]>(
    `${SELECT_FEEDBACK}
     WHERE f.user_id = :userId
     ORDER BY f.id DESC
     LIMIT 200`,
    { userId },
  );
  return rows.map(mapRow);
}

export async function replyToFeedbackSubmission(input: {
  id: number;
  reply: string;
}): Promise<FeedbackSubmissionDto> {
  await ensureFeedbackTable();
  const reply = input.reply.trim();
  if (!reply) throw new Error("请填写回复内容");
  if (reply.length > 2000) throw new Error("回复内容过长");

  const existing = await query<FeedbackRow[]>(
    `${SELECT_FEEDBACK}
     WHERE f.id = :id
     LIMIT 1`,
    { id: input.id },
  );
  if (!existing[0]) throw new Error("反馈不存在");

  await execute(
    `UPDATE feedback_submissions
     SET admin_reply = :reply, replied_at = UTC_TIMESTAMP()
     WHERE id = :id
     LIMIT 1`,
    { id: input.id, reply: reply.slice(0, 2000) },
  );

  const rows = await query<FeedbackRow[]>(
    `${SELECT_FEEDBACK}
     WHERE f.id = :id
     LIMIT 1`,
    { id: input.id },
  );
  const row = rows[0];
  if (!row) throw new Error("回复失败，请重试");
  return mapRow(row);
}
