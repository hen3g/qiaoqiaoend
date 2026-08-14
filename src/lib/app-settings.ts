import type { RowDataPacket } from "mysql2";

import { execute, query } from "@/lib/db";

type SettingRow = RowDataPacket & {
  setting_value: string;
  updated_at: Date | string | null;
};

export type AppSetting = {
  value: string;
  updatedAt: string | null;
};

let tableEnsured = false;

export async function ensureAppSettingsTable(): Promise<void> {
  if (tableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(64) NOT NULL,
      setting_value VARCHAR(255) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export async function getAppSetting(key: string): Promise<AppSetting | null> {
  await ensureAppSettingsTable();
  const rows = await query<SettingRow[]>(
    `SELECT setting_value, updated_at
     FROM app_settings
     WHERE setting_key = :key
     LIMIT 1`,
    { key },
  );
  const row = rows[0];
  if (!row) return null;
  return { value: row.setting_value, updatedAt: toIso(row.updated_at) };
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await ensureAppSettingsTable();
  await execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (:key, :value)
     ON DUPLICATE KEY UPDATE setting_value = :value`,
    { key, value },
  );
}
