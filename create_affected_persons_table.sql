-- สร้างตารางสำหรับบันทึกข้อมูลผู้ได้รับผลกระทบ
CREATE TABLE IF NOT EXISTS affected_persons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL COMMENT 'รหัส EOC Session',
    report_date DATE NOT NULL COMMENT 'วันที่รายงาน',
    district_name VARCHAR(100) NOT NULL COMMENT 'อำเภอ',
    tambon VARCHAR(100) COMMENT 'ตำบล',
    
    -- จำนวนผู้ได้รับผลกระทบแต่ละประเภท
    deaths INT NOT NULL DEFAULT 0 COMMENT 'จำนวนผู้เสียชีวิต',
    missing INT NOT NULL DEFAULT 0 COMMENT 'จำนวนผู้สูญหาย',
    injured INT NOT NULL DEFAULT 0 COMMENT 'จำนวนผู้ได้รับบาดเจ็บ',
    affected INT NOT NULL DEFAULT 0 COMMENT 'จำนวนผู้ได้รับผลกระทบ',
    
    -- ข้อมูลเพิ่มเติม
    notes TEXT COMMENT 'หมายเหตุเพิ่มเติม',
    reported_by INT COMMENT 'ผู้รายงาน (officer_id)',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_session (session_id),
    INDEX idx_report_date (report_date),
    INDEX idx_district (district_name),
    INDEX idx_session_date (session_id, report_date),
    INDEX idx_session_district_date (session_id, district_name, report_date),
    
    -- แต่ละอำเภอต่อวันต่อ session บันทึกได้ครั้งเดียว
    UNIQUE KEY unique_daily_report (session_id, district_name, tambon, report_date)
    
    -- Foreign keys จะเพิ่มทีหลังเมื่อตารางพร้อม
    -- FOREIGN KEY (session_id) REFERENCES eoc_sessions(id) ON DELETE CASCADE,
    -- FOREIGN KEY (reported_by) REFERENCES officer(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางบันทึกข้อมูลผู้ได้รับผลกระทบรายวัน';

-- ข้อมูลตัวอย่าง (สมมติ session_id = 1)
INSERT INTO affected_persons (session_id, report_date, district_name, tambon, deaths, missing, injured, affected, reported_by) VALUES
-- วันที่ 2026-01-14
(1, '2026-01-14', 'สตูล', 'คลองขุด', 0, 0, 5, 120, 1),
(1, '2026-01-14', 'สตูล', 'ตำมะลัง', 0, 0, 3, 85, 1),
(1, '2026-01-14', 'ควนโดน', 'ควนโดน', 1, 0, 8, 250, 1),
(1, '2026-01-14', 'ควนกาหลง', 'ควนกาหลง', 0, 0, 4, 150, 1),
(1, '2026-01-14', 'ท่าแพ', 'ท่าแพ', 0, 1, 2, 95, 1),
(1, '2026-01-14', 'ละงู', 'ละงู', 0, 0, 6, 180, 1),

-- วันที่ 2026-01-13
(1, '2026-01-13', 'สตูล', 'คลองขุด', 0, 0, 3, 100, 1),
(1, '2026-01-13', 'สตูล', 'ตำมะลัง', 0, 0, 2, 75, 1),
(1, '2026-01-13', 'ควนโดน', 'ควนโดน', 0, 0, 5, 200, 1),
(1, '2026-01-13', 'ควนกาหลง', 'ควนกาหลง', 0, 0, 3, 130, 1),

-- วันที่ 2026-01-12
(1, '2026-01-12', 'สตูล', 'คลองขุด', 0, 0, 2, 80, 1),
(1, '2026-01-12', 'ควนโดน', 'ควนโดน', 0, 0, 4, 180, 1),
(1, '2026-01-12', 'ละงู', 'ละงู', 0, 0, 3, 140, 1);

-- สร้าง View สำหรับสรุปข้อมูลตามอำเภอ (รายวัน)
CREATE OR REPLACE VIEW affected_persons_daily_summary AS
SELECT 
    session_id,
    report_date,
    district_name,
    SUM(deaths) as total_deaths,
    SUM(missing) as total_missing,
    SUM(injured) as total_injured,
    SUM(affected) as total_affected,
    COUNT(DISTINCT tambon) as tambon_count
FROM affected_persons
GROUP BY session_id, report_date, district_name
ORDER BY report_date DESC, district_name;

-- สร้าง View สำหรับสรุปสะสม (ทั้งหมด)
CREATE OR REPLACE VIEW affected_persons_cumulative_summary AS
SELECT 
    session_id,
    district_name,
    SUM(deaths) as cumulative_deaths,
    SUM(missing) as cumulative_missing,
    SUM(injured) as cumulative_injured,
    SUM(affected) as cumulative_affected,
    COUNT(DISTINCT report_date) as report_days,
    MAX(report_date) as last_report_date,
    COUNT(DISTINCT tambon) as tambon_count
FROM affected_persons
GROUP BY session_id, district_name
ORDER BY session_id DESC, district_name;

-- สร้าง View สำหรับสรุปรวมทั้งจังหวัด
CREATE OR REPLACE VIEW affected_persons_province_summary AS
SELECT 
    session_id,
    report_date,
    SUM(deaths) as province_deaths,
    SUM(missing) as province_missing,
    SUM(injured) as province_injured,
    SUM(affected) as province_affected,
    COUNT(DISTINCT district_name) as district_count,
    COUNT(DISTINCT tambon) as tambon_count
FROM affected_persons
GROUP BY session_id, report_date
ORDER BY report_date DESC;

SELECT 'สร้างตาราง affected_persons และ Views สำเร็จ' as status;
