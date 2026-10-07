-- รายงานระดับน้ำจากประชาชน: เก็บแนวโน้มน้ำ (ขึ้น/ทรงตัว/ลง) แยกเป็นช่อง
-- ระดับน้ำใช้ช่อง water_level เดิม (เก็บรหัสช่วง เช่น knee_waist) และการสัญจรใช้ travel_status เดิม
SET @db_name = DATABASE();
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'water_trend');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN water_trend VARCHAR(10) NULL COMMENT ''rising / steady / falling'' AFTER water_level', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
