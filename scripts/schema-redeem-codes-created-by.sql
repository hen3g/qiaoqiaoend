-- Track who created a redeem code (permanent-member daily gift codes).
-- App also auto-migrates via ensureRedeemCodesCreatedByColumn().

ALTER TABLE redeem_codes
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER expires_at,
  ADD KEY idx_redeem_codes_created_by (created_by);
