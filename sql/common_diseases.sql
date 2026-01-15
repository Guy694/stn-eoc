-- ตาราง common_diseases
-- ใช้เก็บรายชื่อโรคสำหรับ dropdown ทั้งระบบ

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

-- หมายเหตุ:
-- API สำหรับจัดการ: /api/common/diseases
-- GET: ดึงรายการโรคทั้งหมด
-- POST: เพิ่มโรคใหม่ (ตรวจสอบซ้ำอัตโนมัติ)
-- DELETE: ลบโรค (soft delete)
