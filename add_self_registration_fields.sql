-- เพิ่ม fields สำหรับ Self-Registration ผ่าน ThaiID
ALTER TABLE officer 
ADD COLUMN position VARCHAR(100) DEFAULT NULL COMMENT 'ตำแหน่งที่ปฏิบัติงาน',
ADD COLUMN department VARCHAR(100) DEFAULT NULL COMMENT 'หน่วยงาน',
ADD COLUMN requested_role ENUM('staff','MCATT','SAT','SeRHT','admin') DEFAULT 'staff' COMMENT 'สิทธิ์ที่ร้องขอ',
ADD COLUMN is_approved BOOLEAN DEFAULT FALSE COMMENT 'สถานะการอนุมัติ (FALSE = รออนุมัติ, TRUE = อนุมัติแล้ว)',
ADD COLUMN request_time TIMESTAMP NULL DEFAULT NULL COMMENT 'เวลาที่ขอสิทธิ์',
ADD COLUMN approved_by INT DEFAULT NULL COMMENT 'ผู้อนุมัติ (officer id)',
ADD COLUMN approved_time TIMESTAMP NULL DEFAULT NULL COMMENT 'เวลาที่อนุมัติ';

-- สร้าง index
CREATE INDEX idx_officer_is_approved ON officer(is_approved);
CREATE INDEX idx_officer_request_time ON officer(request_time);

-- อัปเดต user ที่มีอยู่แล้วให้เป็น approved
UPDATE officer SET is_approved = TRUE WHERE pid_hash IS NOT NULL;

-- แสดงโครงสร้างตารางใหม่
DESCRIBE officer;
