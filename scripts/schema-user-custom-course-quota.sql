-- Custom course slot quota (自制词库名额). Default 3 free; unlock with diamonds up to 10.
-- App also auto-migrates via ensureCustomCourseQuotaColumn().
ALTER TABLE users
  ADD COLUMN custom_course_quota INT UNSIGNED NOT NULL DEFAULT 3 AFTER share_custom_courses;
