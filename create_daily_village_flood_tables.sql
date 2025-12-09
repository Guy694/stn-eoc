-- สร้างตารางสำหรับบันทึกข้อมูลสถานการณ์น้ำท่วมรายวัน (ระดับหมู่บ้าน)
CREATE TABLE daily_village_flood_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL,
    villcode VARCHAR(10) NOT NULL COMMENT 'รหัสหมู่บ้าน 10 หลัก',
    village_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมู่บ้าน',
    district_name VARCHAR(100) NOT NULL COMMENT 'ชื่ออำเภอ',
    tambon_name VARCHAR(100) NOT NULL COMMENT 'ชื่อตำบล',
    flood_level ENUM('safe', 'mild', 'moderate', 'severe') NOT NULL DEFAULT 'safe',
    water_level DECIMAL(5,2) DEFAULT 0 COMMENT 'ระดับน้ำ (เมตร)',
    affected_households INT DEFAULT 0 COMMENT 'จำนวนครัวเรือนได้รับผลกระทบ',
    affected_population INT DEFAULT 0 COMMENT 'ประชากรได้รับผลกระทบ (คน)',
    damage_assessment TEXT COMMENT 'ประเมินความเสียหาย',
    notes TEXT COMMENT 'หมายเหตุเพิ่มเติม',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT 'officer_id ผู้บันทึก',
    
    UNIQUE KEY unique_village_date (villcode, record_date),
    INDEX idx_date (record_date),
    INDEX idx_villcode (villcode),
    INDEX idx_district (district_name),
    INDEX idx_level (flood_level),
    INDEX idx_created_by (created_by),
    
    FOREIGN KEY (created_by) REFERENCES officers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='บันทึกสถานการณ์น้ำท่วมรายวัน-รายหมู่บ้าน';

-- สร้างตารางสรุปสถานการณ์รายวัน (ระดับหมู่บ้าน)
CREATE TABLE daily_village_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL UNIQUE,
    total_affected_villages INT DEFAULT 0 COMMENT 'จำนวนหมู่บ้านได้รับผลกระทบ',
    severe_count INT DEFAULT 0 COMMENT 'จำนวนหมู่บ้านน้ำท่วมหนัก',
    moderate_count INT DEFAULT 0 COMMENT 'จำนวนหมู่บ้านน้ำท่วมปานกลาง',
    mild_count INT DEFAULT 0 COMMENT 'จำนวนหมู่บ้านน้ำท่วมเล็กน้อย',
    total_households INT DEFAULT 0 COMMENT 'ครัวเรือนรวมได้รับผลกระทบ',
    total_population INT DEFAULT 0 COMMENT 'ประชากรรวมได้รับผลกระทบ',
    evacuation_centers INT DEFAULT 0 COMMENT 'จำนวนศูนย์พักพิง',
    evacuees INT DEFAULT 0 COMMENT 'จำนวนผู้อพยพ',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT 'officer_id ผู้บันทึก',
    
    INDEX idx_date (record_date),
    FOREIGN KEY (created_by) REFERENCES officers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='สรุปสถานการณ์น้ำท่วมรายวัน (ระดับหมู่บ้าน)';

-- สร้าง View สำหรับดึงข้อมูลรายวัน (ระดับหมู่บ้าน)
CREATE OR REPLACE VIEW v_daily_village_flood_report AS
SELECT 
    dvfs.record_date,
    dvfs.villcode,
    dvfs.village_name,
    dvfs.district_name,
    dvfs.tambon_name,
    dvfs.flood_level,
    dvfs.water_level,
    dvfs.affected_households,
    dvfs.affected_population,
    dvfs.damage_assessment,
    dvfs.notes AS village_notes,
    dvs.total_affected_villages,
    dvs.severe_count,
    dvs.moderate_count,
    dvs.mild_count,
    dvs.total_population AS total_province_population,
    dvs.notes AS summary_notes
FROM daily_village_flood_status dvfs
LEFT JOIN daily_village_summary dvs ON dvfs.record_date = dvs.record_date
ORDER BY dvfs.record_date DESC, dvfs.district_name, dvfs.village_name;

-- สร้าง Stored Procedure สำหรับอัพเดทสรุปรายวัน
DELIMITER //

CREATE PROCEDURE update_daily_village_summary(IN input_date DATE)
BEGIN
    DECLARE total_villages INT;
    DECLARE severe_villages INT;
    DECLARE moderate_villages INT;
    DECLARE mild_villages INT;
    DECLARE total_pop INT;
    DECLARE total_house INT;
    
    -- นับจำนวนหมู่บ้านแต่ละระดับ
    SELECT 
        COUNT(*),
        SUM(CASE WHEN flood_level = 'severe' THEN 1 ELSE 0 END),
        SUM(CASE WHEN flood_level = 'moderate' THEN 1 ELSE 0 END),
        SUM(CASE WHEN flood_level = 'mild' THEN 1 ELSE 0 END),
        SUM(affected_population),
        SUM(affected_households)
    INTO 
        total_villages,
        severe_villages,
        moderate_villages,
        mild_villages,
        total_pop,
        total_house
    FROM daily_village_flood_status
    WHERE record_date = input_date;
    
    -- Insert หรือ Update summary
    INSERT INTO daily_village_summary (
        record_date,
        total_affected_villages,
        severe_count,
        moderate_count,
        mild_count,
        total_population,
        total_households
    ) VALUES (
        input_date,
        total_villages,
        severe_villages,
        moderate_villages,
        mild_villages,
        total_pop,
        total_house
    )
    ON DUPLICATE KEY UPDATE
        total_affected_villages = total_villages,
        severe_count = severe_villages,
        moderate_count = moderate_villages,
        mild_count = mild_villages,
        total_population = total_pop,
        total_households = total_house,
        updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- สร้าง Trigger สำหรับอัพเดทสรุปอัตโนมัติ
DELIMITER //

CREATE TRIGGER after_village_flood_insert
AFTER INSERT ON daily_village_flood_status
FOR EACH ROW
BEGIN
    CALL update_daily_village_summary(NEW.record_date);
END //

CREATE TRIGGER after_village_flood_update
AFTER UPDATE ON daily_village_flood_status
FOR EACH ROW
BEGIN
    CALL update_daily_village_summary(NEW.record_date);
END //

CREATE TRIGGER after_village_flood_delete
AFTER DELETE ON daily_village_flood_status
FOR EACH ROW
BEGIN
    CALL update_daily_village_summary(OLD.record_date);
END //

DELIMITER ;
