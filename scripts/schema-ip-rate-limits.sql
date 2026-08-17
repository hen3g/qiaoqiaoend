-- Per-IP API rate limits (1/min for register/email-send/avatar-upload;
-- 5/min for login/email-verify).
-- Table is also auto-created on first hit via ensureIpRateLimitTable().

CREATE TABLE IF NOT EXISTS ip_rate_limits (
  action VARCHAR(64) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  last_called_at BIGINT NOT NULL,
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (action, ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
