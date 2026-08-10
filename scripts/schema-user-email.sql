-- Bound email + one-time codes for email verification
ALTER TABLE users
  ADD COLUMN email VARCHAR(255) NULL AFTER nickname,
  ADD UNIQUE KEY uk_users_email (email);

CREATE TABLE IF NOT EXISTS email_bind_codes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
