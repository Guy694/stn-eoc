-- สร้างตารางสำหรับบันทึกสถานการณ์โรครายวัน
CREATE TABLE IF NOT EXISTS disease_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL COMMENT 'วันที่รายงาน',
    health_facility_id INT NOT NULL COMMENT 'รหัสหน่วยบริการ',
    disease_name VARCHAR(255) NOT NULL COMMENT 'ชื่อโรค',
    patient_count INT NOT NULL DEFAULT 0 COMMENT 'จำนวนผู้ป่วยในวันนี้',
    notes TEXT COMMENT 'หมายเหตุเพิ่มเติม',
    reported_by INT COMMENT 'ผู้รายงาน (officer_id)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_date (report_date),
    INDEX idx_health_facility (health_facility_id),
    INDEX idx_disease (disease_name),
    INDEX idx_date_facility (report_date, health_facility_id),
    UNIQUE KEY unique_daily_report (report_date, health_facility_id, disease_name),
    FOREIGN KEY (health_facility_id) REFERENCES health_facilities(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by) REFERENCES officer(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางบันทึกสถานการณ์โรครายวัน';

-- ข้อมูลตัวอย่าง
INSERT INTO disease_reports (report_date, health_facility_id, disease_name, patient_count, reported_by) VALUES
-- วันที่ 2025-01-06
('2025-01-06', 1, 'ไข้เลือดออก', 5, 1),
('2025-01-06', 1, 'โควิด-19', 3, 1),
('2025-01-06', 2, 'ไข้เลือดออก', 8, 1),
('2025-01-06', 2, 'มือเท้าปาก', 2, 1),
('2025-01-06', 3, 'ไข้เลือดออก', 12, 1),
('2025-01-06', 4, 'โควิด-19', 6, 1),

-- วันที่ 2025-01-05
('2025-01-05', 1, 'ไข้เลือดออก', 4, 1),
('2025-01-05', 1, 'โควิด-19', 2, 1),
('2025-01-05', 2, 'ไข้เลือดออก', 7, 1),
('2025-01-05', 3, 'ไข้เลือดออก', 10, 1),

-- วันที่ 2025-01-04
('2025-01-04', 1, 'ไข้เลือดออก', 6, 1),
('2025-01-04', 2, 'ไข้เลือดออก', 9, 1),
('2025-01-04', 2, 'มือเท้าปาก', 3, 1),
('2025-01-04', 3, 'ไข้เลือดออก', 11, 1),
('2025-01-04', 4, 'โควิด-19', 5, 1);

-- สร้าง View สำหรับสรุปข้อมูลตามอำเภอ
CREATE OR REPLACE VIEW disease_summary_by_district AS
SELECT 
    hf.district_name,
    dr.disease_name,
    dr.report_date,
    SUM(dr.patient_count) as total_patients,
    COUNT(DISTINCT dr.health_facility_id) as facilities_count
FROM disease_reports dr
JOIN health_facilities hf ON dr.health_facility_id = hf.id
GROUP BY hf.district_name, dr.disease_name, dr.report_date
ORDER BY dr.report_date DESC, hf.district_name, dr.disease_name;

-- สร้าง View สำหรับสรุปสะสม
CREATE OR REPLACE VIEW disease_cumulative_summary AS
SELECT 
    hf.district_name,
    dr.disease_name,
    SUM(dr.patient_count) as cumulative_patients,
    COUNT(DISTINCT dr.report_date) as report_days,
    MAX(dr.report_date) as last_report_date
FROM disease_reports dr
JOIN health_facilities hf ON dr.health_facility_id = hf.id
GROUP BY hf.district_name, dr.disease_name
ORDER BY hf.district_name, cumulative_patients DESC;

SELECT 'สร้างตาราง disease_reports และ Views สำเร็จ' as status;
