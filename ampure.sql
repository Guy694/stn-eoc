-- สร้างตารางสำหรับเก็บข้อมูลอำเภอในจังหวัดสตูล
-- Create table for storing district (amphoe) data in Satun province
-- ใช้ GEOMETRY type สำหรับเก็บ GeoJSON coordinates

-- ลบตารางเก่าถ้ามี (เพื่อสร้างใหม่ด้วย structure ใหม่)
DROP TABLE IF EXISTS `districts`;

CREATE TABLE `districts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dis_name` VARCHAR(255) NOT NULL COMMENT 'ชื่ออำเภอ',
  `pro_name` VARCHAR(255) NOT NULL COMMENT 'ชื่อจังหวัด',
  `dis_code` VARCHAR(10) NOT NULL COMMENT 'รหัสอำเภอ',
  `pro_code` VARCHAR(10) NOT NULL COMMENT 'รหัสจังหวัด',
  `geometry` GEOMETRY NOT NULL COMMENT 'ข้อมูล Geometry (MultiPolygon)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_district` (`dis_code`, `pro_code`),
  SPATIAL INDEX `idx_geometry` (`geometry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== INSERT ข้อมูลอำเภอ =====
-- ใช้ ST_GeomFromGeoJSON() เพื่อแปลง GeoJSON เป็น GEOMETRY
-- หรือใช้ ST_GeomFromText() สำหรับ WKT format

-- ตัวอย่างการ INSERT (ต้องใส่ข้อมูล coordinates จริง)
-- เมืองสตูล, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('เมืองสตูล', 'สตูล', '01', '91', 
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ควนโดน, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนโดน', 'สตูล', '02', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ควนกาหลง, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนกาหลง', 'สตูล', '03', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ท่าแพ, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('ท่าแพ', 'สตูล', '04', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ละงู, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('ละงู', 'สตูล', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ทุ่งหว้า, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('ทุ่งหว้า', 'สตูล', '06', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- มะนัง, สตูล
INSERT INTO `districts` (`dis_name`, `pro_name`, `dis_code`, `pro_code`, `geometry`) VALUES
('มะนัง', 'สตูล', '07', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- สร้าง index เพื่อความเร็วในการค้นหา
CREATE INDEX idx_dis_name ON districts(dis_name);
CREATE INDEX idx_pro_name ON districts(pro_name);
CREATE INDEX idx_dis_code ON districts(dis_code);
CREATE INDEX idx_pro_code ON districts(pro_code);

-- ===== วิธีใช้งาน =====
-- การดึงข้อมูล geometry เป็น GeoJSON:
-- SELECT dis_name, ST_AsGeoJSON(geometry) as geojson FROM districts;

-- การดึง GeoJSON แบบเต็ม (รวม properties):
-- SELECT JSON_OBJECT(
--   'type', 'Feature',
--   'properties', JSON_OBJECT(
--     'dis_name', dis_name,
--     'pro_name', pro_name,
--     'dis_code', dis_code,
--     'pro_code', pro_code
--   ),
--   'geometry', JSON_EXTRACT(ST_AsGeoJSON(geometry), '$')
-- ) as feature FROM districts;

-- ข้อมูลสรุป
-- Total districts: 7
-- 1. เมืองสตูล (01)
-- 2. ควนโดน (02)
-- 3. ควนกาหลง (03)
-- 4. ท่าแพ (04)
-- 5. ละงู (05)
-- 6. ทุ่งหว้า (06)
-- 7. มะนัง (07)
