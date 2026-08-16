import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";

export const DIAMOND_TX_PAGE_SIZE = 20;
export const DIAMOND_TX_LOOKBACK_DAYS = 30;

export type DiamondTxType =
  | "ai_generate_course"
  | "ai_suggest_words"
  | "vip_purchase"
  | "diamond_purchase"
  | "apple_refund"
  | "admin_adjust";

export type DiamondTransactionDto = {
  id: number;
  amount: number;
  balanceAfter: number;
  type: string;
  title: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type DiamondTransactionsPage = {
  records: DiamondTransactionDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

let tableEnsured = false;

/** Ensure diamond_transactions exists (safe to call repeatedly). */
export async function ensureDiamondTransactionsTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS diamond_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      amount INT NOT NULL,
      balance_after INT UNSIGNED NOT NULL,
      type VARCHAR(32) NOT NULL,
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dt_user_created (user_id, created_at),
      KEY idx_dt_user_amount_created (user_id, amount, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableEnsured = true;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseMeta(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function diamondTxTitle(type: string): string {
  switch (type) {
    case "ai_generate_course":
      return "生成课程";
    case "ai_suggest_words":
      return "推荐单词";
    case "vip_purchase":
      return "会员赠送";
    case "diamond_purchase":
      return "充值钻石";
    case "apple_refund":
      return "Apple 退款收回";
    case "admin_adjust":
      return "系统调整";
    default:
      return "钻石变动";
  }
}

export async function insertDiamondTransaction(input: {
  userId: number;
  amount: number;
  balanceAfter: number;
  type: DiamondTxType | string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  if (!Number.isFinite(input.amount) || input.amount === 0) return;
  await ensureDiamondTransactionsTable();
  const metaJson =
    input.meta && Object.keys(input.meta).length > 0
      ? JSON.stringify(input.meta)
      : null;
  await execute(
    `INSERT INTO diamond_transactions
       (user_id, amount, balance_after, type, meta)
     VALUES
       (:userId, :amount, :balanceAfter, :type, :meta)`,
    {
      userId: input.userId,
      amount: Math.trunc(input.amount),
      balanceAfter: Math.max(0, Math.trunc(input.balanceAfter)),
      type: String(input.type).slice(0, 32),
      meta: metaJson,
    },
  );
}

/**
 * Last 30 days of diamond transactions (spend + grant), newest first.
 * Fixed page size 20.
 */
export async function listDiamondTransactions(
  userId: number,
  page: number,
): Promise<DiamondTransactionsPage> {
  await ensureDiamondTransactionsTable();

  const pageSize = DIAMOND_TX_PAGE_SIZE;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * pageSize;

  const countRows = await query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c
     FROM diamond_transactions
     WHERE user_id = :userId
       AND created_at >= DATE_SUB(NOW(), INTERVAL ${DIAMOND_TX_LOOKBACK_DAYS} DAY)`,
    { userId },
  );
  const total = Number(countRows[0]?.c ?? 0);

  type TxRow = RowDataPacket & {
    id: number;
    amount: number;
    balance_after: number;
    type: string;
    meta: unknown;
    created_at: Date | string;
  };

  const rows = await query<TxRow[]>(
    `SELECT id, amount, balance_after, type, meta, created_at
     FROM diamond_transactions
     WHERE user_id = :userId
       AND created_at >= DATE_SUB(NOW(), INTERVAL ${DIAMOND_TX_LOOKBACK_DAYS} DAY)
     ORDER BY id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    { userId },
  );

  const records: DiamondTransactionDto[] = rows.map((row) => ({
    id: Number(row.id),
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    type: String(row.type),
    title: diamondTxTitle(String(row.type)),
    meta: parseMeta(row.meta),
    createdAt: toIso(row.created_at),
  }));

  return {
    records,
    total,
    page: safePage,
    pageSize,
    hasMore: safePage * pageSize < total,
  };
}
