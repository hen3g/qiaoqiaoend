import type { RowDataPacket } from "mysql2";

import { execute, query, withTransaction } from "@/lib/db";
import { r2Delete, r2ListKeys, userCourseObjectKey } from "@/lib/r2";

/** Personal / learning tables keyed by user_id. Payment ledgers are kept. */
const PERSONAL_TABLES = [
  "email_bind_codes",
  "password_reset_codes",
  "user_courses",
  "redeem_logs",
  "promo_submissions",
  "feedback_submissions",
  "notification_api_daily_users",
  "user_studied_courses",
  "user_skill_progress",
  "user_daily_star_gains",
  "user_learn_correct",
  "user_daily_correct",
  "user_course_groups",
  "user_paper_summaries",
  "user_checkin_challenges",
  "device_visit_daily_users",
  "diamond_transactions",
] as const;

function mysqlErrno(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { errno?: unknown }).errno;
  return typeof code === "number" ? code : null;
}

/** 1146 = no table; 1054 = unknown column. */
function isIgnorableSchemaError(err: unknown): boolean {
  const errno = mysqlErrno(err);
  return errno === 1146 || errno === 1054;
}

async function runIgnoreMissing(
  sql: string,
  params: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await execute(sql, params);
  } catch (err) {
    if (isIgnorableSchemaError(err)) return;
    throw err;
  }
}

async function deleteR2Prefix(prefix: string): Promise<void> {
  try {
    const keys = await r2ListKeys(prefix);
    for (const key of keys) {
      try {
        await r2Delete(key);
      } catch {
        /* leftover objects are acceptable after account removal */
      }
    }
  } catch {
    /* R2 may be unconfigured in some environments */
  }
}

/**
 * Remove the user row and associated personal data.
 * Keeps payment_orders / apple_transactions for accounting and IAP idempotency.
 * Custom course JSON and original plaza listings are kept so other users'
 * pointers keep working.
 */
export async function deleteAccountForUser(userId: number): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("invalid user id");
  }

  const leftoverCopyIds: string[] = [];

  await withTransaction(async () => {
    const rows = await query<RowDataPacket[]>(
      `SELECT id FROM users WHERE id = :id LIMIT 1`,
      { id: userId },
    );
    if (!rows[0]) {
      throw new Error("账号不存在");
    }

    try {
      const copyRows = await query<(RowDataPacket & { course_id: string })[]>(
        `SELECT course_id FROM user_course_summaries
         WHERE user_id = :userId
           AND source_course_key IS NOT NULL
           AND source_course_key <> ''`,
        { userId },
      );
      for (const row of copyRows) {
        if (typeof row.course_id === "string" && row.course_id.trim()) {
          leftoverCopyIds.push(row.course_id.trim());
        }
      }
    } catch (err) {
      if (!isIgnorableSchemaError(err)) throw err;
    }

    await runIgnoreMissing(
      `DELETE FROM user_course_summaries
       WHERE user_id = :userId
         AND source_course_key IS NOT NULL
         AND source_course_key <> ''`,
      { userId },
    );
    await runIgnoreMissing(
      `UPDATE user_course_summaries
       SET note = NULL, group_id = NULL
       WHERE user_id = :userId
         AND (source_course_key IS NULL OR source_course_key = '')`,
      { userId },
    );

    for (const table of PERSONAL_TABLES) {
      await runIgnoreMissing(
        `DELETE FROM \`${table}\` WHERE user_id = :userId`,
        { userId },
      );
    }

    await runIgnoreMissing(
      `UPDATE users SET promoter_id = NULL WHERE promoter_id = :userId`,
      { userId },
    );
    await runIgnoreMissing(
      `UPDATE redeem_codes SET created_by = NULL WHERE created_by = :userId`,
      { userId },
    );
    await runIgnoreMissing(
      `UPDATE user_course_summaries
       SET author_user_id = NULL, author_name = '已注销用户'
       WHERE author_user_id = :userId`,
      { userId },
    );

    await execute(`DELETE FROM users WHERE id = :id`, { id: userId });
  });

  for (const courseId of leftoverCopyIds) {
    try {
      await r2Delete(userCourseObjectKey(userId, courseId));
    } catch {
      /* leftover copy files are optional */
    }
  }

  await deleteR2Prefix(`avatars/${userId}/`);
}
