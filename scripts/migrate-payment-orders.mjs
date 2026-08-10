/**
 * Create payment_orders table for Alipay VIP checkout.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-payment-orders.mjs
 */

import mysql from "mysql2/promise";

const required = [
  "DATABASE_HOST",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",
];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

const host = process.env.DATABASE_HOST;
const port = Number(process.env.DATABASE_PORT || 3306);
const user = process.env.DATABASE_USER;
const password = process.env.DATABASE_PASSWORD;
const database = process.env.DATABASE_NAME;

console.log(`Connecting ${user}@${host}:${port}/${database} …`);

const conn = await mysql.createConnection({
  host,
  port,
  user,
  password,
  database,
  timezone: "+08:00",
});

try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      out_trade_no VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      plan_id VARCHAR(16) NOT NULL,
      amount_fen INT UNSIGNED NOT NULL,
      status ENUM('pending', 'paid', 'closed') NOT NULL DEFAULT 'pending',
      alipay_trade_no VARCHAR(64) NULL,
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_payment_orders_out_trade_no (out_trade_no),
      KEY idx_payment_orders_user_id (user_id),
      KEY idx_payment_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("OK — payment_orders ready");
} finally {
  await conn.end();
}
