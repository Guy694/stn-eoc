-- สร้างตารางสำหรับบันทึกข้อมูลน้ำท่วมรายวัน (ระดับหมู่บ้าน)
CREATE TABLE IF NOT EXISTS daily_village_flood (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL,
    district VARCHAR(100) NOT NULL COMMENT 'ชื่ออำเภอ',
    tambon VARCHAR(100) NOT NULL COMMENT 'ชื่อตำบล',
    village VARCHAR(255) NOT NULL COMMENT 'ชื่อหมู่บ้าน',
    village_code VARCHAR(10) NULL COMMENT 'รหัสหมู่บ้าน',
    flood_level ENUM('safe', 'mild', 'moderate', 'severe') NOT NULL DEFAULT 'safe',
    water_level_cm INT DEFAULT 0 COMMENT 'ระดับน้ำ (เซนติเมตร)',
    affected_households INT DEFAULT 0 COMMENT 'จำนวนครัวเรือนได้รับผลกระทบ',
    affected_population INT DEFAULT 0 COMMENT 'ประชากรได้รับผลกระทบ (คน)',
    severity_level VARCHAR(50) NULL COMMENT 'ระดับความรุนแรง',
    status VARCHAR(50) DEFAULT 'active' COMMENT 'สถานะ',
    notes TEXT COMMENT 'หมายเหตุ',
    recorded_by INT NULL COMMENT 'officer id ผู้บันทึก',
    lat DECIMAL(10, 7) NULL COMMENT 'ละติจูด',
    lng DECIMAL(10, 7) NULL COMMENT 'ลองจิจูด',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_date (record_date),
    INDEX idx_district (district),
    INDEX idx_tambon (tambon),
    INDEX idx_flood_level (flood_level),
    INDEX idx_severity (severity_level),
    INDEX idx_status (status),
    INDEX idx_recorded_by (recorded_by),
    UNIQUE KEY unique_record (record_date, district, tambon, village)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='บันทึกข้อมูลน้ำท่วมรายวัน-รายหมู่บ้าน';
