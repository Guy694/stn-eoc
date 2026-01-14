-- เพิ่ม column eoc_type ถ้าไม่มี (สำหรับ table ที่สร้างแล้วก่อนหน้า)
ALTER TABLE shelter_centers 
ADD COLUMN IF NOT EXISTS eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL DEFAULT 'flood' COMMENT 'ประเภท EOC' 
AFTER sheltername;

-- เพิ่ม index สำหรับ eoc_type
ALTER TABLE shelter_centers 
ADD INDEX IF NOT EXISTS idx_eoc_type (eoc_type);

-- เพิ่ม column village ถ้าไม่มี
ALTER TABLE shelter_centers
ADD COLUMN IF NOT EXISTS village VARCHAR(100) COMMENT 'หมู่บ้าน/ชุมชน'
AFTER district_name;

-- อัพเดทข้อมูลเก่าให้มี eoc_type (ถ้ามี)
UPDATE shelter_centers SET eoc_type = 'flood' WHERE eoc_type IS NULL OR eoc_type = '';
