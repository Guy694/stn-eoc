-- =============================================
-- Festival Type Migration
-- เพิ่มคอลัมน์ festival_type ใน eoc_sessions
-- เพื่อแยกเทศกาล ปีใหม่ / สงกรานต์
-- =============================================

ALTER TABLE eoc_sessions 
ADD COLUMN festival_type ENUM('newyear', 'songkran') NULL 
COMMENT 'ประเภทเทศกาล: newyear=ปีใหม่, songkran=สงกรานต์' 
AFTER eoc_type;

-- อัพเดท session เก่า (ถ้ามี) ตาม open_reason
UPDATE eoc_sessions 
SET festival_type = 'newyear' 
WHERE eoc_type = 'accident' AND (open_reason LIKE '%ปีใหม่%' OR open_reason LIKE '%new year%');

UPDATE eoc_sessions 
SET festival_type = 'songkran' 
WHERE eoc_type = 'accident' AND (open_reason LIKE '%สงกรานต์%' OR open_reason LIKE '%songkran%');
