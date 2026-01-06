-- อัพเดทตาราง announcements เพื่อเพิ่มฟีลด์ eoc_type
-- สำหรับแยกประชาสัมพันธ์ตามประเภท EOC

-- 1. เพิ่ม column eoc_type (nullable ก่อน)
ALTER TABLE announcements 
ADD COLUMN eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') 
COMMENT 'ประเภท EOC ที่ใช้กับประกาศนี้' 
AFTER title;

-- 2. อัพเดทข้อมูลเดิม (ถ้ามี) ให้เป็น 'flood' เป็นค่าเริ่มต้น
UPDATE announcements 
SET eoc_type = 'flood' 
WHERE eoc_type IS NULL;

-- 3. เปลี่ยน column ให้เป็น NOT NULL
ALTER TABLE announcements 
MODIFY COLUMN eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL 
COMMENT 'ประเภท EOC ที่ใช้กับประกาศนี้';

-- 4. เพิ่ม index สำหรับ filter ประกาศตาม eoc_type
ALTER TABLE announcements 
ADD INDEX idx_eoc_type (eoc_type, is_active, show_popup);

-- 5. แสดงโครงสร้างตารางหลังอัพเดท
DESCRIBE announcements;

SELECT 'อัพเดทตาราง announcements สำเร็จ - เพิ่มฟีลด์ eoc_type แล้ว' as status;
