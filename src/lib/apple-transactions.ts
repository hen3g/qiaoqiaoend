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
};

let tableEnsured = false;

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
  };
}

export async function getAppleTransaction(
  transactionId: string,
): Promise<AppleTransactionRow | null> {
  await ensureAppleTransactionsTable();
  const rows = await query<Row[]>(
    `SELECT transaction_id, original_transaction_id, user_id, product_id, kind,
            grant_id, environment, diamonds_granted
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
            grant_id, environment, diamonds_granted
     FROM apple_transactions
     WHERE original_transaction_id = :originalTransactionId
     ORDER BY created_at ASC
     LIMIT 1`,
    { originalTransactionId },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertAppleTransaction(
  row: AppleTransactionRow,
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
