-- App 日活：未登录设备 + 登录用户（按 iOS / Android 分）
-- Tables are also auto-created on first hit via ensureDeviceVisitTables().

CREATE TABLE IF NOT EXISTS device_visit_daily_anonymous (
  stat_date DATE NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stat_date, device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_visit_daily_users (
  stat_date DATE NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  platform VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stat_date, user_id),
  KEY idx_device_visit_user (user_id),
  KEY idx_device_visit_platform (stat_date, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
