-- Promo video submissions (宣传有礼)
-- Run once against the app database.

CREATE TABLE IF NOT EXISTS promo_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  video_url VARCHAR(500) NOT NULL,
  likes_claimed INT UNSIGNED NULL,
  note VARCHAR(255) NULL,
  status ENUM('pending', 'rewarded', 'rejected') NOT NULL DEFAULT 'pending',
  months_granted INT UNSIGNED NOT NULL DEFAULT 0,
  admin_note VARCHAR(500) NULL,
  rewarded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_promo_user_id (user_id),
  KEY idx_promo_status (status),
  KEY idx_promo_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
