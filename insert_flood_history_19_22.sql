-- เพิ่มข้อมูลย้อนหลังให้ครบตั้งแต่วันเปิด EOC
-- จากวันที่ 24 ธ.ค. ให้ย้อนไป 5 วันก่อนหน้า (19-23 ธ.ค.)

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- วันที่ 19 ธันวาคม 2025
INSERT INTO flood_records (year, district, tambon, village, flood_level, flood_start_date, flood_end_date, 
    water_depth_cm, affected_households, affected_people, description, status, created_by) VALUES
(2025, 'เมืองสตูล', 'พิมาน', 'บ้านควน', 'สูง', '2025-12-19', NULL, 50, 52, 208, 'น้ำสูงขึ้นต่อเนื่อง - วันที่ 19 ธ.ค.', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', 'ปานกลาง', '2025-12-19', NULL, 38, 45, 180, 'น้ำขังมากขึ้น', 'กำลังดำเนินการ', 'admin'),
(2025, 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', 'สูงมาก', '2025-12-19', NULL, 68, 85, 340, 'สถานการณ์รุนแรงขึ้น อพยพเพิ่ม', 'กำลังดำเนินการ', 'admin'),
(2025, 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', 'สูง', '2025-12-19', NULL, 52, 63, 252, 'น้ำท่วมขยายพื้นที่', 'กำลังดำเนินการ', 'admin'),
(2025, 'ละงู', 'ละงู', 'บ้านละงู', 'ปานกลาง', '2025-12-19', NULL, 35, 48, 192, 'น้ำสูงขึ้น', 'กำลังดำเนินการ', 'admin'),
(2025, 'มะนัง', 'มะนัง', 'บ้านมะนัง', 'ต่ำ', '2025-12-19', NULL, 22, 35, 140, 'เริ่มมีน้ำท่วม', 'กำลังดำเนินการ', 'admin')
ON DUPLICATE KEY UPDATE 
    flood_level = VALUES(flood_level),
    water_depth_cm = VALUES(water_depth_cm),
    affected_households = VALUES(affected_households),
    affected_people = VALUES(affected_people),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- วันที่ 20 ธันวาคม 2025
INSERT INTO flood_records (year, district, tambon, village, flood_level, flood_start_date, flood_end_date, 
    water_depth_cm, affected_households, affected_people, description, status, created_by) VALUES
(2025, 'เมืองสตูล', 'พิมาน', 'บ้านควน', 'สูงมาก', '2025-12-20', NULL, 62, 58, 232, 'จุดสูงสุด - วันที่ 20 ธ.ค.', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', 'สูง', '2025-12-20', NULL, 45, 51, 204, 'น้ำท่วมรุนแรงขึ้น', 'กำลังดำเนินการ', 'admin'),
(2025, 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', 'สูงมาก', '2025-12-20', NULL, 75, 92, 368, 'สถานการณ์วิกฤต', 'กำลังดำเนินการ', 'admin'),
(2025, 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', 'สูงมาก', '2025-12-20', NULL, 58, 68, 272, 'น้ำท่วมหนัก', 'กำลังดำเนินการ', 'admin'),
(2025, 'ละงู', 'ละงู', 'บ้านละงู', 'ปานกลาง', '2025-12-20', NULL, 42, 55, 220, 'ระดับน้ำคงที่', 'กำลังดำเนินการ', 'admin'),
(2025, 'มะนัง', 'มะนัง', 'บ้านมะนัง', 'ปานกลาง', '2025-12-20', NULL, 38, 42, 168, 'น้ำสูงขึ้น', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'ตันหยงโป', 'บ้านตันหยงโป', 'ต่ำ', '2025-12-20', NULL, 28, 38, 152, 'พื้นที่ใหม่ที่ได้รับผลกระทบ', 'กำลังดำเนินการ', 'admin')
ON DUPLICATE KEY UPDATE 
    flood_level = VALUES(flood_level),
    water_depth_cm = VALUES(water_depth_cm),
    affected_households = VALUES(affected_households),
    affected_people = VALUES(affected_people),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- วันที่ 21 ธันวาคม 2025
INSERT INTO flood_records (year, district, tambon, village, flood_level, flood_start_date, flood_end_date, 
    water_depth_cm, affected_households, affected_people, description, status, created_by) VALUES
(2025, 'เมืองสตูล', 'พิมาน', 'บ้านควน', 'ปานกลาง', '2025-12-21', NULL, 48, 58, 232, 'น้ำเริ่มลด - วันที่ 21 ธ.ค.', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', 'ปานกลาง', '2025-12-21', NULL, 38, 51, 204, 'น้ำลดลงบ้างแล้ว', 'กำลังดำเนินการ', 'admin'),
(2025, 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', 'สูงมาก', '2025-12-21', NULL, 65, 92, 368, 'ยังคงวิกฤต', 'กำลังดำเนินการ', 'admin'),
(2025, 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', 'ปานกลาง', '2025-12-21', NULL, 45, 68, 272, 'น้ำลดช้าๆ', 'กำลังดำเนินการ', 'admin'),
(2025, 'ละงู', 'ละงู', 'บ้านละงู', 'ปานกลาง', '2025-12-21', NULL, 35, 55, 220, 'ระดับน้ำลดลง', 'กำลังดำเนินการ', 'admin'),
(2025, 'มะนัง', 'มะนัง', 'บ้านมะนัง', 'ต่ำ', '2025-12-21', NULL, 30, 42, 168, 'น้ำเริ่มลด', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'ตันหยงโป', 'บ้านตันหยงโป', 'ต่ำ', '2025-12-21', NULL, 20, 38, 152, 'น้ำลดเร็ว', 'กำลังดำเนินการ', 'admin')
ON DUPLICATE KEY UPDATE 
    flood_level = VALUES(flood_level),
    water_depth_cm = VALUES(water_depth_cm),
    affected_households = VALUES(affected_households),
    affected_people = VALUES(affected_people),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- วันที่ 22 ธันวาคม 2025
INSERT INTO flood_records (year, district, tambon, village, flood_level, flood_start_date, flood_end_date, 
    water_depth_cm, affected_households, affected_people, description, status, created_by) VALUES
(2025, 'เมืองสตูล', 'พิมาน', 'บ้านควน', 'ต่ำ', '2025-12-22', NULL, 32, 48, 192, 'น้ำลดต่อเนื่อง สถานการณ์ดีขึ้น - วันที่ 22 ธ.ค.', 'กำลังดำเนินการ', 'admin'),
(2025, 'เมืองสตูล', 'คลองขุด', 'บ้านคลองขุด', 'ต่ำ', '2025-12-22', NULL, 25, 42, 168, 'น้ำลดเกือบหมด', 'กำลังดำเนินการ', 'admin'),
(2025, 'ควนโดน', 'ควนโดน', 'บ้านควนโดน', 'ปานกลาง', '2025-12-22', NULL, 52, 85, 340, 'ยังคงต้องติดตาม', 'กำลังดำเนินการ', 'admin'),
(2025, 'ท่าแพ', 'ท่าแพ', 'บ้านท่าแพ', 'ต่ำ', '2025-12-22', NULL, 35, 58, 232, 'สถานการณ์คลี่คลาย', 'กำลังดำเนินการ', 'admin'),
(2025, 'ละงู', 'ละงู', 'บ้านละงู', 'ต่ำ', '2025-12-22', NULL, 22, 45, 180, 'น้ำลดเกือบหมด', 'กำลังดำเนินการ', 'admin'),
(2025, 'มะนัง', 'มะนัง', 'บ้านมะนัง', 'ไม่มี', '2025-12-22', '2025-12-22', 8, 15, 60, 'น้ำลดแล้ว เริ่มทำความสะอาด', 'เสร็จสิ้น', 'admin'),
(2025, 'เมืองสตูล', 'ตันหยงโป', 'บ้านตันหยงโป', 'ไม่มี', '2025-12-22', '2025-12-22', 5, 10, 40, 'กลับสู่ปกติแล้ว', 'เสร็จสิ้น', 'admin')
ON DUPLICATE KEY UPDATE 
    flood_level = VALUES(flood_level),
    flood_end_date = VALUES(flood_end_date),
    water_depth_cm = VALUES(water_depth_cm),
    affected_households = VALUES(affected_households),
    affected_people = VALUES(affected_people),
    description = VALUES(description),
    status = VALUES(status),
    updated_at = CURRENT_TIMESTAMP;

-- ตั้ง created_at ให้ตรงกับวันที่
UPDATE flood_records SET created_at = '2025-12-19 10:00:00' WHERE flood_start_date = '2025-12-19';
UPDATE flood_records SET created_at = '2025-12-20 10:00:00' WHERE flood_start_date = '2025-12-20';
UPDATE flood_records SET created_at = '2025-12-21 10:00:00' WHERE flood_start_date = '2025-12-21';
UPDATE flood_records SET created_at = '2025-12-22 10:00:00' WHERE flood_start_date = '2025-12-22';

-- แสดงวันที่ทั้งหมด
SELECT DISTINCT flood_start_date, COUNT(*) as records
FROM flood_records 
WHERE year = 2025
GROUP BY flood_start_date
ORDER BY flood_start_date;

SELECT 'เพิ่มข้อมูลย้อนหลัง 19-22 ธันวาคม สำเร็จ' as status;
