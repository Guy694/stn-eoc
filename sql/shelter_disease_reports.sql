-- สร้างตาราง shelter_disease_reports
-- ใช้สำหรับบันทึกสถานการณ์โรครายวันในศูนย์พักพิงชั่วคราว

CREATE TABLE IF NOT EXISTS shelter_disease_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL,                    -- ศูนย์พักพิง
    session_id INT NOT NULL,                    -- EOC Session
    report_date DATE NOT NULL,                  -- วันที่รายงาน
    
    -- ข้อมูลโรค
    disease_type VARCHAR(100) NOT NULL,         -- ประเภทโรค เช่น ไข้หวัด, ท้องเสีย, ตาแดง
    new_cases INT DEFAULT 0,                    -- ผู้ป่วยใหม่
    recovered INT DEFAULT 0,                    -- หายแล้ว
    hospitalized INT DEFAULT 0,                 -- ส่งต่อ รพ.
    deaths INT DEFAULT 0,                       -- เสียชีวิต
    
    -- สถานะและรายละเอียด
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
    symptoms TEXT,                              -- อาการที่พบ
    treatment_given TEXT,                       -- การรักษาที่ให้
    notes TEXT,                                 -- หมายเหตุ
    
    -- ข้อมูลผู้บันทึก
    reported_by INT,                            -- FK ไป users
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE KEY unique_shelter_disease_date (shelter_id, session_id, report_date, disease_type),
    INDEX idx_session_date (session_id, report_date),
    INDEX idx_shelter_session (shelter_id, session_id),
    INDEX idx_disease_type (disease_type)
);

-- ตารางสำหรับประเภทโรค (สำหรับ dropdown)
CREATE TABLE IF NOT EXISTS common_diseases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert โรคที่พบบ่อย
INSERT IGNORE INTO common_diseases (name, description) VALUES
('ไข้เลือดออก', 'ไข้เลือดออกจากยุงลาย'),
('โควิด-19', 'โรคติดเชื้อไวรัสโคโรนา 2019'),
('มือเท้าปาก', 'โรคมือเท้าปากในเด็ก'),
('ไข้หวัดใหญ่', 'ไข้หวัดใหญ่ตามฤดูกาล'),
('อุจจาระร่วง', 'ท้องเสีย อุจจาระร่วงเฉียบพลัน'),
('โรคผิวหนัง', 'โรคผิวหนังติดเชื้อ ผื่นคัน'),
('ตาแดง', 'โรคตาแดง ตาอักเสบ'),
('ไข้หวัด', 'ไข้หวัดทั่วไป');
