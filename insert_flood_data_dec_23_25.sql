-- เพิ่มข้อมูลน้ำท่วมวันที่ 23-25 ธันวาคม 2568
-- สำหรับ EOC Session ที่ active (id=27)
-- ใช้ตาราง flood_records

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- วันที่ 23 ธันวาคม 2025
INSERT INTO flood_records (year, district, tambon, village, flood_level, flood_start_date, flood_end_date, 
    water_depth_cm, affected_households, affected_people, description, status, created_by) VALUES
(2025, 'เมืองสตูล', 'พิมาน', 'บ้านควน', 'ต่ำ', '2025-12-18', NULL, 22, 35, 140, 'น้ำลดเกือบหมด - วันที่ 23 ธ.ค.', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', 'ไม่มี', '2025-12-18', '2025-12-23', 12, 25, 100, 'น้ำลดแล้ว เริ่มทำความสะอาด', 'เสร็จสิ้น', 'admin'),
(2025, 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', 'ปานกลาง', '2025-12-18', NULL, 38, 75, 300, 'น้ำลดช้าๆ', 'กำลังดำเนินการ', 'admin'),
(2025, 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', 'ต่ำ', '2025-12-18', NULL, 25, 48, 192, 'สถานการณ์ดีขึ้นเรื่อยๆ', 'กำลังดำเนินการ', 'admin'),
(2025, 'ละงู', 'ละงู', 'บ้านละงู', 'ไม่มี', '2025-12-18', '2025-12-23', 15, 30, 120, 'น้ำเกือบหมดแล้ว', 'เสร็จสิ้น', 'admin'),
(2025, 'มะนัง', 'มะนัง', 'บ้านมะนัง', 'ไม่มี', '2025-12-18', '2025-12-23', 5, 8, 32, 'กลับสู่ปกติแล้ว', 'เสร็จสิ้น', 'admin')
ON DUPLICATE KEY UPDATE 
    flood_level = VALUES(flood_level),
    water_depth_cm = VALUES(water_depth_cm),
    affected_households = VALUES(affected_households),
    affected_people = VALUES(affected_people),
    description = VALUES(description),
    status = VALUES(status),
    updated_at = CURRENT_TIMESTAMP;

-- วันที่ 24 ธันวาคม 2025 (วันพุธ) - อัพเดทข้อมูล
UPDATE flood_records SET 
    flood_level = 'ไม่มี',
    flood_end_date = '2025-12-24',
    water_depth_cm = 10,
    affected_households = 20,
    affected_people = 80,
    description = 'น้ำลดหมดแล้ว กำลังทำความสะอาด - วันที่ 24 ธ.ค.',
    status = 'เสร็จสิ้น',
    updated_at = CURRENT_TIMESTAMP
WHERE year = 2025 AND district = 'เมืองสตูล' AND tambon = 'พิมาน' AND village = 'บ้านควน';

UPDATE flood_records SET 
    flood_level = 'ต่ำ',
    water_depth_cm = 28,
    affected_households = 58,
    affected_people = 232,
    description = 'น้ำลดเป็นปกติ - วันที่ 24 ธ.ค.',
    status = 'กำลังดำเนินการ',
    updated_at = CURRENT_TIMESTAMP
WHERE year = 2025 AND district = 'ควนโดน' AND tambon = 'ควนโดน' AND village = 'บ้านควนโดน';

-- วันที่ 25 ธันวาคม 2025 (วันนี้ - วันพฤหัสบดี) - อัพเดทข้อมูล
UPDATE flood_records SET 
    flood_level = 'ไม่มี',
    flood_end_date = '2025-12-25',
    water_depth_cm = 5,
    affected_households = 8,
    affected_people = 32,
    description = 'กลับสู่สภาวะปกติแล้ว - วันที่ 25 ธ.ค.',
    status = 'เสร็จสิ้น',
    updated_at = CURRENT_TIMESTAMP
WHERE year = 2025 AND district = 'เมืองสตูล' AND tambon = 'พิมาน' AND village = 'บ้านควน';

UPDATE flood_records SET 
    flood_level = 'ต่ำ',
    water_depth_cm = 18,
    affected_households = 42,
    affected_people = 168,
    description = 'น้ำเหลือเล็กน้อย คาดว่าจะหมดในอีก 1-2 วัน - วันที่ 25 ธ.ค.',
    status = 'กำลังดำเนินการ',
    updated_at = CURRENT_TIMESTAMP
WHERE year = 2025 AND district = 'ควนโดน' AND tambon = 'ควนโดน' AND village = 'บ้านควนโดน';

-- แสดงข้อมูลที่เพิ่ม/แก้ไข
SELECT 
    district as 'อำเภอ',
    tambon as 'ตำบล',
    village as 'หมู่บ้าน',
    flood_level as 'ระดับน้ำท่วม',
    water_depth_cm as 'ความลึก (ซม.)',
    affected_households as 'ครัวเรือน',
    affected_people as 'ประชากร',
    status as 'สถานะ',
    updated_at as 'อัพเดท'
FROM flood_records
WHERE year = 2025 AND updated_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY district, tambon;

SELECT 'เพิ่มข้อมูลสำเร็จ - วันที่ 23-25 ธันวาคม 2568' as status;

-- วันที่ 23 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'mild', 'low_risk', 0.22, 35, 140, '2025-12-23', 1, 'น้ำลดเกือบหมด'),
(2, @session_id, 'safe', 'safe', 0.12, 25, 100, '2025-12-23', 1, 'น้ำลดแล้ว เริ่มทำความสะอาด'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ'),
(50, @session_id, 'moderate', 'medium_risk', 0.38, 75, 300, '2025-12-23', 2, 'น้ำลดช้าๆ'),
(51, @session_id, 'mild', 'low_risk', 0.25, 48, 192, '2025-12-23', 2, 'สถานการณ์ดีขึ้นเรื่อยๆ'),
(52, @session_id, 'safe', 'safe', 0.15, 30, 120, '2025-12-23', 3, 'น้ำเกือบหมดแล้ว'),
(100, @session_id, 'safe', 'safe', 0.05, 8, 32, '2025-12-23', 3, 'กลับสู่ปกติแล้ว'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ');

-- วันที่ 24 ธันวาคม 2025 (วันพุธ)
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'safe', 'safe', 0.10, 20, 80, '2025-12-24', 1, 'น้ำลดหมดแล้ว กำลังทำความสะอาด'),
(2, @session_id, 'safe', 'safe', 0.05, 12, 48, '2025-12-24', 1, 'กลับสู่ปกติแล้ว'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-24', 1, 'ปกติ'),
(50, @session_id, 'mild', 'low_risk', 0.28, 58, 232, '2025-12-24', 2, 'น้ำลดเป็นปกติ'),
(51, @session_id, 'safe', 'safe', 0.15, 32, 128, '2025-12-24', 2, 'สถานการณ์กลับเป็นปกติ'),
(52, @session_id, 'safe', 'safe', 0.08, 18, 72, '2025-12-24', 3, 'น้ำลดหมดแล้ว'),
(100, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-24', 3, 'กลับสู่ปกติเรียบร้อย'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-24', 1, 'ปกติ');

-- วันที่ 25 ธันวาคม 2025 (วันนี้ - วันพฤหัสบดี)
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'safe', 'safe', 0.05, 8, 32, '2025-12-25', 1, 'กลับสู่สภาวะปกติแล้ว'),
(2, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-25', 1, 'สภาวะปกติ'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-25', 1, 'ปกติ'),
(50, @session_id, 'mild', 'low_risk', 0.18, 42, 168, '2025-12-25', 2, 'น้ำเหลือเล็กน้อย คาดว่าจะหมดในอีก 1-2 วัน'),
(51, @session_id, 'safe', 'safe', 0.08, 15, 60, '2025-12-25', 2, 'สภาวะเกือบปกติแล้ว'),
(52, @session_id, 'safe', 'safe', 0.03, 8, 32, '2025-12-25', 3, 'กลับสู่ปกติแล้ว'),
(100, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-25', 3, 'สภาวะปกติ'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-25', 1, 'ปกติ');

-- อัพเดทสถิติ EOC Session
UPDATE eoc_sessions 
SET 
    total_data_entries = (SELECT COUNT(*) FROM flood_area_status WHERE session_id = @session_id),
    summary = 'สถานการณ์น้ำท่วมดีขึ้นอย่างต่อเนื่อง พื้นที่ส่วนใหญ่กลับสู่ปกติแล้ว เหลือเพียงบางพื้นที่ที่ยังมีน้ำขังเล็กน้อย'
WHERE id = @session_id;

-- เพิ่ม Activity Logs สำหรับวันที่ 23-25
INSERT INTO activity_logs (eoc_session_id, activity_type, description, created_by, activity_time) VALUES
(@session_id, 'assessment', 'สำรวจและประเมินความเสียหายในพื้นที่ - วันที่ 23 ธ.ค.', 1, '2025-12-23 10:00:00'),
(@session_id, 'report', 'รายงานสถานการณ์ประจำวัน วันที่ 23 ธันวาคม', 1, '2025-12-23 17:00:00'),
(@session_id, 'assessment', 'ตรวจสอบพื้นที่น้ำท่วม - วันที่ 24 ธ.ค.', 2, '2025-12-24 09:30:00'),
(@session_id, 'report', 'รายงานสถานการณ์ประจำวัน วันที่ 24 ธันวาคม (วันพุธ)', 1, '2025-12-24 16:00:00'),
(@session_id, 'meeting', 'ประชุมคณะทำงาน EOC ประจำวัน', 1, '2025-12-25 09:00:00'),
(@session_id, 'assessment', 'ติดตามสถานการณ์พื้นที่น้ำท่วม - วันที่ 25 ธ.ค.', 2, '2025-12-25 11:00:00'),
(@session_id, 'report', 'รายงานสถานการณ์ประจำวัน วันที่ 25 ธันวาคม (วันนี้)', 1, '2025-12-25 16:30:00');

-- แสดงข้อมูลที่เพิ่มเข้าไป
SELECT 
    recorded_day as 'วันที่',
    COUNT(*) as 'จำนวนพื้นที่',
    SUM(affected_households) as 'ครัวเรือนรวม',
    SUM(affected_population) as 'ประชากรรวม',
    AVG(water_level) as 'ระดับน้ำเฉลี่ย (เมตร)'
FROM flood_area_status
WHERE recorded_day IN ('2025-12-23', '2025-12-24', '2025-12-25')
GROUP BY recorded_day
ORDER BY recorded_day;

SELECT 'เพิ่มข้อมูลสำเร็จ - วันที่ 23-25 ธันวาคม 2568' as status;
('2025-12-23', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'mild', 22, 35, 140, 'mild', 'improving', 'น้ำลดเกือบหมด', 1, 6.6238, 99.8181),
('2025-12-23', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'safe', 12, 25, 100, 'mild', 'recovering', 'น้ำลดแล้ว เริ่มทำความสะอาด', 1, 6.6410, 99.8392),
('2025-12-23', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'moderate', 38, 75, 300, 'moderate', 'improving', 'น้ำลดช้าๆ', 2, 6.8142, 99.7431),
('2025-12-23', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'mild', 25, 48, 192, 'mild', 'improving', 'สถานการณ์ดีขึ้นเรื่อยๆ', 2, 6.9456, 99.8721),
('2025-12-23', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'safe', 15, 30, 120, 'mild', 'recovering', 'น้ำเกือบหมดแล้ว', 3, 6.8735, 99.7825),
('2025-12-23', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'safe', 5, 8, 32, 'mild', 'recovering', 'กลับสู่ปกติแล้ว', 3, 6.6982, 99.9234);

-- วันที่ 24 ธันวาคม 2025 (วันพุธ)
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-24', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'safe', 10, 20, 80, 'mild', 'recovering', 'น้ำลดหมดแล้ว กำลังทำความสะอาด', 1, 6.6238, 99.8181),
('2025-12-24', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'safe', 5, 12, 48, 'mild', 'recovering', 'กลับสู่ปกติแล้ว', 1, 6.6410, 99.8392),
('2025-12-24', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'mild', 28, 58, 232, 'mild', 'improving', 'น้ำลดเป็นปกติ', 2, 6.8142, 99.7431),
('2025-12-24', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'safe', 15, 32, 128, 'mild', 'recovering', 'สถานการณ์กลับเป็นปกติ', 2, 6.9456, 99.8721),
('2025-12-24', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'safe', 8, 18, 72, 'mild', 'recovering', 'น้ำลดหมดแล้ว', 3, 6.8735, 99.7825),
('2025-12-24', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'safe', 0, 0, 0, 'safe', 'normal', 'กลับสู่ปกติเรียบร้อย', 3, 6.6982, 99.9234);

-- วันที่ 25 ธันวาคม 2025 (วันนี้ - วันพฤหัสบดี)
INSERT INTO daily_village_flood (record_date, district, tambon, village, village_code, flood_level, water_level_cm, affected_households, affected_population, severity_level, status, notes, recorded_by, lat, lng) VALUES
('2025-12-25', 'เมืองสตูล', 'พิมาน', 'บ้านควน', '91010101', 'safe', 5, 8, 32, 'safe', 'normal', 'กลับสู่สภาวะปกติแล้ว', 1, 6.6238, 99.8181),
('2025-12-25', 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', '91010201', 'safe', 0, 0, 0, 'safe', 'normal', 'สภาวะปกติ', 1, 6.6410, 99.8392),
('2025-12-25', 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', '91020101', 'mild', 18, 42, 168, 'mild', 'improving', 'น้ำเหลือเล็กน้อย คาดว่าจะหมดในอีก 1-2 วัน', 2, 6.8142, 99.7431),
('2025-12-25', 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', '91030101', 'safe', 8, 15, 60, 'safe', 'recovering', 'สภาวะเกือบปกติแล้ว', 2, 6.9456, 99.8721),
('2025-12-25', 'ละงู', 'ละงู', 'บ้านละงู', '91040101', 'safe', 3, 8, 32, 'safe', 'normal', 'กลับสู่ปกติแล้ว', 3, 6.8735, 99.7825),
('2025-12-25', 'มะนัง', 'มะนัง', 'บ้านมะนัง', '91050101', 'safe', 0, 0, 0, 'safe', 'normal', 'สภาวะปกติ', 3, 6.6982, 99.9234);

-- อัพเดทสถิติ EOC Session
UPDATE eoc_sessions 
SET 
    total_data_entries = 207,
    summary = 'สถานการณ์น้ำท่วมดีขึ้นอย่างต่อเนื่อง พื้นที่ส่วนใหญ่กลับสู่ปกติแล้ว เหลือเพียงบางพื้นที่ที่ยังมีน้ำขังเล็กน้อย'
WHERE id = (SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active' LIMIT 1);

-- เพิ่ม Activity Logs สำหรับวันที่ 23-25
SET @session_id = (SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active' LIMIT 1);

INSERT INTO activity_logs (eoc_session_id, activity_type, description, created_by, activity_time) VALUES
(@session_id, 'assessment', 'สำรวจและประเมินความเสียหายในพื้นที่ - วันที่ 23 ธ.ค.', 1, '2025-12-23 10:00:00'),
(@session_id, 'report', 'รายงานสถานการณ์ประจำวัน วันที่ 23 ธันวาคม', 1, '2025-12-23 17:00:00'),
(@session_id, 'assessment', 'ตรวจสอบพื้นที่น้ำท่วม - วันที่ 24 ธ.ค.', 2, '2025-12-24 09:30:00'),
(@session_id, 'report', 'รายงานสถานการณ์ประจำวัน วันที่ 24 ธันวาคม (วันพุธ)', 1, '2025-12-24 16:00:00'),
(@session_id, 'meeting', 'ประชุมคณะทำงาน EOC ประจำวัน', 1, '2025-12-25 09:00:00'),
(@session_id, 'assessment', 'ติดตามสถานการณ์พื้นที่น้ำท่วม - วันที่ 25 ธ.ค.', 2, '2025-12-25 11:00:00'),
(@session_id, 'report', 'รายงานสถานการณ์ประจำวัน วันที่ 25 ธันวาคม (วันนี้)', 1, '2025-12-25 16:30:00');

-- แสดงข้อมูลที่เพิ่มเข้าไป
SELECT 
    record_date as 'วันที่',
    COUNT(*) as 'จำนวนหมู่บ้าน',
    SUM(affected_households) as 'ครัวเรือนรวม',
    SUM(affected_population) as 'ประชากรรวม',
    AVG(water_level_cm) as 'ระดับน้ำเฉลี่ย (ซม.)'
FROM daily_village_flood
WHERE record_date IN ('2025-12-23', '2025-12-24', '2025-12-25')
GROUP BY record_date
ORDER BY record_date;

SELECT 'เพิ่มข้อมูลสำเร็จ - วันที่ 23-25 ธันวาคม 2568' as status;
