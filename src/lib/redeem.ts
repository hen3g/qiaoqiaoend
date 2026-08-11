import { randomBytes } from "crypto";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  extendVip,
  setPermanentVip,
  unlockAllCoursesForUser,
  unlockCourseForUser,
} from "@/lib/courses";

export const PERMANENT_VIP_VALUE = "permanent";

/** Promoter codes can only be redeemed within this window after registration. */
export const PROMOTER_CODE_MAX_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;

type RedeemCodeRow = RowDataPacket & {
  id: number;
  code: string;
  type: "vip_days" | "course" | "unlock_all";
  value: string | null;
  max_uses: number;
  used_count: number;
  expires_at: Date | string | null;
  created_at?: Date | string;
  created_by?: number | null;
  is_promoter_code?: number | boolean | null;
  creator_username?: string | null;
  creator_nickname?: string | null;
};

export type RedeemResult = {
  message: string;
  type: RedeemCodeRow["type"];
};

export type RedeemCodeDto = {
  id: number;
  code: string;
  type: RedeemCodeRow["type"];
  value: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string | null;
  label: string;
  /** Permanent-member gift codes set this; admin-created codes are null. */
  createdBy: number | null;
  isUserGenerated: boolean;
  createdByName: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function creatorDisplayName(
  nickname: string | null | undefined,
  username: string | null | undefined,
): string | null {
  const name = (nickname || username || "").trim();
  return name || null;
}

export function vipLabel(value: string | null): string {
  if (value === PERMANENT_VIP_VALUE) return "永久会员";
  const days = Number(value || 0);
  return days > 0 ? `会员 ${days} 天` : "会员";
}

export function mapRedeemCode(row: RedeemCodeRow): RedeemCodeDto {
  let label = row.code;
  if (row.type === "vip_days") label = vipLabel(row.value);
  else if (row.type === "course") label = `课程 #${row.value}`;
  else if (row.type === "unlock_all") label = "解锁全部课程";

  const createdBy =
    row.created_by == null || Number(row.created_by) < 1
      ? null
      : Number(row.created_by);

  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at),
    label,
    createdBy,
    isUserGenerated: createdBy != null,
    createdByName: creatorDisplayName(
      row.creator_nickname,
      row.creator_username,
    ),
  };
}

let createdByEnsured = false;
let isPromoterCodeEnsured = false;

export async function ensureRedeemCodesCreatedByColumn(): Promise<void> {
  if (createdByEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM redeem_codes LIKE 'created_by'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE redeem_codes
       ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER expires_at,
       ADD KEY idx_redeem_codes_created_by (created_by)`,
    );
  }
  createdByEnsured = true;
}

export async function ensureRedeemCodesIsPromoterColumn(): Promise<void> {
  if (isPromoterCodeEnsured) return;
  await ensureRedeemCodesCreatedByColumn();
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM redeem_codes LIKE 'is_promoter_code'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE redeem_codes
       ADD COLUMN is_promoter_code TINYINT(1) NOT NULL DEFAULT 0 AFTER created_by,
       ADD KEY idx_redeem_codes_is_promoter (is_promoter_code)`,
    );
  }
  isPromoterCodeEnsured = true;
}

/** 128-bit entropy; format fits redeem_codes.code varchar(64). */
export function generateCodeString(): string {
  const raw = randomBytes(16).toString("hex").toUpperCase();
  const parts = raw.match(/.{1,8}/g) ?? [raw];
  return `BE-${parts.join("-")}`;
}

export async function redeemCode(
  userId: number,
  rawCode: string,
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new Error("请输入兑换码");
  }

  await ensureRedeemCodesCreatedByColumn();
  await ensureRedeemCodesIsPromoterColumn();

  const rows = await query<RedeemCodeRow[]>(
    `SELECT id, code, type, value, max_uses, used_count, expires_at,
            created_by, is_promoter_code
     FROM redeem_codes WHERE code = :code LIMIT 1`,
    { code },
  );
  const row = rows[0];
  if (!row) {
    throw new Error("兑换码无效");
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("兑换码已过期");
  }
  if (row.used_count >= row.max_uses) {
    throw new Error("兑换码已达使用上限");
  }

  const used = await query<RowDataPacket[]>(
    `SELECT id FROM redeem_logs WHERE user_id = :userId AND code_id = :codeId LIMIT 1`,
    { userId, codeId: row.id },
  );
  if (used[0]) {
    throw new Error("你已经兑换过该兑换码");
  }

  if (Boolean(row.is_promoter_code)) {
    const userRows = await query<
      (RowDataPacket & { created_at: Date | string | null })[]
    >(`SELECT created_at FROM users WHERE id = :userId LIMIT 1`, { userId });
    const createdAt = userRows[0]?.created_at;
    if (!createdAt) {
      throw new Error("用户不存在");
    }
    const createdMs =
      createdAt instanceof Date
        ? createdAt.getTime()
        : new Date(createdAt).getTime();
    if (
      Number.isNaN(createdMs) ||
      Date.now() - createdMs > PROMOTER_CODE_MAX_ACCOUNT_AGE_MS
    ) {
      throw new Error("只有新用户可以使用此兑换码");
    }
  }

  let message = "兑换成功";
  if (row.type === "vip_days") {
    if (row.value === PERMANENT_VIP_VALUE) {
      await setPermanentVip(userId);
      message = "兑换成功，已开通永久会员";
    } else {
      const days = Number(row.value || 0);
      if (!days || days < 1) throw new Error("兑换码配置错误");
      await extendVip(userId, days);
      message = `兑换成功，会员已延长 ${days} 天`;
    }
  } else if (row.type === "course") {
    const courseId = Number(row.value || 0);
    if (!courseId) throw new Error("兑换码配置错误");
    await unlockCourseForUser(userId, courseId);
    message = "兑换成功，课程已解锁";
  } else if (row.type === "unlock_all") {
    await unlockAllCoursesForUser(userId);
    message = "兑换成功，全部课程已解锁";
  }

  await execute(
    `INSERT INTO redeem_logs (user_id, code_id, note) VALUES (:userId, :codeId, :note)`,
    { userId, codeId: row.id, note: message },
  );
  await execute(
    `UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = :id`,
    { id: row.id },
  );

  const promoterId =
    row.created_by == null || Number(row.created_by) < 1
      ? null
      : Number(row.created_by);
  if (promoterId && Boolean(row.is_promoter_code)) {
    const { bindUserToPromoter } = await import("@/lib/promoter");
    await bindUserToPromoter(userId, promoterId);
  }

  return { message, type: row.type };
}

export type CreateVipCodesInput = {
  permanent: boolean;
  days?: number;
  maxUses: number;
  quantity: number;
  expiresAt?: string | null;
};

export async function createVipRedeemCodes(
  input: CreateVipCodesInput,
): Promise<RedeemCodeDto[]> {
  const { permanent, maxUses, quantity } = input;
  if (!permanent) {
    const days = Number(input.days || 0);
    if (!Number.isInteger(days) || days < 1) {
      throw new Error("请填写有效的会员天数");
    }
  }
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
    throw new Error("使用次数需在 1–10000 之间");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    throw new Error("一次最多生成 50 个兑换码");
  }

  const value = permanent ? PERMANENT_VIP_VALUE : String(input.days);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("兑换码过期时间无效");
  }

  const created: RedeemCodeDto[] = [];
  for (let i = 0; i < quantity; i++) {
    let code = generateCodeString();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await execute(
          `INSERT INTO redeem_codes (code, type, value, max_uses, used_count, expires_at)
           VALUES (:code, 'vip_days', :value, :maxUses, 0, :expiresAt)`,
          {
            code,
            value,
            maxUses,
            expiresAt,
          },
        );
        created.push({
          id: Number(result.insertId),
          code,
          type: "vip_days",
          value,
          maxUses,
          usedCount: 0,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          createdAt: new Date().toISOString(),
          label: vipLabel(value),
          createdBy: null,
          isUserGenerated: false,
          createdByName: null,
        });
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
          code = generateCodeString();
          continue;
        }
        throw err;
      }
    }
  }

  if (created.length !== quantity) {
    throw new Error("生成兑换码失败，请重试");
  }
  return created;
}

export async function listRedeemCodes(): Promise<RedeemCodeDto[]> {
  await ensureRedeemCodesCreatedByColumn();
  const rows = await query<RedeemCodeRow[]>(
    `SELECT rc.id, rc.code, rc.type, rc.value, rc.max_uses, rc.used_count,
            rc.expires_at, rc.created_at, rc.created_by,
            u.username AS creator_username, u.nickname AS creator_nickname
     FROM redeem_codes rc
     LEFT JOIN users u ON u.id = rc.created_by
     ORDER BY rc.id DESC`,
  );
  return rows.map(mapRedeemCode);
}

export async function deleteRedeemCode(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("兑换码 ID 无效");
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM redeem_codes WHERE id = :id LIMIT 1`,
    { id },
  );
  if (!rows[0]) {
    throw new Error("兑换码不存在");
  }
  await execute(`DELETE FROM redeem_logs WHERE code_id = :id`, { id });
  await execute(`DELETE FROM redeem_codes WHERE id = :id`, { id });
}

export async function deleteRedeemCodes(ids: number[]): Promise<number> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) {
    throw new Error("请选择要删除的兑换码");
  }
  if (unique.length > 200) {
    throw new Error("一次最多删除 200 个兑换码");
  }
  let deleted = 0;
  for (const id of unique) {
    const rows = await query<RowDataPacket[]>(
      `SELECT id FROM redeem_codes WHERE id = :id LIMIT 1`,
      { id },
    );
    if (!rows[0]) continue;
    await execute(`DELETE FROM redeem_logs WHERE code_id = :id`, { id });
    await execute(`DELETE FROM redeem_codes WHERE id = :id`, { id });
    deleted += 1;
  }
  if (deleted === 0) {
    throw new Error("未找到可删除的兑换码");
  }
  return deleted;
}
