-- เพิ่ม column pid_hash และ migrate ข้อมูล PID ให้เป็น hash
-- ขั้นตอนที่ 1: เพิ่ม column pid_hash
ALTER TABLE officer 
ADD COLUMN pid_hash VARCHAR(64) DEFAULT NULL COMMENT 'Hashed PID (SHA-256) สำหรับความปลอดภัย PDPA';

-- ขั้นตอนที่ 2: สร้าง index สำหรับการค้นหา
CREATE INDEX idx_officer_pid_hash ON officer(pid_hash);

-- ขั้นตอนที่ 3: แปลง PID เดิมที่มีอยู่ให้เป็น hash
-- (ทำทีละ record ด้วย Node.js script จะปลอดภัยกว่า)
-- หรือใช้คำสั่ง SQL นี้ถ้า MySQL รองรับ SHA2:
UPDATE officer 
SET pid_hash = SHA2(pid, 256) 
WHERE pid IS NOT NULL AND pid != '';

-- ขั้นตอนที่ 4: หลัง migrate เสร็จแล้ว ให้ลบ column pid เดิม (Optional - เพื่อความปลอดภัยสูงสุด)
-- ALTER TABLE officer DROP COLUMN pid;

-- ตรวจสอบผล
SELECT id, username, full_name, pid_hash FROM officer WHERE pid_hash IS NOT NULL;
