-- Add avatar_url for user profile pictures (R2 public URL)
ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(500) NULL AFTER nickname;
