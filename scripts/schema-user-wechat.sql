-- WeChat Open Platform mobile login binding + allow passwordless accounts
ALTER TABLE users
  ADD COLUMN wechat_openid VARCHAR(64) NULL AFTER email,
  ADD COLUMN wechat_unionid VARCHAR(64) NULL AFTER wechat_openid,
  ADD UNIQUE KEY uk_users_wechat_openid (wechat_openid);

-- Allow empty password for WeChat auto-created accounts
ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL;
