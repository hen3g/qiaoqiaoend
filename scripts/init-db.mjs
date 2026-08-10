/**
 * Apply scripts/init-db.sql to DATABASE_* from .env.local
 *
 * Usage:
 *   node --env-file=.env.local scripts/init-db.mjs
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "init-db.sql");

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
  multipleStatements: true,
  timezone: "+08:00",
});

try {
  const sql = readFileSync(sqlPath, "utf8");
  await conn.query(sql);

  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME`,
    [database],
  );

  console.log(`OK — ${tables.length} tables in \`${database}\`:`);
  for (const row of tables) {
    console.log(`  - ${row.name}`);
  }
} finally {
  await conn.end();
}
