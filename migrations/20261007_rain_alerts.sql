-- แจ้งเตือนฝนหนักจากสถานีวัดฝน ThaiWater ใช้ตารางเดียวกับแจ้งเตือนระดับน้ำ (แยกด้วย kind)
-- station_id ของสถานีฝนขึ้นต้นด้วย "rain:" จึงไม่ชนกับสถานีวัดน้ำ
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'water_station_alert_state' AND COLUMN_NAME = 'kind');
SET @sql = IF(@exists = 0, 'ALTER TABLE water_station_alert_state ADD COLUMN kind ENUM(''water'',''rain'') NOT NULL DEFAULT ''water'' AFTER station_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'water_alert_log' AND COLUMN_NAME = 'kind');
SET @sql = IF(@exists = 0, 'ALTER TABLE water_alert_log ADD COLUMN kind ENUM(''water'',''rain'') NOT NULL DEFAULT ''water'' AFTER id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE water_station_alert_state
    MODIFY state ENUM('normal','near','overflow','watch','severe') NOT NULL DEFAULT 'normal',
    MODIFY bank_diff DECIMAL(7,2) NULL;

ALTER TABLE water_alert_log
    MODIFY state ENUM('normal','near','overflow','watch','severe') NOT NULL,
    MODIFY previous_state ENUM('normal','near','overflow','watch','severe') NOT NULL;
