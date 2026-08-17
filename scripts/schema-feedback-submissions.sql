-- Feedback / cooperation submissions (app + Bark notify)
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type ENUM('problem', 'promo') NOT NULL,
  wechat VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  admin_reply TEXT NULL,
  replied_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_feedback_created (created_at),
  KEY idx_feedback_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
