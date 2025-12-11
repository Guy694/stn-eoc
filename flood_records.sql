-- ตารางสำหรับบันทึกสถานะพื้นที่น้ำท่วมแต่ละปี
CREATE TABLE IF NOT EXISTS flood_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL COMMENT 'ปีที่บันทึก',
    polygon_id INT NULL COMMENT 'อ้างอิงจาก satun_village_polygon (fid)',
    province VARCHAR(100) DEFAULT 'สตูล' COMMENT 'จังหวัด',
    district VARCHAR(100) NOT NULL COMMENT 'อำเภอ',
    tambon VARCHAR(100) NOT NULL COMMENT 'ตำบล',
    village VARCHAR(100) NULL COMMENT 'หมู่บ้าน (ถ้ามี)',
    
    -- ข้อมูลน้ำท่วม
    flood_level ENUM('ไม่มี', 'ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก') DEFAULT 'ไม่มี' COMMENT 'ระดับน้ำท่วม',
    flood_start_date DATE NULL COMMENT 'วันที่เริ่มน้ำท่วม',
    flood_end_date DATE NULL COMMENT 'วันที่น้ำลด',
    water_depth_cm DECIMAL(10,2) NULL COMMENT 'ความลึกของน้ำ (ซม.)',
    affected_area_sqm DECIMAL(15,2) NULL COMMENT 'พื้นที่ได้รับผลกระทบ (ตร.ม.)',
    affected_households INT DEFAULT 0 COMMENT 'จำนวนครัวเรือนที่ได้รับผลกระทบ',
    affected_people INT DEFAULT 0 COMMENT 'จำนวนประชากรที่ได้รับผลกระทบ',
    
    -- รายละเอียดเพิ่มเติม
    description TEXT NULL COMMENT 'รายละเอียดเพิ่มเติม',
    damage_amount DECIMAL(15,2) DEFAULT 0 COMMENT 'มูลค่าความเสียหาย (บาท)',
    relief_amount DECIMAL(15,2) DEFAULT 0 COMMENT 'งบประมาณช่วยเหลือ (บาท)',
    
    -- ข้อมูลการจัดการ
    status ENUM('รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น') DEFAULT 'รอดำเนินการ' COMMENT 'สถานะ',
    created_by VARCHAR(100) NULL COMMENT 'ผู้บันทึก',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่บันทึก',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไข',
    
    -- Indexes
    INDEX idx_year (year),
    INDEX idx_district (district),
    INDEX idx_tambon (tambon),
    INDEX idx_flood_level (flood_level),
    INDEX idx_polygon_id (polygon_id),
    UNIQUE KEY unique_record (year, district, tambon, village)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='บันทึกสถานะพื้นที่น้ำท่วมแต่ละปี';

-- ข้อมูลตัวอย่าง
INSERT INTO flood_records (year, district, tambon, village, flood_level, flood_start_date, flood_end_date, 
    water_depth_cm, affected_households, affected_people, description, status) VALUES
(2024, 'เมืองสตูล', 'พิมาน', NULL, 'สูง', '2024-11-15', '2024-11-25', 150, 45, 180, 'น้ำท่วมจากฝนตกหนัก', 'เสร็จสิ้น'),
(2024, 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', 'ปานกลาง', '2024-11-16', '2024-11-22', 80, 30, 120, 'น้ำท่วมบริเวณถนนสาย 416', 'เสร็จสิ้น'),
(2024, 'ละงู', 'กำแพง', NULL, 'สูงมาก', '2024-10-20', '2024-10-30', 200, 100, 450, 'น้ำท่วมจากพายุ', 'เสร็จสิ้น'),
(2025, 'เมืองสตูล', 'พิมาน', NULL, 'ต่ำ', '2025-12-01', NULL, 50, 15, 60, 'เฝ้าระวังสถานการณ์', 'กำลังดำเนินการ');
