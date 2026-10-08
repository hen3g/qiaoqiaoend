-- 仓鼠单词 cloud sync: one gzip snapshot of learning progress per (user, app).
-- Used by /api/learn-sync (GET pull / POST push+merge). Only logged-in users
-- with an active paid membership (is_paid_vip + paid_vip_expires_at > NOW()) may use it.
-- App also auto-migrates via ensureUserLearnSyncTable() in src/lib/user-schema.ts.
-- Rows are removed on account deletion (account-delete.ts PERSONAL_TABLES).
-- sync_enabled_at: first time the account switched cloud sync on (any device);
-- never cleared, so other devices can offer to sync right after login.
CREATE TABLE IF NOT EXISTS user_learn_sync (
  user_id BIGINT UNSIGNED NOT NULL,
  app_id VARCHAR(32) NOT NULL,
  schema_ver SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  rev INT UNSIGNED NOT NULL DEFAULT 0,
  blob_gz MEDIUMBLOB NULL,
  raw_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  gz_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  word_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_device_id VARCHAR(64) NULL,
  sync_enabled_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
