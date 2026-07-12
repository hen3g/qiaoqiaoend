-- Course categories + course package columns
-- Applied automatically by scripts/sync-courses.mjs; kept here for reference.

CREATE TABLE IF NOT EXISTS course_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(64) NOT NULL,
  title VARCHAR(128) NOT NULL,
  subtitle VARCHAR(255) NULL,
  description TEXT NULL,
  accent_color VARCHAR(32) NULL,
  tint_color VARCHAR(32) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_course_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alter courses (idempotent in sync script):
-- ALTER TABLE courses ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER id;
-- ALTER TABLE courses ADD COLUMN difficulty TINYINT NULL AFTER level;
-- ALTER TABLE courses ADD COLUMN r2_key VARCHAR(255) NULL AFTER download_url;
-- ALTER TABLE courses ADD INDEX idx_courses_category_id (category_id);
