-- Diamonds balance for custom-course usage. App also auto-migrates via ensureUserDiamondsColumn().
ALTER TABLE users
  ADD COLUMN diamonds INT UNSIGNED NOT NULL DEFAULT 0 AFTER vip_expires_at;
