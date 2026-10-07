-- ติดตามคำขอความช่วยเหลือ/รายงานของประชาชน
--  - tracking_code: เลขติดตามแบบสุ่ม (ผู้แจ้งใช้คู่กับเบอร์โทร 4 ตัวท้ายเพื่อดูสถานะ)
--  - citizen_message: ข้อความที่เจ้าหน้าที่เขียนถึงผู้แจ้ง (แยกจาก admin_notes ที่เป็นบันทึกภายใน)
--  - incident_status_events: ประวัติการเปลี่ยนสถานะ ใช้แสดงลำดับเหตุการณ์ให้ผู้แจ้ง
-- รันซ้ำได้
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'tracking_code');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN tracking_code VARCHAR(12) NULL COMMENT ''เลขติดตามสำหรับผู้แจ้ง'' AFTER id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND INDEX_NAME = 'uniq_incident_tracking_code');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD UNIQUE KEY uniq_incident_tracking_code (tracking_code)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'citizen_message');
SET @sql = IF(@exists = 0, 'ALTER TABLE public_incident_reports ADD COLUMN citizen_message VARCHAR(500) NULL COMMENT ''ข้อความจากเจ้าหน้าที่ถึงผู้แจ้ง (แสดงในหน้าติดตาม)'' AFTER admin_notes', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS incident_status_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  citizen_message VARCHAR(500) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_incident_status_events_report (report_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- รายงานเดิมได้เลขติดตามด้วย (ST + 6 ตัวจาก UUID) และเริ่มประวัติด้วยเวลาที่แจ้ง
UPDATE public_incident_reports
SET tracking_code = CONCAT('ST', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 6)))
WHERE tracking_code IS NULL;

INSERT INTO incident_status_events (report_id, status, created_at)
SELECT r.id, 'pending', COALESCE(r.reported_at, r.created_at)
FROM public_incident_reports r
WHERE NOT EXISTS (SELECT 1 FROM incident_status_events e WHERE e.report_id = r.id);
