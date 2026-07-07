-- Add disease subtype metadata to EOC disease sessions.
-- Keeps eoc_type = 'disease' while allowing each session to identify the outbreak disease.

CREATE TABLE IF NOT EXISTS common_diseases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO common_diseases (name, description) VALUES
('ไข้เลือดออก', 'ไข้เลือดออกจากยุงลาย'),
('โควิด-19', 'โรคติดเชื้อไวรัสโคโรนา 2019'),
('มือเท้าปาก', 'โรคมือเท้าปากในเด็ก'),
('ไข้หวัดใหญ่', 'ไข้หวัดใหญ่ตามฤดูกาล'),
('อุจจาระร่วง', 'ท้องเสีย อุจจาระร่วงเฉียบพลัน'),
('โรคผิวหนัง', 'โรคผิวหนังติดเชื้อ ผื่นคัน'),
('ตาแดง', 'โรคตาแดง ตาอักเสบ'),
('ไข้หวัด', 'ไข้หวัดทั่วไป'),
('โรคฉี่หนู', 'โรคเลปโตสไปโรซิสที่อาจพบหลังน้ำท่วม');

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE eoc_sessions ADD COLUMN disease_id INT NULL AFTER festival_type',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'eoc_sessions'
      AND COLUMN_NAME = 'disease_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE eoc_sessions ADD COLUMN disease_name VARCHAR(150) NULL AFTER disease_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'eoc_sessions'
      AND COLUMN_NAME = 'disease_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE eoc_sessions ADD INDEX idx_eoc_sessions_disease_id (disease_id)',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'eoc_sessions'
      AND INDEX_NAME = 'idx_eoc_sessions_disease_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE eoc_sessions ADD INDEX idx_eoc_sessions_disease_name (disease_name)',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'eoc_sessions'
      AND INDEX_NAME = 'idx_eoc_sessions_disease_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
