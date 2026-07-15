-- Notification API usage stats (日活估算：请求量 + 登录用户去重)
-- Run once against the app database. Tables are also auto-created on first hit.
-- source: client = 桌面/原生客户端；web = 在线版

CREATE TABLE IF NOT EXISTS notification_api_daily_stats (
  stat_date DATE NOT NULL,
  total_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
  logged_in_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_api_daily_users (
  stat_date DATE NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'client',
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (stat_date, user_id, source),
  KEY idx_notif_api_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 若已有旧表（无 source 列），可手动执行：
-- ALTER TABLE notification_api_daily_users
--   ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'client' AFTER user_id;
-- ALTER TABLE notification_api_daily_users
--   DROP PRIMARY KEY,
--   ADD PRIMARY KEY (stat_date, user_id, source);
