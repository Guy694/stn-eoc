-- เพิ่ม column pid (เลขบัตรประชาชน 13 หลัก) ในตาราง officer
ALTER TABLE officer 
ADD COLUMN pid VARCHAR(13) DEFAULT NULL UNIQUE COMMENT 'เลขบัตรประชาชน 13 หลัก สำหรับ ThaiID Login';

-- สร้าง index สำหรับการค้นหา
CREATE INDEX idx_officer_pid ON officer(pid);

-- แสดงโครงสร้างตารางหลังแก้ไข
DESCRIBE officer;
