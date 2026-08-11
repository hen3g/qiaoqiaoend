-- Allow notifications without a jump link
ALTER TABLE notifications
  MODIFY COLUMN link_url VARCHAR(500) NULL;
