-- สร้างตารางกลุ่มเปราะบาง (Vulnerable Groups)
CREATE TABLE IF NOT EXISTS vulnerable_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    province VARCHAR(100) DEFAULT 'สตูล',
    district VARCHAR(100) NOT NULL,
    tambon VARCHAR(100) NOT NULL,
    village VARCHAR(100) NULL,
    
    -- ประเภทกลุ่มเปราะบาง
    elderly INT DEFAULT 0 COMMENT 'ผู้สูงอายุ (60 ปีขึ้นไป)',
    children INT DEFAULT 0 COMMENT 'เด็ก (ต่ำกว่า 5 ปี)',
    disabled INT DEFAULT 0 COMMENT 'ผู้พิการ',
    bedridden INT DEFAULT 0 COMMENT 'ผู้ป่วยติดเตียง',
    pregnant INT DEFAULT 0 COMMENT 'สตรีมีครรภ์',
    chronic_illness INT DEFAULT 0 COMMENT 'ผู้ป่วยเรื้อรัง',
    
    -- รายละเอียดเพิ่มเติม
    notes TEXT NULL COMMENT 'หมายเหตุเพิ่มเติม',
    needs TEXT NULL COMMENT 'ความต้องการเฉพาะ',
    
    -- ข้อมูลการบันทึก
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (session_id) REFERENCES eoc_sessions(id) ON DELETE CASCADE,
    
    -- Index
    INDEX idx_session (session_id),
    INDEX idx_location (district, tambon),
    
    -- Unique constraint - หนึ่ง session บันทึกได้ครั้งเดียวต่อหมู่บ้าน
    UNIQUE KEY unique_session_village (session_id, district, tambon, village)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
