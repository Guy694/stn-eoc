-- กลุ่มเปราะบางในเหตุการณ์: เพิ่มสถานะการดูแลและการเคลื่อนย้าย
-- (ฐานข้อมูลกลาง vulnerable_group_baselines = ทะเบียนช่วงปกติ / vulnerable_groups = ผู้ได้รับผลกระทบในเหตุการณ์)
-- รันซ้ำได้: ตรวจ information_schema ก่อนเพิ่มคอลัมน์

CREATE TABLE IF NOT EXISTS vulnerable_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    province VARCHAR(100) DEFAULT 'สตูล',
    district VARCHAR(100) NOT NULL,
    tambon VARCHAR(100) NOT NULL,
    village VARCHAR(100) NULL,
    elderly INT DEFAULT 0,
    children INT DEFAULT 0,
    disabled INT DEFAULT 0,
    bedridden INT DEFAULT 0,
    pregnant INT DEFAULT 0,
    chronic_illness INT DEFAULT 0,
    notes TEXT NULL,
    needs TEXT NULL,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_vulnerable_groups_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'cared_count');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN cared_count INT NOT NULL DEFAULT 0 COMMENT ''ดูแลแล้ว (คน)'' AFTER chronic_illness', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'moved_count');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN moved_count INT NOT NULL DEFAULT 0 COMMENT ''เคลื่อนย้ายแล้ว (คน)'' AFTER cared_count', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'moved_to');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN moved_to VARCHAR(255) NULL COMMENT ''เคลื่อนย้ายไปที่'' AFTER moved_count', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME = 'care_updated_at');
SET @sql = IF(@exists = 0, 'ALTER TABLE vulnerable_groups ADD COLUMN care_updated_at DATETIME NULL COMMENT ''อัปเดตสถานะการดูแลล่าสุด'' AFTER moved_to', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
