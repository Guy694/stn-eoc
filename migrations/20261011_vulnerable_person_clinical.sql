-- ทะเบียนรายบุคคล: ข้อมูลทางคลินิกที่ใช้จัดลำดับ (เช่น หญิงตั้งครรภ์: กำหนดคลอด, ประวัติคลอดก่อนกำหนด)
-- เก็บแบบเข้ารหัส (JSON) เช่นเดียวกับฟิลด์อ่อนไหวอื่น
SET @db_name = DATABASE();
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_persons' AND COLUMN_NAME = 'clinical_enc');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_persons ADD COLUMN clinical_enc TEXT NULL COMMENT ''ข้อมูลคลินิก เช่น กำหนดคลอด (เข้ารหัส)'' AFTER caregiver_enc', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
