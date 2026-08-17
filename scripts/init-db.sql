-- qiaoqiaoend / babyenglishend — full MySQL schema for a fresh database
-- Charset: utf8mb4; app pool timezone: +08:00
-- Apply with: npm run db:init

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  nickname VARCHAR(32) NULL,
  email VARCHAR(255) NULL,
  avatar_url VARCHAR(500) NULL,
  vip_expires_at DATETIME NULL,
  diamonds INT UNSIGNED NOT NULL DEFAULT 0,
  share_custom_courses TINYINT(1) NOT NULL DEFAULT 1,
  is_promoter TINYINT(1) NOT NULL DEFAULT 0,
  promoter_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_nickname (nickname),
  KEY idx_users_promoter_id (promoter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  code CHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_reset_codes_user_id (user_id),
  KEY idx_password_reset_codes_email (email),
  KEY idx_password_reset_codes_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NULL,
  slug VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  level VARCHAR(32) NULL,
  difficulty TINYINT NULL,
  word_count INT NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 0,
  download_url VARCHAR(500) NOT NULL,
  r2_key VARCHAR(255) NULL,
  is_free TINYINT(1) NOT NULL DEFAULT 0,
  requires_vip TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_courses_slug (slug),
  KEY idx_courses_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_courses_user_course (user_id, course_id),
  KEY idx_user_courses_course_id (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redeem_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  type ENUM('vip_days', 'course', 'unlock_all') NOT NULL,
  value VARCHAR(64) NULL,
  max_uses INT UNSIGNED NOT NULL DEFAULT 1,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  is_promoter_code TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_redeem_codes_code (code),
  KEY idx_redeem_codes_created_by (created_by),
  KEY idx_redeem_codes_is_promoter (is_promoter_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redeem_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  code_id BIGINT UNSIGNED NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_redeem_logs_user_code (user_id, code_id),
  KEY idx_redeem_logs_code_id (code_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('update', 'message') NOT NULL,
  version VARCHAR(64) NULL,
  title VARCHAR(200) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  image_url VARCHAR(500) NULL,
  link_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_type_id (type, id),
  KEY idx_notifications_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type ENUM('problem', 'promo') NOT NULL,
  wechat VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_feedback_created (created_at),
  KEY idx_feedback_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Client/shared tables (admin checkin / users / user-content)
CREATE TABLE IF NOT EXISTS user_studied_courses (
  user_id BIGINT NOT NULL,
  pack_id VARCHAR(128) NOT NULL,
  pack_title VARCHAR(255) NOT NULL,
  first_studied_at DATETIME NOT NULL,
  last_studied_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, pack_id),
  KEY idx_user_last (user_id, last_studied_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_skill_progress (
  user_id BIGINT NOT NULL,
  unlocked_difficulty TINYINT UNSIGNED NOT NULL DEFAULT 1,
  completed_pack_ids JSON NOT NULL,
  jump_unlocked_series_ids JSON NOT NULL,
  -- App1 闯关：每关星级 1–3；last_pack_id 为继续学习指针
  pack_stars JSON NULL,
  last_pack_id VARCHAR(128) NULL,
  total_stars INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY idx_usp_total_stars (total_stars, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_daily_star_gains (
  user_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  stars_gained INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, stat_date),
  KEY idx_daily_stars_date_gained (stat_date, stars_gained, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_course_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_course_groups_user (user_id),
  KEY idx_user_course_groups_user_sort (user_id, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_course_summaries (
  user_id BIGINT NOT NULL,
  course_id VARCHAR(128) NOT NULL,
  series_id VARCHAR(128) NULL,
  series_order INT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL,
  duration_minutes INT NOT NULL,
  word_count INT NOT NULL,
  exercise_count INT NOT NULL,
  lesson_count INT NOT NULL,
  stage VARCHAR(64) NULL,
  practice_mode VARCHAR(32) NULL,
  is_user_created TINYINT(1) NOT NULL DEFAULT 1,
  audio_ready TINYINT(1) NOT NULL DEFAULT 1,
  author_user_id BIGINT NULL,
  author_name VARCHAR(64) NULL,
  source_course_key VARCHAR(192) NULL,
  note VARCHAR(500) NULL,
  group_id BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, course_id),
  KEY idx_user_title (user_id, title),
  KEY idx_source_key (user_id, source_course_key),
  KEY idx_user_group (user_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_paper_summaries (
  user_id BIGINT NOT NULL,
  paper_id VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  words_json JSON NOT NULL,
  word_count INT UNSIGNED NOT NULL,
  question_count INT UNSIGNED NOT NULL,
  discarded_question_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, paper_id),
  KEY idx_user_papers_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_checkin_challenges (
  user_id BIGINT NOT NULL,
  challenge_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'completed', 'failed', 'claimed') NOT NULL DEFAULT 'active',
  started_on DATE NOT NULL,
  day1_completed_on DATE NULL,
  day2_completed_on DATE NULL,
  day3_completed_on DATE NULL,
  day4_completed_on DATE NULL,
  day5_completed_on DATE NULL,
  claimed_at DATETIME NULL,
  failed_at DATETIME NULL,
  fail_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, challenge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alipay APP pay orders (VIP)
CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  out_trade_no VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id VARCHAR(16) NOT NULL,
  amount_fen INT UNSIGNED NOT NULL,
  status ENUM('pending', 'paid', 'closed') NOT NULL DEFAULT 'pending',
  alipay_trade_no VARCHAR(64) NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_orders_out_trade_no (out_trade_no),
  KEY idx_payment_orders_user_id (user_id),
  KEY idx_payment_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Runtime app settings (e.g. admin-selected AI provider)
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-IP API rate limits (register / email-send / avatar-upload / login / email-verify)
CREATE TABLE IF NOT EXISTS ip_rate_limits (
  action VARCHAR(64) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  last_called_at BIGINT NOT NULL,
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (action, ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
