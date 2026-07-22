import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";
import {
  ensureRedeemCodesCreatedByColumn,
  generateCodeString,
  vipLabel,
} from "@/lib/redeem";

export const GIFT_VIP_DAYS = 180;
export const GIFT_CODES_PAGE_SIZE = 10;

/** YYYY-MM-DD in Asia/Shanghai (matches DB timezone +08:00). */
function todayInShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type GiftCodeRow = RowDataPacket & {
  id: number;
  code: string;
  value: string | null;
  max_uses: number;
  used_count: number;
  created_at: Date | string | null;
  redeemed_username: string | null;
  redeemed_nickname: string | null;
};

export type GiftCodeDto = {
  id: number;
  code: string;
  label: string;
  available: boolean;
  redeemedUserName: string | null;
  createdAt: string | null;
};

export type GiftCodesPage = {
  codes: GiftCodeDto[];
  total: number;
  page: number;
  pageSize: number;
  canGenerateToday: boolean;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function displayName(
  nickname: string | null | undefined,
  username: string | null | undefined,
): string | null {
  const name = (nickname || username || "").trim();
  return name || null;
}

function mapGiftCode(row: GiftCodeRow): GiftCodeDto {
  return {
    id: row.id,
    code: row.code,
    label: vipLabel(row.value),
    available: row.used_count < row.max_uses,
    redeemedUserName: displayName(row.redeemed_nickname, row.redeemed_username),
    createdAt: toIso(row.created_at),
  };
}

async function countGeneratedToday(userId: number): Promise<number> {
  const today = todayInShanghai();
  const rows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c
     FROM redeem_codes
     WHERE created_by = :userId
       AND DATE(created_at) = :today`,
    { userId, today },
  );
  return Number(rows[0]?.c ?? 0);
}

export async function listGiftCodesForUser(
  userId: number,
  page: number,
): Promise<GiftCodesPage> {
  await ensureRedeemCodesCreatedByColumn();

  const pageSize = GIFT_CODES_PAGE_SIZE;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * pageSize;

  const countRows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c FROM redeem_codes WHERE created_by = :userId`,
    { userId },
  );
  const total = Number(countRows[0]?.c ?? 0);

  const rows = await query<GiftCodeRow[]>(
    `SELECT rc.id, rc.code, rc.value, rc.max_uses, rc.used_count, rc.created_at,
            u.username AS redeemed_username, u.nickname AS redeemed_nickname
     FROM redeem_codes rc
     LEFT JOIN redeem_logs rl
       ON rl.code_id = rc.id
      AND rl.id = (SELECT MIN(id) FROM redeem_logs WHERE code_id = rc.id)
     LEFT JOIN users u ON u.id = rl.user_id
     WHERE rc.created_by = :userId
     ORDER BY rc.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    { userId },
  );

  const canGenerateToday = (await countGeneratedToday(userId)) === 0;

  return {
    codes: rows.map(mapGiftCode),
    total,
    page: safePage,
    pageSize,
    canGenerateToday,
  };
}

export async function createDailyGiftCode(
  userId: number,
): Promise<GiftCodeDto> {
  await ensureRedeemCodesCreatedByColumn();

  if ((await countGeneratedToday(userId)) > 0) {
    throw new Error("今天已经生成过激活码，请明天再来");
  }

  const value = String(GIFT_VIP_DAYS);
  let code = generateCodeString();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await execute(
        `INSERT INTO redeem_codes
           (code, type, value, max_uses, used_count, expires_at, created_by)
         VALUES
           (:code, 'vip_days', :value, 1, 0, NULL, :userId)`,
        { code, value, userId },
      );
      return {
        id: Number(result.insertId),
        code,
        label: vipLabel(value),
        available: true,
        redeemedUserName: null,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
        code = generateCodeString();
        continue;
      }
      throw err;
    }
  }

  throw new Error("生成激活码失败，请重试");
}
