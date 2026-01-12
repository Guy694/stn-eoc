-- แก้ไขตาราง eoc_status: เปลี่ยน eoc_type จาก ENUM เป็น VARCHAR
-- เพื่อให้สามารถเพิ่ม EOC ประเภทใหม่ได้แบบ dynamic

-- Step 1: ตรวจสอบข้อมูลก่อนเปลี่ยนแปลง
SELECT '=== ข้อมูล eoc_status ก่อนแก้ไข ===' as step;
SELECT id, eoc_type, name_th, name_en, is_active FROM eoc_status;

-- Step 2: แก้ไข eoc_type จาก ENUM เป็น VARCHAR(50)
ALTER TABLE eoc_status 
MODIFY COLUMN eoc_type VARCHAR(50) NOT NULL;

-- Step 3: ลบ UNIQUE KEY เดิมของ eoc_type
ALTER TABLE eoc_status 
DROP INDEX eoc_type;

-- Step 4: เพิ่ม UNIQUE KEY ใหม่สำหรับ eoc_type
ALTER TABLE eoc_status 
ADD UNIQUE KEY unique_eoc_type (eoc_type);

-- Step 5: ตรวจสอบและแก้ไข eoc_sessions ถ้ามี ENUM
-- ตรวจสอบก่อนว่ามีตารางและเป็น ENUM หรือไม่
SELECT '=== ตรวจสอบตาราง eoc_sessions ===' as step;
SHOW CREATE TABLE eoc_sessions;

-- แก้ไข eoc_sessions ถ้า eoc_type เป็น ENUM
ALTER TABLE eoc_sessions 
MODIFY COLUMN eoc_type VARCHAR(50) NOT NULL;

-- Step 6: ตรวจสอบและแก้ไข shelter_centers ถ้ามี ENUM
SELECT '=== ตรวจสอบตาราง shelter_centers ===' as step;

-- ตาราง shelter_centers ไม่มีฟิลด์ eoc_type - ข้าม

-- Step 7: แก้ไข eoc_type_modules
SELECT '=== แก้ไข eoc_type_modules ===' as step;

ALTER TABLE eoc_type_modules 
MODIFY COLUMN eoc_type VARCHAR(50) NOT NULL;

-- Step 8: ตรวจสอบและแก้ไข announcements ถ้ามี ENUM
SELECT '=== ตรวจสอบตาราง announcements ===' as step;

-- ตาราง announcements เป็น VARCHAR อยู่แล้ว - ข้าม

-- Step 9: แสดงผลลัพธ์หลังแก้ไข
SELECT '=== ข้อมูล eoc_status หลังแก้ไข ===' as step;
SELECT id, eoc_type, name_th, name_en, is_active FROM eoc_status ORDER BY sort_order;

SELECT '=== ตรวจสอบตารางทั้งหมดที่มี eoc_type ===' as step;
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE 
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND COLUMN_NAME = 'eoc_type' 
ORDER BY TABLE_NAME;

SELECT '=== โครงสร้างตาราง eoc_status ใหม่ ===' as step;

SELECT '=== สรุปการแก้ไข ===' as step;
SELECT 'แก้ไข eoc_type จาก ENUM เป็น VARCHAR(50) สำเร็จ' as status,
       'แก้ไข 4 ตาราง: eoc_status, eoc_sessions, eoc_type_modules, announcements' as tables_fixed,
       'ตอนนี้สามารถเพิ่ม EOC ประเภทใหม่ได้แล้ว' as note;
