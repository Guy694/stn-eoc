-- สร้างตารางสำหรับบันทึกข้อมูลสถานการณ์น้ำท่วมรายวัน
CREATE TABLE daily_flood_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL UNIQUE,
    district_name VARCHAR(100) NOT NULL,
    flood_level ENUM('safe', 'mild', 'moderate', 'severe') NOT NULL DEFAULT 'safe',
    affected_area DECIMAL(10,2) DEFAULT 0 COMMENT 'พื้นที่ได้รับผลกระทบ (ตร.กม.)',
    affected_population INT DEFAULT 0 COMMENT 'ประชากรได้รับผลกระทบ (คน)',
    water_level DECIMAL(5,2) DEFAULT 0 COMMENT 'ระดับน้ำ (เมตร)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (record_date),
    INDEX idx_district (district_name),
    INDEX idx_level (flood_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='บันทึกสถานการณ์น้ำท่วมรายวัน-รายอำเภอ';

-- สร้างตารางสรุปสถานการณ์รายวัน
CREATE TABLE daily_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL UNIQUE,
    total_affected_districts INT DEFAULT 0,
    severe_count INT DEFAULT 0,
    moderate_count INT DEFAULT 0,
    mild_count INT DEFAULT 0,
    total_population INT DEFAULT 0,
    total_area DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='สรุปสถานการณ์น้ำท่วมรายวัน';

-- สร้างตารางสำหรับบันทึกภาพแผนที่รายวัน
CREATE TABLE daily_flood_maps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL,
    map_image LONGBLOB COMMENT 'ไฟล์ภาพแผนที่',
    image_url VARCHAR(255) COMMENT 'URL ภาพแผนที่ (ถ้าเก็บแยก)',
    file_name VARCHAR(255),
    file_size INT COMMENT 'ขนาดไฟล์ (bytes)',
    mime_type VARCHAR(50) DEFAULT 'image/png',
    created_by INT COMMENT 'officer_id ผู้บันทึก',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (record_date),
    FOREIGN KEY (created_by) REFERENCES officers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='เก็บภาพแผนที่น้ำท่วมรายวัน';

-- สร้าง View สำหรับดึงข้อมูลรายวัน
CREATE OR REPLACE VIEW v_daily_flood_report AS
SELECT 
    dfs.record_date,
    dfs.district_name,
    dfs.flood_level,
    dfs.affected_area,
    dfs.affected_population,
    dfs.water_level,
    ds.total_affected_districts,
    ds.severe_count,
    ds.moderate_count,
    ds.mild_count,
    ds.total_population AS total_province_population,
    ds.notes
FROM daily_flood_status dfs
LEFT JOIN daily_summary ds ON dfs.record_date = ds.record_date
ORDER BY dfs.record_date DESC, dfs.district_name;
