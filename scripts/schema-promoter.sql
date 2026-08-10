-- Promoter (推广者): flag on users, binding, and promoter-owned redeem codes.
-- App also auto-migrates via ensureUserPromoterColumns / ensureRedeemCodesIsPromoterColumn.

ALTER TABLE users
  ADD COLUMN is_promoter TINYINT(1) NOT NULL DEFAULT 0 AFTER share_custom_courses,
  ADD COLUMN promoter_id BIGINT UNSIGNED NULL AFTER is_promoter,
  ADD KEY idx_users_promoter_id (promoter_id);

ALTER TABLE redeem_codes
  ADD COLUMN is_promoter_code TINYINT(1) NOT NULL DEFAULT 0 AFTER created_by,
  ADD KEY idx_redeem_codes_is_promoter (is_promoter_code);
