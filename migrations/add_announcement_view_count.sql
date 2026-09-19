-- เก็บจำนวนครั้งที่เปิดหน้ารายละเอียดประกาศ
-- MySQL 8 ไม่รองรับ ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- จึงตรวจสอบ information_schema ก่อนเพื่อให้ migration นี้รันซ้ำได้

SET @db_name = DATABASE();

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'announcements'
      AND COLUMN_NAME = 'view_count'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE announcements ADD COLUMN view_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER priority',
    'SELECT ''view_count already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
