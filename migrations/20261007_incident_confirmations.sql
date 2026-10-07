-- ประชาชนช่วยยืนยันจุดบนแผนที่: "ยังท่วมอยู่" / "น้ำลดแล้ว" (มีอยู่แล้ว: normal_reports) / "ข้อมูลไม่ถูกต้อง"
-- ไม่เปลี่ยนการแสดงผลอัตโนมัติ — นับให้เจ้าหน้าที่เห็นในคิว และใช้บอกความสดของข้อมูลบนแผนที่
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'still_reports');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN still_reports INT NOT NULL DEFAULT 0, ADD COLUMN still_reported_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'wrong_reports');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN wrong_reports INT NOT NULL DEFAULT 0, ADD COLUMN wrong_reported_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
