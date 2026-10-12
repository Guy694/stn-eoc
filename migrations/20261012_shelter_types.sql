-- ประเภทศูนย์พักพิง (ทั่วไป / กลุ่มเปราะบาง / Medical shelter / รพ.สนาม / จุดพักชั่วคราว) และความพร้อม
-- + เก็บว่ากลุ่มเปราะบางรายบุคคลถูกเคลื่อนย้ายไปศูนย์ไหน (moved_shelter_id) เพื่อนับยอดรายศูนย์
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'shelter_centers' AND COLUMN_NAME = 'shelter_type');
SET @sql = IF(@exists = 0, 'ALTER TABLE shelter_centers ADD COLUMN shelter_type VARCHAR(30) NOT NULL DEFAULT ''general'' COMMENT ''general / vulnerable / medical / field_hospital / temporary'' AFTER eoc_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'shelter_centers' AND COLUMN_NAME = 'capabilities');
SET @sql = IF(@exists = 0, 'ALTER TABLE shelter_centers ADD COLUMN capabilities VARCHAR(500) NULL COMMENT ''ความพร้อม คั่นด้วย , เช่น oxygen,power_backup'' AFTER shelter_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_person_cases' AND COLUMN_NAME = 'moved_shelter_id');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_person_cases ADD COLUMN moved_shelter_id INT NULL AFTER moved_to', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_case_events' AND COLUMN_NAME = 'moved_shelter_id');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_case_events ADD COLUMN moved_shelter_id INT NULL AFTER moved_to', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
