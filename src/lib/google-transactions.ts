import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";

export type GoogleTxKind = "vip" | "diamonds";

export type GoogleTransactionRow = {
  purchaseToken: string;
  orderId: string;
  userId: number;
  productId: string;
  kind: GoogleTxKind;
  grantId: string;
  environment: string;
  diamondsGranted: number;
};

type Row = RowDataPacket & {
  purchase_token: string;
  order_id: string;
  user_id: number;
  product_id: string;
  kind: GoogleTxKind;
  grant_id: string;
  environment: string;
  diamonds_granted: number;
};

let tableEnsured = false;

export async function ensureGoogleTransactionsTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS google_transactions (
      purchase_token VARCHAR(768) NOT NULL,
      order_id VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      product_id VARCHAR(128) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      grant_id VARCHAR(16) NOT NULL,
      environment VARCHAR(16) NOT NULL,
      diamonds_granted INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (purchase_token),
      KEY idx_google_tx_order (order_id),
      KEY idx_google_tx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
}

function mapRow(row: Row): GoogleTransactionRow {
  return {
    purchaseToken: row.purchase_token,
    orderId: row.order_id,
    userId: Number(row.user_id),
    productId: row.product_id,
    kind: row.kind,
    grantId: row.grant_id,
    environment: row.environment,
    diamondsGranted: Number(row.diamonds_granted ?? 0),
  };
}

export async function getGoogleTransaction(
  purchaseToken: string,
): Promise<GoogleTransactionRow | null> {
  await ensureGoogleTransactionsTable();
  const rows = await query<Row[]>(
    `SELECT purchase_token, order_id, user_id, product_id, kind, grant_id,
            environment, diamonds_granted
     FROM google_transactions
     WHERE purchase_token = :purchaseToken
     LIMIT 1`,
    { purchaseToken },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertGoogleTransaction(
  row: GoogleTransactionRow,
): Promise<boolean> {
  await ensureGoogleTransactionsTable();
  const result = await execute(
    `INSERT IGNORE INTO google_transactions
       (purchase_token, order_id, user_id, product_id, kind, grant_id,
        environment, diamonds_granted)
     VALUES
       (:purchaseToken, :orderId, :userId, :productId, :kind, :grantId,
        :environment, :diamondsGranted)`,
    {
      purchaseToken: row.purchaseToken,
      orderId: row.orderId,
      userId: row.userId,
      productId: row.productId,
      kind: row.kind,
      grantId: row.grantId,
      environment: row.environment,
      diamondsGranted: row.diamondsGranted,
    },
  );
  return (result.affectedRows ?? 0) > 0;
}

export async function listUserGoogleVipRows(userId: number): Promise<
  {
    purchaseToken: string;
    productId: string;
    grantId: string;
    createdAt: Date | string;
  }[]
> {
  await ensureGoogleTransactionsTable();
  type ListRow = RowDataPacket & {
    purchase_token: string;
    product_id: string;
    grant_id: string;
    created_at: Date | string;
  };
  const rows = await query<ListRow[]>(
    `SELECT purchase_token, product_id, grant_id, created_at
     FROM google_transactions
     WHERE user_id = :userId
       AND kind = 'vip'
     ORDER BY created_at DESC
     LIMIT 100`,
    { userId },
  );
  return rows.map((row) => ({
    purchaseToken: row.purchase_token,
    productId: row.product_id,
    grantId: row.grant_id,
    createdAt: row.created_at,
  }));
}
