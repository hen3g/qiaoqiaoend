import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";

export type AppleTxKind = "vip" | "diamonds";

export type AppleTransactionRow = {
  transactionId: string;
  originalTransactionId: string;
  userId: number;
  productId: string;
  kind: AppleTxKind;
  grantId: string;
  environment: string;
  diamondsGranted: number;
  diamondsRefunded: number;
};

type Row = RowDataPacket & {
  transaction_id: string;
  original_transaction_id: string;
  user_id: number;
  product_id: string;
  kind: AppleTxKind;
  grant_id: string;
  environment: string;
  diamonds_granted: number;
  diamonds_refunded?: number;
};

let tableEnsured = false;
let refundColumnEnsured = false;

export async function ensureAppleTransactionsTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS apple_transactions (
      transaction_id VARCHAR(64) NOT NULL,
      original_transaction_id VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      product_id VARCHAR(128) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      grant_id VARCHAR(16) NOT NULL,
      environment VARCHAR(16) NOT NULL,
      diamonds_granted INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (transaction_id),
      KEY idx_apple_tx_original (original_transaction_id),
      KEY idx_apple_tx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
  await ensureAppleDiamondsRefundedColumn();
}

async function ensureAppleDiamondsRefundedColumn(): Promise<void> {
  if (refundColumnEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM apple_transactions LIKE 'diamonds_refunded'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE apple_transactions
       ADD COLUMN diamonds_refunded INT NOT NULL DEFAULT 0 AFTER diamonds_granted`,
    );
  }
  refundColumnEnsured = true;
}

function mapRow(row: Row): AppleTransactionRow {
  return {
    transactionId: row.transaction_id,
    originalTransactionId: row.original_transaction_id,
    userId: Number(row.user_id),
    productId: row.product_id,
    kind: row.kind,
    grantId: row.grant_id,
    environment: row.environment,
    diamondsGranted: Number(row.diamonds_granted ?? 0),
    diamondsRefunded: Number(row.diamonds_refunded ?? 0),
  };
}

export async function getAppleTransaction(
  transactionId: string,
): Promise<AppleTransactionRow | null> {
  await ensureAppleTransactionsTable();
  const rows = await query<Row[]>(
    `SELECT transaction_id, original_transaction_id, user_id, product_id, kind,
            grant_id, environment, diamonds_granted, diamonds_refunded
     FROM apple_transactions WHERE transaction_id = :transactionId LIMIT 1`,
    { transactionId },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAppleOriginalOwner(
  originalTransactionId: string,
): Promise<AppleTransactionRow | null> {
  await ensureAppleTransactionsTable();
  const rows = await query<Row[]>(
    `SELECT transaction_id, original_transaction_id, user_id, product_id, kind,
            grant_id, environment, diamonds_granted, diamonds_refunded
     FROM apple_transactions
     WHERE original_transaction_id = :originalTransactionId
     ORDER BY created_at ASC
     LIMIT 1`,
    { originalTransactionId },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertAppleTransaction(
  row: Omit<AppleTransactionRow, "diamondsRefunded">,
): Promise<boolean> {
  await ensureAppleTransactionsTable();
  const result = await execute(
    `INSERT IGNORE INTO apple_transactions
       (transaction_id, original_transaction_id, user_id, product_id, kind,
        grant_id, environment, diamonds_granted)
     VALUES
       (:transactionId, :originalTransactionId, :userId, :productId, :kind,
        :grantId, :environment, :diamondsGranted)`,
    row,
  );
  return (result.affectedRows ?? 0) > 0;
}

/** Mark this tx's gifted diamonds as refunded. Returns the amount if this caller won the race. */
export async function claimAppleDiamondRefund(
  transactionId: string,
): Promise<{ userId: number; amount: number } | null> {
  await ensureAppleTransactionsTable();
  const result = await execute(
    `UPDATE apple_transactions
     SET diamonds_refunded = diamonds_granted
     WHERE transaction_id = :transactionId
       AND diamonds_granted > 0
       AND diamonds_refunded = 0`,
    { transactionId },
  );
  if ((result.affectedRows ?? 0) === 0) return null;
  const row = await getAppleTransaction(transactionId);
  if (!row) return null;
  return { userId: row.userId, amount: row.diamondsGranted };
}
