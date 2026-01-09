-- ปรับปรุงตาราง eoc_status เพื่อรองรับข้อมูลประเภท EOC แบบ dynamic
-- แทนการสร้างตาราง eoc_types ใหม่

-- เพิ่มฟิลด์ใหม่ลงในตาราง eoc_status
ALTER TABLE eoc_status 
ADD COLUMN IF NOT EXISTS name_th VARCHAR(100) DEFAULT NULL AFTER eoc_type,
ADD COLUMN IF NOT EXISTS name_en VARCHAR(100) DEFAULT NULL AFTER name_th,
ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '⚠️' AFTER name_en,
ADD COLUMN IF NOT EXISTS color_primary VARCHAR(20) DEFAULT 'gray' AFTER icon,
ADD COLUMN IF NOT EXISTS color_gradient VARCHAR(100) DEFAULT 'from-gray-500 to-gray-600' AFTER color_primary,
ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 AFTER color_gradient;

-- อัพเดทข้อมูลเริ่มต้นสำหรับ EOC Types ที่มีอยู่
UPDATE eoc_status SET 
    name_th = 'น้ำท่วม',
    name_en = 'Flood',
    icon = '💧',
    color_primary = 'blue',
    color_gradient = 'from-blue-500 to-blue-600',
    sort_order = 1
WHERE eoc_type = 'flood';

UPDATE eoc_status SET 
    name_th = 'ภัยแล้ง',
    name_en = 'Drought',
    icon = '🌵',
    color_primary = 'orange',
    color_gradient = 'from-orange-500 to-red-500',
    sort_order = 2
WHERE eoc_type = 'drought';

UPDATE eoc_status SET 
    name_th = 'คลื่นสึนามิ',
    name_en = 'Tsunami',
    icon = '🌊',
    color_primary = 'cyan',
    color_gradient = 'from-cyan-500 to-blue-700',
    sort_order = 3
WHERE eoc_type = 'tsunami';

UPDATE eoc_status SET 
    name_th = 'แผ่นดินไหว',
    name_en = 'Earthquake',
    icon = '🏚️',
    color_primary = 'brown',
    color_gradient = 'from-yellow-700 to-red-700',
    sort_order = 4
WHERE eoc_type = 'earthquake';

UPDATE eoc_status SET 
    name_th = 'โรคระบาด',
    name_en = 'Disease Outbreak',
    icon = '🦠',
    color_primary = 'red',
    color_gradient = 'from-red-500 to-pink-600',
    sort_order = 5
WHERE eoc_type = 'disease';

-- เพิ่ม index สำหรับ eoc_type ถ้ายังไม่มี
ALTER TABLE eoc_sessions 
ADD INDEX IF NOT EXISTS idx_eoc_sessions_type (eoc_type);

-- เพิ่ม comment ให้กับ table
ALTER TABLE eoc_status 
COMMENT = 'ตารางเก็บสถานะและข้อมูลประเภท EOC ที่รองรับในระบบ';

-- แสดงผลลัพธ์
SELECT 'อัพเดทตาราง eoc_status สำเร็จ' as status;
SELECT id, eoc_type, name_th, name_en, icon, is_active, sort_order FROM eoc_status ORDER BY sort_order;
