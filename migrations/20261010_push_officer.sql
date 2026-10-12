-- แจ้งเตือนถึงมือถือเจ้าหน้าที่ (คำขอความช่วยเหลือใหม่/ค้าง) ใช้ตาราง push_subscriptions ร่วมกับประชาชน
-- audience = public (ประชาชน) | officer (เจ้าหน้าที่ — ได้รับทั้งเตือนภัยประชาชนและงานของเจ้าหน้าที่)
-- รันซ้ำได้: ตรวจ information_schema ก่อนเพิ่มคอลัมน์
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'push_subscriptions' AND COLUMN_NAME = 'audience');
SET @sql = IF(@exists = 0, 'ALTER TABLE push_subscriptions ADD COLUMN audience ENUM(''public'',''officer'') NOT NULL DEFAULT ''public'' AFTER auth_secret', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'push_subscriptions' AND COLUMN_NAME = 'officer_id');
SET @sql = IF(@exists = 0, 'ALTER TABLE push_subscriptions ADD COLUMN officer_id INT NULL AFTER audience', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'push_subscriptions' AND INDEX_NAME = 'idx_push_audience');
SET @sql = IF(@exists = 0, 'ALTER TABLE push_subscriptions ADD KEY idx_push_audience (audience, is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
