import "server-only";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  EMAIL_CODE_TTL_MS,
  EMAIL_MAX_ATTEMPTS,
  EMAIL_SEND_COOLDOWN_MS,
  generateEmailCode,
} from "@/lib/email-bind";
import { ensurePasswordResetCodesTable } from "@/lib/user-schema";

type CodeRow = RowDataPacket & {
  id: number;
  user_id: number;
  email: string;
  code: string;
  expires_at: Date | string;
  attempt_count: number;
  created_at: Date | string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function getLatestResetCode(
  userId: number,
): Promise<CodeRow | null> {
  await ensurePasswordResetCodesTable();
  const rows = await query<CodeRow[]>(
    `SELECT id, user_id, email, code, expires_at, attempt_count, created_at
     FROM password_reset_codes
     WHERE user_id = :userId
     ORDER BY id DESC
     LIMIT 1`,
    { userId },
  );
  return rows[0] ?? null;
}

export async function assertCanSendResetCode(userId: number): Promise<void> {
  const latest = await getLatestResetCode(userId);
  if (!latest) return;
  const createdAt = toDate(latest.created_at).getTime();
  const waitMs = EMAIL_SEND_COOLDOWN_MS - (Date.now() - createdAt);
  if (waitMs > 0) {
    const seconds = Math.ceil(waitMs / 1000);
    throw new Error(`SEND_COOLDOWN:${seconds}`);
  }
}

export async function createResetCode(input: {
  userId: number;
  email: string;
  code: string;
}): Promise<{ expiresAt: Date }> {
  await ensurePasswordResetCodesTable();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  await execute(`DELETE FROM password_reset_codes WHERE user_id = :userId`, {
    userId: input.userId,
  });
  await execute(
    `INSERT INTO password_reset_codes (user_id, email, code, expires_at)
     VALUES (:userId, :email, :code, :expiresAt)`,
    {
      userId: input.userId,
      email: input.email,
      code: input.code,
      expiresAt,
    },
  );
  return { expiresAt };
}

export type VerifyResetResult =
  | { ok: true; userId: number; email: string }
  | { ok: false; reason: "not_found" | "expired" | "mismatch" | "too_many" };

export async function verifyAndConsumeResetCode(input: {
  userId: number;
  email: string;
  code: string;
}): Promise<VerifyResetResult> {
  await ensurePasswordResetCodesTable();
  const latest = await getLatestResetCode(input.userId);
  if (!latest || latest.email !== input.email) {
    return { ok: false, reason: "not_found" };
  }

  if (toDate(latest.expires_at).getTime() <= Date.now()) {
    await execute(`DELETE FROM password_reset_codes WHERE id = :id`, {
      id: latest.id,
    });
    return { ok: false, reason: "expired" };
  }

  if (latest.attempt_count >= EMAIL_MAX_ATTEMPTS) {
    await execute(`DELETE FROM password_reset_codes WHERE id = :id`, {
      id: latest.id,
    });
    return { ok: false, reason: "too_many" };
  }

  if (latest.code !== input.code) {
    await execute(
      `UPDATE password_reset_codes
       SET attempt_count = attempt_count + 1
       WHERE id = :id`,
      { id: latest.id },
    );
    if (latest.attempt_count + 1 >= EMAIL_MAX_ATTEMPTS) {
      await execute(`DELETE FROM password_reset_codes WHERE id = :id`, {
        id: latest.id,
      });
      return { ok: false, reason: "too_many" };
    }
    return { ok: false, reason: "mismatch" };
  }

  await execute(`DELETE FROM password_reset_codes WHERE user_id = :userId`, {
    userId: input.userId,
  });
  return { ok: true, userId: latest.user_id, email: latest.email };
}

export { generateEmailCode };
