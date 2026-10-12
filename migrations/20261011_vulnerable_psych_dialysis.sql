-- กลุ่มเปราะบางเพิ่ม: ผู้ป่วยจิตเวช, ฟอกไตทางเส้นเลือด (HD), ฟอกไตทางหน้าท้อง (CAPD)
-- เพิ่มทั้งทะเบียนกลาง (vulnerable_group_baselines) และบันทึกในเหตุการณ์ (vulnerable_groups)
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_group_baselines' AND COLUMN_NAME = 'psychiatric');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_group_baselines ADD COLUMN psychiatric INT NOT NULL DEFAULT 0 COMMENT ''ผู้ป่วยจิตเวช'' AFTER chronic_illness', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_group_baselines' AND COLUMN_NAME = 'dialysis_hd');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_group_baselines ADD COLUMN dialysis_hd INT NOT NULL DEFAULT 0 COMMENT ''ฟอกไตทางเส้นเลือด'' AFTER psychiatric', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_group_baselines' AND COLUMN_NAME = 'dialysis_pd');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_group_baselines ADD COLUMN dialysis_pd INT NOT NULL DEFAULT 0 COMMENT ''ฟอกไตทางหน้าท้อง'' AFTER dialysis_hd', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'psychiatric');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN psychiatric INT NOT NULL DEFAULT 0 COMMENT ''ผู้ป่วยจิตเวช'' AFTER chronic_illness', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'dialysis_hd');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN dialysis_hd INT NOT NULL DEFAULT 0 COMMENT ''ฟอกไตทางเส้นเลือด'' AFTER psychiatric', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'dialysis_pd');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN dialysis_pd INT NOT NULL DEFAULT 0 COMMENT ''ฟอกไตทางหน้าท้อง'' AFTER dialysis_hd', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
