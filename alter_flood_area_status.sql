-- ===============================================
-- Migration: ปรับปรุง flood_area_status ให้รองรับ EOC Sessions
-- ===============================================

-- 1. เพิ่มคอลัมน์ที่จำเป็น
ALTER TABLE flood_area_status 
ADD COLUMN IF NOT EXISTS session_id INT NULL COMMENT 'EOC Session ID' AFTER vid,
ADD COLUMN IF NOT EXISTS affected_households INT DEFAULT 0 COMMENT 'จำนวนครัวเรือนที่ได้รับผลกระทบ' AFTER water_level,
ADD COLUMN IF NOT EXISTS affected_population INT DEFAULT 0 COMMENT 'จำนวนประชากรที่ได้รับผลกระทบ' AFTER affected_households,
ADD COLUMN IF NOT EXISTS notes TEXT NULL COMMENT 'หมายเหตุ' AFTER recorded_by;

-- 2. เพิ่ม Index เพื่อเพิ่มประสิทธิภาพ
ALTER TABLE flood_area_status
ADD INDEX IF NOT EXISTS idx_session_date (session_id, recorded_day),
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_flood_level (flood_level),
ADD INDEX IF NOT EXISTS idx_recorded_day (recorded_day);

-- 3. ตัวอย่างการ Query ข้อมูล JOIN กัน

-- Query 1: ดึงข้อมูลน้ำท่วมพร้อมรายละเอียดหมู่บ้าน (สำหรับ Session ปัจจุบัน)
-- SELECT 
--     f.id,
--     f.vid,
--     f.flood_level,
--     f.status,
--     f.water_level,
--     f.affected_households,
--     f.affected_population,
--     f.recorded_day,
--     f.updated_at,
--     v.villcode,
--     v.villname,
--     v.subdistnam as tambon,
--     v.distname as district,
--     v.num_hh as total_households,
--     v.provname as province
-- FROM flood_area_status f
-- INNER JOIN satun_village_polygon v ON f.vid = v.id
-- WHERE f.session_id = ? AND f.recorded_day = CURDATE()
-- ORDER BY 
--     FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe'),
--     v.distname, v.subdistnam, v.villname;

-- Query 2: สรุปตามระดับความเสี่ยง
-- SELECT 
--     f.flood_level,
--     f.status,
--     COUNT(*) as village_count,
--     SUM(f.affected_households) as total_households,
--     SUM(f.affected_population) as total_population,
--     AVG(f.water_level) as avg_water_level,
--     MAX(f.water_level) as max_water_level
-- FROM flood_area_status f
-- WHERE f.session_id = ? AND f.recorded_day = ?
-- GROUP BY f.flood_level, f.status
-- ORDER BY FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe');

-- Query 3: สรุปตามอำเภอ
-- SELECT 
--     v.distname as district,
--     COUNT(DISTINCT v.subdistnam) as tambon_count,
--     COUNT(*) as village_count,
--     SUM(f.affected_households) as total_households,
--     SUM(f.affected_population) as total_population,
--     MAX(CASE WHEN f.flood_level = 'severe' THEN 1 ELSE 0 END) as has_severe,
--     MAX(CASE WHEN f.flood_level = 'moderate' THEN 1 ELSE 0 END) as has_moderate,
--     AVG(f.water_level) as avg_water_level
-- FROM flood_area_status f
-- INNER JOIN satun_village_polygon v ON f.vid = v.id
-- WHERE f.session_id = ? AND f.recorded_day = ?
-- GROUP BY v.distname
-- ORDER BY has_severe DESC, has_moderate DESC, total_population DESC;

-- Query 4: รายละเอียดทั้งหมด with GeoJSON
-- SELECT 
--     f.id,
--     v.distname as district,
--     v.subdistnam as tambon,
--     v.villname as village,
--     v.villcode as village_code,
--     f.flood_level,
--     f.status,
--     f.water_level,
--     f.affected_households,
--     f.affected_population,
--     f.notes,
--     f.updated_at,
--     ST_X(ST_Centroid(v.geom)) as lng,
--     ST_Y(ST_Centroid(v.geom)) as lat,
--     ST_AsGeoJSON(v.geom) as geometry
-- FROM flood_area_status f
-- INNER JOIN satun_village_polygon v ON f.vid = v.id
-- WHERE f.session_id = ? AND f.recorded_day = ?
-- ORDER BY 
--     FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe'),
--     v.distname, v.subdistnam, v.villname;

-- Query 5: สถิติรวมทั้งหมด
-- SELECT 
--     COUNT(DISTINCT v.distname) as affected_districts,
--     COUNT(DISTINCT CONCAT(v.distname, '-', v.subdistnam)) as affected_tambons,
--     COUNT(*) as affected_villages,
--     SUM(f.affected_households) as total_households,
--     SUM(f.affected_population) as total_population,
--     SUM(CASE WHEN f.flood_level = 'severe' THEN 1 ELSE 0 END) as severe_count,
--     SUM(CASE WHEN f.flood_level = 'moderate' THEN 1 ELSE 0 END) as moderate_count,
--     SUM(CASE WHEN f.flood_level = 'mild' THEN 1 ELSE 0 END) as mild_count,
--     SUM(CASE WHEN f.flood_level = 'safe' THEN 1 ELSE 0 END) as safe_count
-- FROM flood_area_status f
-- INNER JOIN satun_village_polygon v ON f.vid = v.id
-- WHERE f.session_id = ? AND f.recorded_day = ?;

-- Query 6: Timeline - ดูการเปลี่ยนแปลงตามวัน
-- SELECT 
--     f.recorded_day,
--     f.flood_level,
--     COUNT(*) as village_count,
--     SUM(f.affected_population) as total_population,
--     AVG(f.water_level) as avg_water_level
-- FROM flood_area_status f
-- WHERE f.session_id = ?
-- GROUP BY f.recorded_day, f.flood_level
-- ORDER BY f.recorded_day DESC, FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe');

-- Query 7: Session Summary (สำหรับ sessions-summary API)
-- SELECT 
--     s.id,
--     s.session_number,
--     s.opened_at,
--     s.closed_at,
--     s.status,
--     COUNT(DISTINCT f.vid) as affected_villages,
--     COUNT(DISTINCT v.distname) as affected_districts,
--     SUM(f.affected_population) as total_affected_population,
--     MAX(CASE WHEN f.flood_level = 'severe' THEN 1 ELSE 0 END) as has_severe
-- FROM eoc_sessions s
-- LEFT JOIN flood_area_status f ON s.id = f.session_id
-- LEFT JOIN satun_village_polygon v ON f.vid = v.id
-- WHERE s.eoc_type = 'flood' AND YEAR(s.opened_at) = ?
-- GROUP BY s.id
-- ORDER BY s.opened_at DESC;
