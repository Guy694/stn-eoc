-- อัพเดตตาราง officer เพื่อรองรับ ThaiID Login
-- เพิ่มคอลัมน์สำหรับเก็บข้อมูล ThaiID

-- 1. เพิ่มคอลัมน์เลขบัตรประชาชน (PID) - 13 หลัก
ALTER TABLE officer 
ADD COLUMN IF NOT EXISTS pid VARCHAR(13) UNIQUE COMMENT 'เลขบัตรประชาชน 13 หลัก';

-- 2. เพิ่มคอลัมน์เก็บ ThaiID Access Token
ALTER TABLE officer 
ADD COLUMN IF NOT EXISTS thaiid_token TEXT COMMENT 'ThaiID Access Token';

-- 3. เพิ่มคอลัมน์วันที่ login ล่าสุด
ALTER TABLE officer 
ADD COLUMN IF NOT EXISTS last_login DATETIME COMMENT 'วันที่เข้าสู่ระบบล่าสุด';

-- 4. เพิ่ม Index สำหรับ PID เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX IF NOT EXISTS idx_officer_pid ON officer(pid);

-- 5. ตัวอย่างการอัพเดตข้อมูล PID สำหรับผู้ใช้ที่มีอยู่แล้ว (ต้องแก้ไขตามข้อมูลจริง)
-- UPDATE officer SET pid = '1234567890123' WHERE username = 'admin';
-- UPDATE officer SET pid = '1234567890124' WHERE username = 'mcatt01';
-- UPDATE officer SET pid = '1234567890125' WHERE username = 'sat01';
-- UPDATE officer SET pid = '1234567890126' WHERE username = 'serht01';
-- UPDATE officer SET pid = '1234567890127' WHERE username = 'staff01';

-- 6. แสดงโครงสร้างตารางหลังอัพเดต
DESCRIBE officer;

-- หมายเหตุ:
-- - คอลัมน์ pid เป็น VARCHAR(13) และมี UNIQUE constraint เพื่อไม่ให้ซ้ำกัน
-- - คอลัมน์ thaiid_token เป็น TEXT เพื่อเก็บ Access Token ที่ได้จาก ThaiID
-- - คอลัมน์ last_login เก็บวันที่เข้าสู่ระบบล่าสุด
-- - ต้องอัพเดตข้อมูล PID สำหรับผู้ใช้ที่มีอยู่เพื่อให้สามารถ login ด้วย ThaiID ได้
