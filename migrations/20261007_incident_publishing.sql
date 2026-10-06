-- รับแจ้งจุดปัญหาจากประชาชน: แยก "ยืนยันข้อเท็จจริง" (status) ออกจาก "เผยแพร่" (publish_status)
-- - เรื่องที่ยืนยันแล้วใช้ในงานศูนย์ได้ แต่ขึ้นแผนที่สาธารณะเฉพาะที่เจ้าหน้าที่เขียนข้อความและกดเผยแพร่เอง
-- - คำขอความช่วยเหลือ (help_request) ไม่เผยแพร่เด็ดขาด (บังคับที่ API)
-- - ข้อมูลเดิมทั้งหมดเริ่มที่ "ไม่เผยแพร่" เพื่อไม่ให้ข้อความต้นฉบับ/รูปของประชาชนหลุดออกไป
-- รันซ้ำได้: ตรวจ information_schema ก่อนเพิ่มคอลัมน์

SET @db_name = DATABASE();

-- ประเภทรายงานใหม่: แจ้งจุดปัญหา
ALTER TABLE public_incident_reports
    MODIFY COLUMN report_type ENUM('help_request','traffic_report','problem_point') COLLATE utf8mb4_unicode_ci DEFAULT 'help_request';

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'problem_category');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN problem_category VARCHAR(30) NULL COMMENT ''หมวดจุดปัญหา: flood, road_cut, power_out, tree_down, landslide, other'' AFTER report_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'publish_status');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN publish_status ENUM(''none'',''published'',''expired'',''withdrawn'') NOT NULL DEFAULT ''none'' COMMENT ''สถานะการเผยแพร่ แยกจากสถานะการตรวจสอบ'' AFTER status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'public_title');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN public_title VARCHAR(150) NULL COMMENT ''หัวข้อที่เจ้าหน้าที่เขียนสำหรับเผยแพร่'' AFTER publish_status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'public_detail');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN public_detail VARCHAR(500) NULL COMMENT ''รายละเอียดที่เผยแพร่ (ไม่ใช่ข้อความต้นฉบับ)'' AFTER public_title', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'public_photo_path');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN public_photo_path VARCHAR(255) NULL COMMENT ''สำเนารูปที่เลือกเผยแพร่ (ลบข้อมูลตำแหน่งแล้ว)'' AFTER public_detail', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'published_at');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN published_at DATETIME NULL AFTER public_photo_path', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'published_by');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN published_by INT NULL AFTER published_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'expires_at');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN expires_at DATETIME NULL COMMENT ''ซ่อนจากแผนที่สาธารณะอัตโนมัติ'' AFTER published_by', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'merged_into_id');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN merged_into_id INT NULL COMMENT ''รวมกับเรื่องหลัก (นับเป็นแจ้ง N ราย)'' AFTER expires_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'normal_reports');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN normal_reports INT NOT NULL DEFAULT 0 COMMENT ''จำนวนครั้งที่ประชาชนกด ตอนนี้ปกติแล้ว'' AFTER merged_into_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'normal_reported_at');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN normal_reported_at DATETIME NULL AFTER normal_reports', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND INDEX_NAME = 'idx_incident_publish');
SET @sql = IF(@exists = 0, 'CREATE INDEX idx_incident_publish ON public_incident_reports(publish_status, expires_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND INDEX_NAME = 'idx_incident_merged');
SET @sql = IF(@exists = 0, 'CREATE INDEX idx_incident_merged ON public_incident_reports(merged_into_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
