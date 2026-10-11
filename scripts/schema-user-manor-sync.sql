-- 仓鼠庄园 cloud sync: one gzip snapshot of manor state per (user, app).
-- Used by /api/manor-sync (GET pull / POST push). Login required (no VIP gate).
-- Wish quota lives in user_manor_wish (authoritative daily free/paid wishes).
-- App also auto-migrates via ensureUserManorSyncTable() in src/lib/user-schema.ts.
-- Rows are removed on account deletion (account-delete.ts PERSONAL_TABLES).

CREATE TABLE IF NOT EXISTS user_manor_sync (
  user_id BIGINT UNSIGNED NOT NULL,
  app_id VARCHAR(32) NOT NULL,
  schema_ver SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  rev INT UNSIGNED NOT NULL DEFAULT 0,
  blob_gz MEDIUMBLOB NULL,
  raw_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  gz_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  last_device_id VARCHAR(64) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_manor_wish (
  user_id BIGINT UNSIGNED NOT NULL,
  app_id VARCHAR(32) NOT NULL,
  wish_day DATE NOT NULL,
  wish_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
