-- Multilingual / per-app notification push (仓鼠单词)
-- Runtime also auto-migrates via ensureNotificationsSchema / ensureUserLocaleColumn.
-- Run manually if you prefer explicit DDL.

ALTER TABLE users
  ADD COLUMN locale VARCHAR(8) NULL AFTER register_platform;

ALTER TABLE users
  ADD KEY idx_users_locale (locale);

ALTER TABLE notifications
  ADD COLUMN locale VARCHAR(8) NULL AFTER user_id;

ALTER TABLE notifications
  ADD COLUMN title_ja VARCHAR(200) NULL AFTER title;

ALTER TABLE notifications
  ADD COLUMN summary_ja VARCHAR(500) NULL AFTER summary;

ALTER TABLE notifications
  ADD KEY idx_notifications_locale (locale);

-- locale on notifications: NULL = all languages; 'zh' / 'ja' = audience filter (broadcast only).
-- users.locale: app UI language synced from 仓鼠单词 (zh/ja).
