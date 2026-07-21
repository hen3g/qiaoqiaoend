import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";

/** Same challenge id as babyenglish client app. */
export const CHECKIN_CHALLENGE_ID = "streak-5-permanent-vip";
export const CHECKIN_TOTAL_DAYS = 5;

export type CheckinStatus = "active" | "completed" | "failed" | "claimed";

export type CheckinParticipant = {
  userId: number;
  username: string | null;
  nickname: string | null;
  challengeId: string;
  status: CheckinStatus;
  completedDays: number;
  startedOn: string | null;
  day1CompletedOn: string | null;
  day2CompletedOn: string | null;
  day3CompletedOn: string | null;
  day4CompletedOn: string | null;
  day5CompletedOn: string | null;
  claimedAt: string | null;
  failedAt: string | null;
  failReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CheckinRow = RowDataPacket & {
  user_id: number;
  username: string | null;
  nickname: string | null;
  challenge_id: string;
  status: CheckinStatus;
  started_on: string | Date | null;
  day1_completed_on: string | Date | null;
  day2_completed_on: string | Date | null;
  day3_completed_on: string | Date | null;
  day4_completed_on: string | Date | null;
  day5_completed_on: string | Date | null;
  claimed_at: string | Date | null;
  failed_at: string | Date | null;
  fail_reason: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function countCompletedDays(row: CheckinRow): number {
  return [
    row.day1_completed_on,
    row.day2_completed_on,
    row.day3_completed_on,
    row.day4_completed_on,
    row.day5_completed_on,
  ].filter(Boolean).length;
}

function mapParticipant(row: CheckinRow): CheckinParticipant {
  return {
    userId: Number(row.user_id),
    username: row.username,
    nickname: row.nickname,
    challengeId: row.challenge_id,
    status: row.status,
    completedDays: countCompletedDays(row),
    startedOn: toDateOnly(row.started_on),
    day1CompletedOn: toDateOnly(row.day1_completed_on),
    day2CompletedOn: toDateOnly(row.day2_completed_on),
    day3CompletedOn: toDateOnly(row.day3_completed_on),
    day4CompletedOn: toDateOnly(row.day4_completed_on),
    day5CompletedOn: toDateOnly(row.day5_completed_on),
    claimedAt: toIso(row.claimed_at),
    failedAt: toIso(row.failed_at),
    failReason: row.fail_reason,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listCheckinParticipants(
  challengeId: string = CHECKIN_CHALLENGE_ID,
): Promise<CheckinParticipant[]> {
  const rows = await query<CheckinRow[]>(
    `SELECT c.user_id, u.username, u.nickname, c.challenge_id, c.status,
            DATE_FORMAT(c.started_on, '%Y-%m-%d') AS started_on,
            DATE_FORMAT(c.day1_completed_on, '%Y-%m-%d') AS day1_completed_on,
            DATE_FORMAT(c.day2_completed_on, '%Y-%m-%d') AS day2_completed_on,
            DATE_FORMAT(c.day3_completed_on, '%Y-%m-%d') AS day3_completed_on,
            DATE_FORMAT(c.day4_completed_on, '%Y-%m-%d') AS day4_completed_on,
            DATE_FORMAT(c.day5_completed_on, '%Y-%m-%d') AS day5_completed_on,
            c.claimed_at, c.failed_at, c.fail_reason, c.created_at, c.updated_at
     FROM user_checkin_challenges c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.challenge_id = :challengeId
     ORDER BY
       (c.day1_completed_on IS NOT NULL) +
       (c.day2_completed_on IS NOT NULL) +
       (c.day3_completed_on IS NOT NULL) +
       (c.day4_completed_on IS NOT NULL) +
       (c.day5_completed_on IS NOT NULL) DESC,
       FIELD(c.status, 'active', 'completed', 'claimed', 'failed'),
       c.started_on DESC,
       c.user_id DESC`,
    { challengeId },
  );
  return rows.map(mapParticipant);
}
