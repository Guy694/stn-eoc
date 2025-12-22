-- ตรวจสอบและเตรียมข้อมูลทดสอบ EOC น้ำท่วม 2025
-- วันที่: 22 ธันวาคม 2568

-- ===============================================
-- 1. ตรวจสอบ EOC ที่เปิดอยู่
-- ===============================================
SELECT 
    id, 
    eoc_type, 
    session_number, 
    opened_at, 
    status 
FROM eoc_sessions 
WHERE eoc_type = 'flood' AND status = 'active';

-- ===============================================
-- 2. ปิด EOC flood ที่เปิดอยู่ (ถ้ามี)
-- ===============================================
UPDATE eoc_sessions 
SET 
    status = 'closed',
    closed_at = NOW(),
    closed_by = 1,
    close_reason = 'ปิดเพื่อทดสอบระบบใหม่',
    duration_hours = TIMESTAMPDIFF(HOUR, opened_at, NOW())
WHERE eoc_type = 'flood' AND status = 'active';

-- ===============================================
-- 3. ลบข้อมูลทดสอบเก่า (ถ้ามี)
-- ===============================================
DELETE FROM activity_logs WHERE eoc_session_id IN (
    SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND YEAR(opened_at) = 2025
);

DELETE FROM daily_village_flood WHERE record_date >= '2025-12-18';

DELETE FROM eoc_sessions WHERE eoc_type = 'flood' AND YEAR(opened_at) = 2025;

-- ===============================================
-- 4. เพิ่ม EOC Sessions สำหรับปี 2025
-- ===============================================

-- Session 1/2025 (ปิดแล้ว)
INSERT INTO eoc_sessions (
    eoc_type, session_number, opened_at, opened_by, open_reason,
    closed_at, closed_by, close_reason, duration_hours, status,
    total_activities, total_data_entries, affected_areas, summary
) VALUES (
    'flood', 1, '2025-01-15 08:00:00', 1, 
    'ฝนตกหนักต่อเนื่องในพื้นที่จังหวัดสตูล ทำให้น้ำในลำห้วยล้นตลิ่ง',
    '2025-02-10 18:00:00', 1, 'สถานการณ์คลี่คลาย น้ำลดลง พื้นที่กลับสู่สภาวะปกติ',
    634.0, 'closed', 89, 456,
    '{"districts": ["เมืองสตูล", "ควนโดน", "ท่าแพ"], "tambons": 15, "villages": 45}',
    'น้ำท่วมขังในพื้นที่ 3 อำเภอ ส่งผลกระทบต่อประชากร 12,500 คน ระยะเวลา 26 วัน'
);

-- Session 2/2025 (ปิดแล้ว)
INSERT INTO eoc_sessions (
    eoc_type, session_number, opened_at, opened_by, open_reason,
    closed_at, closed_by, close_reason, duration_hours, status,
    total_activities, total_data_entries, affected_areas, summary
) VALUES (
    'flood', 2, '2025-06-20 14:30:00', 2,
    'พายุโซนร้อนเคลื่อนผ่าน ทำให้เกิดฝนตกหนัก',
    '2025-07-05 16:00:00', 2, 'พายุผ่านไปแล้ว สถานการณ์กลับสู่ปกติ',
    361.5, 'closed', 67, 321,
    '{"districts": ["เมืองสตูล", "ละงู", "ทุ่งหว้า"], "tambons": 12, "villages": 38}',
    'น้ำท่วมจากพายุ ส่งผลกระทบ 9,800 คน ระยะเวลา 15 วัน'
);

-- Session 3/2025 (กำลังเปิดอยู่)
INSERT INTO eoc_sessions (
    eoc_type, session_number, opened_at, opened_by, open_reason,
    closed_at, closed_by, close_reason, duration_hours, status,
    total_activities, total_data_entries, affected_areas, summary
) VALUES (
    'flood', 3, '2025-12-18 09:00:00', 1,
    'ฝนตกหนักต่อเนื่องตามฤดูมรสุมตะวันออกเฉียงเหนือ ทำให้เกิดน้ำท่วมฉับพลันในหลายพื้นที่',
    NULL, NULL, NULL, NULL, 'active',
    23, 187,
    '{"districts": ["เมืองสตูล", "ควนโดน", "ท่าแพ", "ละงู", "มะนัง"], "tambons": 18, "villages": 52}',
    'สถานการณ์น้ำท่วมปัจจุบัน ประชากรได้รับผลกระทบประมาณ 15,200 คน ยังคงติดตามสถานการณ์'
);

-- ===============================================
-- 5. เพิ่มข้อมูลน้ำท่วมรายวัน (18-22 ธ.ค. 2568)
-- ===============================================

-- วันที่ 18 ธันวาคม 2025
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-18', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'moderate', 35, 45, 180, 'moderate', 'active', 'น้ำเริ่มท่วมบริเวณถนนสายหลัก', 1, 6.6238, 99.8181),
('2025-12-18', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'mild', 20, 32, 128, 'mild', 'active', 'น้ำขังในพื้นที่เล็กน้อย', 1, 6.6410, 99.8392),
('2025-12-18', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'severe', 55, 78, 312, 'severe', 'active', 'น้ำท่วมสูงในชุมชน ต้องอพยพ', 2, 6.8142, 99.7431),
('2025-12-18', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'moderate', 40, 56, 224, 'moderate', 'active', 'น้ำท่วมขังบริเวณตลาด', 2, 6.9456, 99.8721),
('2025-12-18', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'mild', 25, 41, 164, 'mild', 'active', 'น้ำเริ่มสูงขึ้น', 3, 6.8735, 99.7825);

-- วันที่ 19 ธันวาคม 2025
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-19', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'severe', 50, 52, 208, 'severe', 'active', 'น้ำสูงขึ้นต่อเนื่อง', 1, 6.6238, 99.8181),
('2025-12-19', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'moderate', 38, 45, 180, 'moderate', 'active', 'น้ำขังมากขึ้น', 1, 6.6410, 99.8392),
('2025-12-19', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'severe', 68, 85, 340, 'severe', 'active', 'สถานการณ์รุนแรงขึ้น อพยพเพิ่ม', 2, 6.8142, 99.7431),
('2025-12-19', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'severe', 52, 63, 252, 'severe', 'active', 'น้ำท่วมขยายพื้นที่', 2, 6.9456, 99.8721),
('2025-12-19', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'moderate', 35, 48, 192, 'moderate', 'active', 'น้ำสูงขึ้น', 3, 6.8735, 99.7825),
('2025-12-19', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'mild', 22, 35, 140, 'mild', 'active', 'เริ่มมีน้ำท่วม', 3, 6.6982, 99.9234);

-- วันที่ 20 ธันวาคม 2025
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-20', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'severe', 62, 58, 232, 'severe', 'active', 'จุดสูงสุด', 1, 6.6238, 99.8181),
('2025-12-20', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'severe', 45, 51, 204, 'severe', 'active', 'น้ำท่วมรุนแรงขึ้น', 1, 6.6410, 99.8392),
('2025-12-20', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'severe', 75, 92, 368, 'severe', 'active', 'สถานการณ์วิกฤต', 2, 6.8142, 99.7431),
('2025-12-20', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'severe', 58, 68, 272, 'severe', 'active', 'น้ำท่วมหนัก', 2, 6.9456, 99.8721),
('2025-12-20', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'moderate', 42, 55, 220, 'moderate', 'active', 'ระดับน้ำคงที่', 3, 6.8735, 99.7825),
('2025-12-20', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'moderate', 38, 42, 168, 'moderate', 'active', 'น้ำสูงขึ้น', 3, 6.6982, 99.9234),
('2025-12-20', 'เมืองสตูล', 'ตันหยงโป', 'บ้านตันหยงโป', '91010301', 'mild', 28, 38, 152, 'mild', 'active', 'พื้นที่ใหม่ที่ได้รับผลกระทบ', 1, 6.6102, 99.7956);

-- วันที่ 21 ธันวาคม 2025
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-21', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'moderate', 48, 58, 232, 'moderate', 'improving', 'น้ำเริ่มลด', 1, 6.6238, 99.8181),
('2025-12-21', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'moderate', 38, 51, 204, 'moderate', 'improving', 'น้ำลดลงบ้างแล้ว', 1, 6.6410, 99.8392),
('2025-12-21', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'severe', 65, 92, 368, 'severe', 'active', 'ยังคงวิกฤต', 2, 6.8142, 99.7431),
('2025-12-21', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'moderate', 45, 68, 272, 'moderate', 'improving', 'น้ำลดช้าๆ', 2, 6.9456, 99.8721),
('2025-12-21', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'moderate', 35, 55, 220, 'moderate', 'improving', 'ระดับน้ำลดลง', 3, 6.8735, 99.7825),
('2025-12-21', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'mild', 30, 42, 168, 'mild', 'improving', 'น้ำเริ่มลด', 3, 6.6982, 99.9234),
('2025-12-21', 'เมืองสตูล', 'ตันหยงโป', 'บ้านตันหยงโป', '91010301', 'mild', 20, 38, 152, 'mild', 'improving', 'น้ำลดเร็ว', 1, 6.6102, 99.7956);

-- วันที่ 22 ธันวาคม 2025 (วันนี้)
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-22', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'mild', 32, 48, 192, 'mild', 'improving', 'น้ำลดต่อเนื่อง สถานการณ์ดีขึ้น', 1, 6.6238, 99.8181),
('2025-12-22', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'mild', 25, 42, 168, 'mild', 'improving', 'น้ำลดเกือบหมด', 1, 6.6410, 99.8392),
('2025-12-22', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'moderate', 52, 85, 340, 'moderate', 'active', 'ยังคงต้องติดตาม', 2, 6.8142, 99.7431),
('2025-12-22', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'mild', 35, 58, 232, 'mild', 'improving', 'สถานการณ์คลี่คลาย', 2, 6.9456, 99.8721),
('2025-12-22', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'mild', 22, 45, 180, 'mild', 'improving', 'น้ำลดเกือบหมด', 3, 6.8735, 99.7825),
('2025-12-22', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'safe', 8, 15, 60, 'mild', 'recovering', 'น้ำลดแล้ว เริ่มทำความสะอาด', 3, 6.6982, 99.9234),
('2025-12-22', 'เมืองสตูล', 'ตันหยงโป', 'บ้านตันหยงโป', '91010301', 'safe', 5, 10, 40, 'mild', 'recovering', 'กลับสู่ปกติแล้ว', 1, 6.6102, 99.7956);

-- ===============================================
-- 6. อัพเดทสถิติ EOC Session
-- ===============================================
UPDATE eoc_sessions 
SET 
    duration_hours = TIMESTAMPDIFF(HOUR, opened_at, NOW())
WHERE id = (SELECT MAX(id) FROM (SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active') AS t);

-- แสดงสรุปข้อมูลที่เพิ่ม
SELECT 'EOC Sessions ปี 2025:' AS summary;
SELECT id, session_number, opened_at, closed_at, status, total_data_entries 
FROM eoc_sessions 
WHERE eoc_type = 'flood' AND YEAR(opened_at) = 2025 
ORDER BY session_number;

SELECT 'ข้อมูลน้ำท่วมวันที่ 22 ธ.ค. 2568:' AS summary;
SELECT district, tambon, village, flood_level, water_level_cm, affected_population, status
FROM daily_village_flood
WHERE record_date = '2025-12-22'
ORDER BY flood_level DESC, district;

SELECT 'สรุปความเสี่ยงวันนี้:' AS summary;
SELECT 
    flood_level,
    COUNT(*) AS จำนวนหมู่บ้าน,
    SUM(affected_households) AS ครัวเรือนรวม,
    SUM(affected_population) AS ประชากรรวม
FROM daily_village_flood
WHERE record_date = '2025-12-22'
GROUP BY flood_level
ORDER BY FIELD(flood_level, 'severe', 'moderate', 'mild', 'safe');
