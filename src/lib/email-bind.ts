import "server-only";
import { randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import { ensureUserEmailColumn } from "@/lib/user-schema";

export const EMAIL_CODE_TTL_MS = 30 * 60 * 1000;
export const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_MAX_ATTEMPTS = 5;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 255 && EMAIL_RE.test(email);
}

export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

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

export async function getUserEmail(userId: number): Promise<string | null> {
  await ensureUserEmailColumn();
  const rows = await query<(RowDataPacket & { email: string | null })[]>(
    `SELECT email FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  const email = rows[0]?.email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

export async function findUserIdByEmail(
  email: string,
): Promise<number | null> {
  await ensureUserEmailColumn();
  const rows = await query<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM users WHERE email = :email LIMIT 1`,
    { email },
  );
  return rows[0]?.id ?? null;
}

export async function getLatestBindCode(
  userId: number,
): Promise<CodeRow | null> {
  await ensureUserEmailColumn();
  const rows = await query<CodeRow[]>(
    `SELECT id, user_id, email, code, expires_at, attempt_count, created_at
     FROM email_bind_codes
     WHERE user_id = :userId
     ORDER BY id DESC
     LIMIT 1`,
    { userId },
  );
  return rows[0] ?? null;
}

export async function assertCanSendCode(userId: number): Promise<void> {
  const latest = await getLatestBindCode(userId);
  if (!latest) return;
  const createdAt = toDate(latest.created_at).getTime();
  const waitMs = EMAIL_SEND_COOLDOWN_MS - (Date.now() - createdAt);
  if (waitMs > 0) {
    const seconds = Math.ceil(waitMs / 1000);
    throw new Error(`SEND_COOLDOWN:${seconds}`);
  }
}

export async function createBindCode(input: {
  userId: number;
  email: string;
  code: string;
}): Promise<{ expiresAt: Date }> {
  await ensureUserEmailColumn();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  await execute(
    `DELETE FROM email_bind_codes WHERE user_id = :userId`,
    { userId: input.userId },
  );
  await execute(
    `INSERT INTO email_bind_codes (user_id, email, code, expires_at)
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

export type VerifyBindResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "expired" | "mismatch" | "too_many" };

export async function verifyAndConsumeBindCode(input: {
  userId: number;
  email: string;
  code: string;
}): Promise<VerifyBindResult> {
  await ensureUserEmailColumn();
  const latest = await getLatestBindCode(input.userId);
  if (!latest || latest.email !== input.email) {
    return { ok: false, reason: "not_found" };
  }

  if (toDate(latest.expires_at).getTime() <= Date.now()) {
    await execute(`DELETE FROM email_bind_codes WHERE id = :id`, {
      id: latest.id,
    });
    return { ok: false, reason: "expired" };
  }

  if (latest.attempt_count >= EMAIL_MAX_ATTEMPTS) {
    await execute(`DELETE FROM email_bind_codes WHERE id = :id`, {
      id: latest.id,
    });
    return { ok: false, reason: "too_many" };
  }

  if (latest.code !== input.code) {
    await execute(
      `UPDATE email_bind_codes
       SET attempt_count = attempt_count + 1
       WHERE id = :id`,
      { id: latest.id },
    );
    if (latest.attempt_count + 1 >= EMAIL_MAX_ATTEMPTS) {
      await execute(`DELETE FROM email_bind_codes WHERE id = :id`, {
        id: latest.id,
      });
      return { ok: false, reason: "too_many" };
    }
    return { ok: false, reason: "mismatch" };
  }

  await execute(`DELETE FROM email_bind_codes WHERE user_id = :userId`, {
    userId: input.userId,
  });
  return { ok: true, email: latest.email };
}

export async function bindUserEmail(
  userId: number,
  email: string,
): Promise<void> {
  await ensureUserEmailColumn();
  await execute(`UPDATE users SET email = :email WHERE id = :id`, {
    email,
    id: userId,
  });
}
