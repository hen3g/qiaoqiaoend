-- OAuth / session revocation: bump on logout to invalidate JWTs
ALTER TABLE users
  ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER password_hash;
