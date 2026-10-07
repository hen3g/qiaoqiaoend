-- Paid membership (充值会员), separate from overall access vip_expires_at.
--   is_paid_vip:         1 = has a successful, non-refunded paid membership purchase (ever)
--   paid_vip_expires_at: end of paid membership time (gift time such as 爱吃 excluded)
-- App also auto-migrates via ensureUserPaidVipColumns().
-- Backfill from payment history: node --env-file=.env.local scripts/backfill-paid-vip.mjs --apply
ALTER TABLE users
  ADD COLUMN is_paid_vip TINYINT(1) NOT NULL DEFAULT 0 AFTER vip_expires_at,
  ADD COLUMN paid_vip_expires_at DATETIME NULL AFTER is_paid_vip;
