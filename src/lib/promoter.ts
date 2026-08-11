import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  ensureRedeemCodesCreatedByColumn,
  ensureRedeemCodesIsPromoterColumn,
  vipLabel,
} from "@/lib/redeem";
import { ensureUserPromoterColumns } from "@/lib/user-schema";

export const PROMOTER_MAX_CODES = 3;
export const PROMOTER_ALLOWED_DAYS = [7, 30] as const;
export const PROMOTER_DEFAULT_MAX_USES = 999999;
export const PROMOTER_CODE_MIN_LENGTH = 4;
export const PROMOTER_CODE_MAX_LENGTH = 64;
export const PROMOTER_CODE_PATTERN = /^[A-Za-z0-9]+$/;

export type PromoterCodeDto = {
  id: number;
  code: string;
  days: number;
  label: string;
  maxUses: number;
  usedCount: number;
  createdAt: string | null;
};

export type PromoterBoundUserDto = {
  id: number;
  username: string;
  nickname: string | null;
  redeemedAt: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function normalizePromoterCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validatePromoterCodeText(raw: string): string {
  const code = normalizePromoterCode(raw);
  if (code.length < PROMOTER_CODE_MIN_LENGTH) {
    throw new Error(`兑换码至少 ${PROMOTER_CODE_MIN_LENGTH} 个字符`);
  }
  if (code.length > PROMOTER_CODE_MAX_LENGTH) {
    throw new Error(`兑换码最多 ${PROMOTER_CODE_MAX_LENGTH} 个字符`);
  }
  if (!PROMOTER_CODE_PATTERN.test(code)) {
    throw new Error("兑换码只能包含英文字母或数字");
  }
  return code;
}

export async function requirePromoterUser(userId: number): Promise<void> {
  await ensureUserPromoterColumns();
  const rows = await query<(RowDataPacket & { is_promoter: number | boolean })[]>(
    `SELECT is_promoter FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  if (!rows[0] || !rows[0].is_promoter) {
    throw new Error("FORBIDDEN");
  }
}

export async function setUserIsPromoter(
  userId: number,
  isPromoter: boolean,
): Promise<void> {
  await ensureUserPromoterColumns();
  if (!Number.isInteger(userId) || userId < 1) {
    throw new Error("用户 ID 无效");
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM users WHERE id = :id LIMIT 1`,
    { id: userId },
  );
  if (!rows[0]) {
    throw new Error("用户不存在");
  }
  await execute(
    `UPDATE users SET is_promoter = :isPromoter WHERE id = :id`,
    { id: userId, isPromoter: isPromoter ? 1 : 0 },
  );
}

/** First-touch bind: only if user has no promoter yet and is not self. */
export async function bindUserToPromoter(
  userId: number,
  promoterId: number,
): Promise<void> {
  if (userId === promoterId) return;
  await ensureUserPromoterColumns();
  await execute(
    `UPDATE users
     SET promoter_id = :promoterId
     WHERE id = :userId
       AND promoter_id IS NULL`,
    { userId, promoterId },
  );
}

async function countPromoterCodes(userId: number): Promise<number> {
  const rows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c
     FROM redeem_codes
     WHERE created_by = :userId AND is_promoter_code = 1`,
    { userId },
  );
  return Number(rows[0]?.c ?? 0);
}

type PromoterCodeRow = RowDataPacket & {
  id: number;
  code: string;
  value: string | null;
  max_uses: number;
  used_count: number;
  created_at: Date | string | null;
};

function mapPromoterCode(row: PromoterCodeRow): PromoterCodeDto {
  const days = Number(row.value || 0);
  return {
    id: row.id,
    code: row.code,
    days,
    label: vipLabel(row.value),
    maxUses: row.max_uses,
    usedCount: row.used_count,
    createdAt: toIso(row.created_at),
  };
}

export async function listPromoterCodes(
  userId: number,
): Promise<PromoterCodeDto[]> {
  await ensureRedeemCodesCreatedByColumn();
  await ensureRedeemCodesIsPromoterColumn();
  const rows = await query<PromoterCodeRow[]>(
    `SELECT id, code, value, max_uses, used_count, created_at
     FROM redeem_codes
     WHERE created_by = :userId AND is_promoter_code = 1
     ORDER BY id DESC`,
    { userId },
  );
  return rows.map(mapPromoterCode);
}

export async function createPromoterCode(
  userId: number,
  input: { code: string; days: number },
): Promise<PromoterCodeDto> {
  await ensureRedeemCodesCreatedByColumn();
  await ensureRedeemCodesIsPromoterColumn();
  await requirePromoterUser(userId);

  const days = Number(input.days);
  if (
    !PROMOTER_ALLOWED_DAYS.includes(
      days as (typeof PROMOTER_ALLOWED_DAYS)[number],
    )
  ) {
    throw new Error("会员天数只能选择 7 天或 30 天");
  }

  if ((await countPromoterCodes(userId)) >= PROMOTER_MAX_CODES) {
    throw new Error(`最多只能创建 ${PROMOTER_MAX_CODES} 个推广兑换码`);
  }

  const code = validatePromoterCodeText(input.code);
  const value = String(days);
  const maxUses = PROMOTER_DEFAULT_MAX_USES;

  try {
    const result = await execute(
      `INSERT INTO redeem_codes
         (code, type, value, max_uses, used_count, expires_at, created_by, is_promoter_code)
       VALUES
         (:code, 'vip_days', :value, :maxUses, 0, NULL, :userId, 1)`,
      { code, value, maxUses, userId },
    );
    return {
      id: Number(result.insertId),
      code,
      days,
      label: vipLabel(value),
      maxUses,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
      throw new Error("该兑换码已存在，请换一个");
    }
    throw err;
  }
}

export async function deletePromoterCode(
  userId: number,
  codeId: number,
): Promise<void> {
  await ensureRedeemCodesCreatedByColumn();
  await ensureRedeemCodesIsPromoterColumn();
  if (!Number.isInteger(codeId) || codeId < 1) {
    throw new Error("兑换码 ID 无效");
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM redeem_codes
     WHERE id = :id AND created_by = :userId AND is_promoter_code = 1
     LIMIT 1`,
    { id: codeId, userId },
  );
  if (!rows[0]) {
    throw new Error("兑换码不存在");
  }
  await execute(`DELETE FROM redeem_logs WHERE code_id = :id`, { id: codeId });
  await execute(`DELETE FROM redeem_codes WHERE id = :id`, { id: codeId });
}

type BoundUserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  redeemed_at: Date | string | null;
};

export async function listPromoterCodeUsers(
  userId: number,
  codeId: number,
): Promise<PromoterBoundUserDto[]> {
  await ensureRedeemCodesCreatedByColumn();
  await ensureRedeemCodesIsPromoterColumn();
  if (!Number.isInteger(codeId) || codeId < 1) {
    throw new Error("兑换码 ID 无效");
  }
  const owned = await query<RowDataPacket[]>(
    `SELECT id FROM redeem_codes
     WHERE id = :id AND created_by = :userId AND is_promoter_code = 1
     LIMIT 1`,
    { id: codeId, userId },
  );
  if (!owned[0]) {
    throw new Error("兑换码不存在");
  }

  const rows = await query<BoundUserRow[]>(
    `SELECT u.id, u.username, u.nickname, rl.created_at AS redeemed_at
     FROM redeem_logs rl
     INNER JOIN users u ON u.id = rl.user_id
     WHERE rl.code_id = :codeId
     ORDER BY rl.id DESC`,
    { codeId },
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    redeemedAt: toIso(row.redeemed_at),
  }));
}

export type PromoterReferredUserDto = {
  id: number;
  username: string;
  nickname: string | null;
  isVip: boolean;
  vipExpiresAt: string | null;
  diamonds: number;
  createdAt: string | null;
  redeemCode: string | null;
  redeemedAt: string | null;
};

export type PromoterReferredUsersResult = {
  users: PromoterReferredUserDto[];
  total: number;
  page: number;
  pageSize: number;
};

type ReferredUserRow = RowDataPacket & {
  id: number;
  username: string;
  nickname: string | null;
  vip_expires_at: Date | string | null;
  diamonds: number | null;
  created_at: Date | string | null;
  redeem_code: string | null;
  redeemed_at: Date | string | null;
};

function isVipActive(vipExpiresAt: Date | string | null): boolean {
  if (!vipExpiresAt) return false;
  const d =
    vipExpiresAt instanceof Date ? vipExpiresAt : new Date(vipExpiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

/** All users bound to this promoter via users.promoter_id. */
export async function listPromoterReferredUsers(
  promoterId: number,
  options?: { page?: number; pageSize?: number; q?: string },
): Promise<PromoterReferredUsersResult> {
  await ensureUserPromoterColumns();
  await ensureRedeemCodesCreatedByColumn();
  await ensureRedeemCodesIsPromoterColumn();

  const page = Math.max(Math.floor(options?.page ?? 1), 1);
  const pageSize = Math.min(
    Math.max(Math.floor(options?.pageSize ?? 20), 1),
    100,
  );
  const offset = (page - 1) * pageSize;

  const clauses = ["u.promoter_id = :promoterId"];
  const params: Record<string, string | number> = { promoterId };

  const q = options?.q?.trim();
  if (q) {
    params.qLike = `%${q}%`;
    const userId = Number(q);
    if (Number.isInteger(userId) && userId > 0) {
      params.qUserId = userId;
      clauses.push(
        `(u.username LIKE :qLike OR u.nickname LIKE :qLike OR u.id = :qUserId)`,
      );
    } else {
      clauses.push(`(u.username LIKE :qLike OR u.nickname LIKE :qLike)`);
    }
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;

  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<ReferredUserRow[]>(
    `SELECT
       u.id,
       u.username,
       u.nickname,
       u.vip_expires_at,
       u.diamonds,
       u.created_at,
       (
         SELECT rc.code
         FROM redeem_logs rl
         INNER JOIN redeem_codes rc ON rc.id = rl.code_id
         WHERE rl.user_id = u.id
           AND rc.created_by = :promoterId
           AND rc.is_promoter_code = 1
         ORDER BY rl.id ASC
         LIMIT 1
       ) AS redeem_code,
       (
         SELECT rl.created_at
         FROM redeem_logs rl
         INNER JOIN redeem_codes rc ON rc.id = rl.code_id
         WHERE rl.user_id = u.id
           AND rc.created_by = :promoterId
           AND rc.is_promoter_code = 1
         ORDER BY rl.id ASC
         LIMIT 1
       ) AS redeemed_at
     FROM users u
     ${whereSql}
     ORDER BY u.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  return {
    users: rows.map((row) => ({
      id: row.id,
      username: row.username,
      nickname: row.nickname,
      isVip: isVipActive(row.vip_expires_at),
      vipExpiresAt: toIso(row.vip_expires_at),
      diamonds: Number(row.diamonds ?? 0),
      createdAt: toIso(row.created_at),
      redeemCode: row.redeem_code,
      redeemedAt: toIso(row.redeemed_at),
    })),
    total,
    page,
    pageSize,
  };
}
