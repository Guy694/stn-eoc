-- แก้ไข unique constraint ใน eoc_sessions table
-- ปัญหา: constraint เดิมป้องกันไม่ให้มี (eoc_type, 'closed') ซ้ำกัน
-- แก้ไข: ใช้ generated column เพื่อให้ unique เฉพาะ status = 'active' เท่านั้น

-- 1. ลบ constraint เก่า
ALTER TABLE eoc_sessions DROP INDEX unique_active_session;

-- 2. เพิ่ม generated column ที่มีค่าเฉพาะเมื่อ status = 'active'
-- NULL จะไม่ถูกนับใน unique constraint
ALTER TABLE eoc_sessions 
ADD COLUMN active_marker VARCHAR(50) 
GENERATED ALWAYS AS (
    CASE WHEN status = 'active' THEN eoc_type ELSE NULL END
) STORED;

-- 3. สร้าง unique index บน generated column
-- จะอนุญาตให้มี closed sessions ได้หลายรายการ แต่ active ได้แค่รายการเดียวต่อ eoc_type
ALTER TABLE eoc_sessions 
ADD UNIQUE INDEX unique_active_session (active_marker);
