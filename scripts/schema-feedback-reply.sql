-- Admin replies on feedback / cooperation submissions
ALTER TABLE feedback_submissions
  ADD COLUMN admin_reply TEXT NULL AFTER content,
  ADD COLUMN replied_at DATETIME NULL AFTER admin_reply;
