-- สถานะสถานพยาบาลสำหรับแผนที่สถานการณ์: เบอร์โทร, เปิด/ปิดให้บริการ, สถานการณ์น้ำท่วมที่ตั้ง
-- เจ้าหน้าที่อัปเดตจากหน้า "จัดการหน่วยบริการ" ค่าว่าง = ยังไม่มีรายงาน
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'phone');
SET @sql = IF(@exists = 0, 'ALTER TABLE health_facilities ADD COLUMN phone VARCHAR(80) NULL COMMENT ''เบอร์โทรติดต่อ'' AFTER address', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'service_status');
SET @sql = IF(@exists = 0, 'ALTER TABLE health_facilities ADD COLUMN service_status VARCHAR(20) NULL COMMENT ''open / limited / closed'' AFTER is_active', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'flood_status');
SET @sql = IF(@exists = 0, 'ALTER TABLE health_facilities ADD COLUMN flood_status VARCHAR(20) NULL COMMENT ''normal / access_cut / flooded'' AFTER service_status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'service_note');
SET @sql = IF(@exists = 0, 'ALTER TABLE health_facilities ADD COLUMN service_note VARCHAR(255) NULL COMMENT ''หมายเหตุบริการ เช่น ย้ายจุดบริการชั่วคราว'' AFTER flood_status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'status_updated_at');
SET @sql = IF(@exists = 0, 'ALTER TABLE health_facilities ADD COLUMN status_updated_at DATETIME NULL AFTER service_note', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'status_updated_by');
SET @sql = IF(@exists = 0, 'ALTER TABLE health_facilities ADD COLUMN status_updated_by INT NULL AFTER status_updated_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
