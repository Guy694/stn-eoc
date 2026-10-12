-- กลุ่มสีของกลุ่มเปราะบาง (แดง/เหลือง/เขียว ตามแนวทาง สสจ.สตูล) และการพึ่งอุปกรณ์ที่ใช้ไฟฟ้า
-- care_group ว่าง = ใช้สีที่ระบบเสนอตามประเภท
SET @db_name = DATABASE();
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_persons' AND COLUMN_NAME = 'care_group');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_persons ADD COLUMN care_group VARCHAR(10) NULL COMMENT ''กลุ่มสี red/yellow/green (ว่าง = ตามประเภท)'' AFTER vulnerable_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_persons' AND COLUMN_NAME = 'power_dependent');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_persons ADD COLUMN power_dependent TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''พึ่งเครื่องช่วยหายใจ/อุปกรณ์ที่ใช้ไฟฟ้า'' AFTER care_group', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
