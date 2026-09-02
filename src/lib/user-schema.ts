import type { RowDataPacket } from "mysql2";
import type { ClientAppId } from "@/lib/client-app";
import { execute, query } from "@/lib/db";

let diamondsEnsured = false;
let shareCustomCoursesEnsured = false;
let promoterColumnsEnsured = false;
let emailEnsured = false;
let passwordResetCodesEnsured = false;
let appColumnsEnsured = false;

/** Ensure users.diamonds exists (safe to call repeatedly). */
export async function ensureUserDiamondsColumn(): Promise<void> {
  if (diamondsEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'diamonds'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN diamonds INT UNSIGNED NOT NULL DEFAULT 0 AFTER vip_expires_at`,
    );
  }
  diamondsEnsured = true;
}

/** Ensure users.share_custom_courses exists (default: share on). */
export async function ensureShareCustomCoursesColumn(): Promise<void> {
  if (shareCustomCoursesEnsured) return;
  type ColRow = RowDataPacket & { Field: string };
  const cols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'share_custom_courses'`,
  );
  if (cols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN share_custom_courses TINYINT(1) NOT NULL DEFAULT 1
       AFTER diamonds`,
    );
  }
  shareCustomCoursesEnsured = true;
}

/** Ensure users.is_promoter + users.promoter_id exist. */
export async function ensureUserPromoterColumns(): Promise<void> {
  if (promoterColumnsEnsured) return;
  type ColRow = RowDataPacket & { Field: string };

  const isPromoterCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'is_promoter'`,
  );
  if (isPromoterCols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN is_promoter TINYINT(1) NOT NULL DEFAULT 0
       AFTER share_custom_courses`,
    );
  }

  const promoterIdCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'promoter_id'`,
  );
  if (promoterIdCols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN promoter_id BIGINT UNSIGNED NULL AFTER is_promoter,
       ADD KEY idx_users_promoter_id (promoter_id)`,
    );
  }

  promoterColumnsEnsured = true;
}

/** Ensure users.email + email_bind_codes exist. */
export async function ensureUserEmailColumn(): Promise<void> {
  if (emailEnsured) return;
  type ColRow = RowDataPacket & { Field: string };

  const emailCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'email'`,
  );
  if (emailCols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN email VARCHAR(255) NULL AFTER nickname`,
    );
  }

  type IndexRow = RowDataPacket & { Key_name: string };
  const indexes = await query<IndexRow[]>(`SHOW INDEX FROM users`);
  if (!indexes.some((row) => row.Key_name === "uk_users_email")) {
    await execute(`ALTER TABLE users ADD UNIQUE KEY uk_users_email (email)`);
  }

  const tables = await query<RowDataPacket[]>(
    `SHOW TABLES LIKE 'email_bind_codes'`,
  );
  if (tables.length === 0) {
    await execute(
      `CREATE TABLE email_bind_codes (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         user_id BIGINT UNSIGNED NOT NULL,
         email VARCHAR(255) NOT NULL,
         code CHAR(6) NOT NULL,
         expires_at DATETIME NOT NULL,
         attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_email_bind_codes_user_id (user_id),
         KEY idx_email_bind_codes_email (email),
         KEY idx_email_bind_codes_expires_at (expires_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
  }

  emailEnsured = true;
}

/** Ensure password_reset_codes exists for forgot-password OTP. */
export async function ensurePasswordResetCodesTable(): Promise<void> {
  if (passwordResetCodesEnsured) return;

  const tables = await query<RowDataPacket[]>(
    `SHOW TABLES LIKE 'password_reset_codes'`,
  );
  if (tables.length === 0) {
    await execute(
      `CREATE TABLE password_reset_codes (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         user_id BIGINT UNSIGNED NOT NULL,
         email VARCHAR(255) NOT NULL,
         code CHAR(6) NOT NULL,
         expires_at DATETIME NOT NULL,
         attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_password_reset_codes_user_id (user_id),
         KEY idx_password_reset_codes_email (email),
         KEY idx_password_reset_codes_expires_at (expires_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
  }

  passwordResetCodesEnsured = true;
}

/** Which app registered the account, and which app was last used. */
export async function ensureUserAppColumns(): Promise<void> {
  if (appColumnsEnsured) return;
  type ColRow = RowDataPacket & { Field: string };

  const registerCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'register_app_id'`,
  );
  if (registerCols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN register_app_id VARCHAR(32) NOT NULL DEFAULT 'qiaoqiao'
       AFTER promoter_id`,
    );
  }

  const lastCols = await query<ColRow[]>(
    `SHOW COLUMNS FROM users LIKE 'last_app_id'`,
  );
  if (lastCols.length === 0) {
    await execute(
      `ALTER TABLE users
       ADD COLUMN last_app_id VARCHAR(32) NULL AFTER register_app_id`,
    );
  }

  type IndexRow = RowDataPacket & { Key_name: string };
  const indexes = await query<IndexRow[]>(`SHOW INDEX FROM users`);
  if (!indexes.some((row) => row.Key_name === "idx_users_register_app_id")) {
    await execute(
      `ALTER TABLE users ADD KEY idx_users_register_app_id (register_app_id)`,
    );
  }

  appColumnsEnsured = true;
}

export async function touchUserLastApp(
  userId: number,
  appId: ClientAppId,
): Promise<void> {
  await ensureUserAppColumns();
  await execute(
    `UPDATE users
     SET last_app_id = :appId
     WHERE id = :userId AND (last_app_id IS NULL OR last_app_id <> :sameAppId)
     LIMIT 1`,
    { appId, sameAppId: appId, userId },
  );
}
