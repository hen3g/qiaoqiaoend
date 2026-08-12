-- Challenge star ranking: denormalized total + daily gains.
-- Also auto-migrated via ensureStarRankingSchema() in ranking-db.ts.

ALTER TABLE user_skill_progress
  ADD COLUMN total_stars INT UNSIGNED NOT NULL DEFAULT 0 AFTER last_pack_id;

ALTER TABLE user_skill_progress
  ADD KEY idx_usp_total_stars (total_stars DESC, user_id);

CREATE TABLE IF NOT EXISTS user_daily_star_gains (
  user_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  stars_gained INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, stat_date),
  KEY idx_daily_stars_date_gained (stat_date, stars_gained DESC, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
