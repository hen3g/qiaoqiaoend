-- Notification API usage stats (日活估算：请求量 + 登录用户去重)
-- Run once against the app database. Tables are also auto-created on first hit.

CREATE TABLE IF NOT EXISTS notification_api_daily_stats (
  stat_date DATE NOT NULL,
  total_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
  logged_in_hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_api_daily_users (
  stat_date DATE NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (stat_date, user_id),
  KEY idx_notif_api_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
