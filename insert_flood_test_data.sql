-- ===============================================
-- Insert Test Data: flood_area_status + EOC Session
-- ===============================================

-- ตรวจสอบว่ามี EOC Session #3 หรือยัง (ควรมีจากการทดสอบครั้งก่อน)
-- ถ้าไม่มีให้สร้างใหม่

-- ดึง session_id ที่ active (Session #3)
SET @session_id = (SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active' ORDER BY opened_at DESC LIMIT 1);

-- ถ้าไม่มี session ให้สร้างใหม่
INSERT INTO eoc_sessions (session_number, eoc_type, opened_at, opened_by, status, open_reason)
SELECT 3, 'flood', '2025-12-18 08:00:00', 1, 'active', 'น้ำท่วมหนักในหลายพื้นที่ เปิด EOC เพื่อติดตามสถานการณ์'
WHERE NOT EXISTS (SELECT 1 FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active');

SET @session_id = (SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active' ORDER BY opened_at DESC LIMIT 1);

-- ข้อมูลทดสอบ: น้ำท่วมในอำเภอเมืองสตูล, ละงู, ทุ่งหว้า
-- ใช้ village id จาก satun_village_polygon

-- วันที่ 18 ธันวาคม 2025 - เริ่มน้ำท่วม
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
-- อำเภอเมืองสตูล (สมมติ vid 1-10)
(1, @session_id, 'moderate', 'medium_risk', 0.8, 25, 100, '2025-12-18', 1, 'น้ำเริ่มท่วมบริเวณถนน'),
(2, @session_id, 'mild', 'low_risk', 0.3, 10, 40, '2025-12-18', 1, 'น้ำขังเล็กน้อย'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-18', 1, 'ปกติ'),

-- อำเภอละงู (สมมติ vid 50-60)
(50, @session_id, 'severe', 'severe_risk', 1.8, 80, 350, '2025-12-18', 1, 'น้ำท่วมหนัก อพยพประชาชน'),
(51, @session_id, 'moderate', 'high_risk', 1.2, 45, 180, '2025-12-18', 1, 'น้ำท่วมสูงขึ้น'),
(52, @session_id, 'mild', 'medium_risk', 0.5, 20, 80, '2025-12-18', 1, 'ระดับน้ำเพิ่มขึ้น'),

-- อำเภอทุ่งหว้า (สมมติ vid 100-110)
(100, @session_id, 'moderate', 'medium_risk', 0.9, 30, 120, '2025-12-18', 1, 'น้ำท่วมปานกลาง'),
(101, @session_id, 'mild', 'low_risk', 0.4, 15, 60, '2025-12-18', 1, 'น้ำขังบางจุด');

-- วันที่ 19 ธันวาคม 2025 - สถานการณ์แย่ลง
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'severe', 'high_risk', 1.5, 45, 180, '2025-12-19', 1, 'น้ำท่วมสูงขึ้นมาก'),
(2, @session_id, 'moderate', 'medium_risk', 0.7, 20, 80, '2025-12-19', 1, 'สถานการณ์แย่ลง'),
(3, @session_id, 'mild', 'low_risk', 0.2, 5, 20, '2025-12-19', 1, 'เริ่มมีน้ำขัง'),
(50, @session_id, 'severe', 'severe_risk', 2.2, 100, 450, '2025-12-19', 1, 'สถานการณ์วิกฤต'),
(51, @session_id, 'severe', 'severe_risk', 1.8, 65, 260, '2025-12-19', 1, 'น้ำท่วมหนักมาก'),
(52, @session_id, 'moderate', 'high_risk', 1.0, 35, 140, '2025-12-19', 1, 'ระดับน้ำสูงขึ้น'),
(100, @session_id, 'severe', 'high_risk', 1.4, 50, 200, '2025-12-19', 1, 'สถานการณ์เลวลง'),
(101, @session_id, 'moderate', 'medium_risk', 0.8, 25, 100, '2025-12-19', 1, 'น้ำท่วมเพิ่มขึ้น');

-- วันที่ 20 ธันวาคม 2025 - คงที่
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'severe', 'high_risk', 1.5, 45, 180, '2025-12-20', 1, 'ระดับน้ำคงที่'),
(2, @session_id, 'moderate', 'medium_risk', 0.7, 20, 80, '2025-12-20', 1, 'คงที่'),
(3, @session_id, 'mild', 'low_risk', 0.2, 5, 20, '2025-12-20', 1, 'คงที่'),
(50, @session_id, 'severe', 'severe_risk', 2.1, 100, 450, '2025-12-20', 1, 'ระดับน้ำยังสูง'),
(51, @session_id, 'severe', 'severe_risk', 1.7, 65, 260, '2025-12-20', 1, 'คงที่'),
(52, @session_id, 'moderate', 'high_risk', 0.9, 35, 140, '2025-12-20', 1, 'คงที่'),
(100, @session_id, 'severe', 'high_risk', 1.3, 50, 200, '2025-12-20', 1, 'คงที่'),
(101, @session_id, 'moderate', 'medium_risk', 0.8, 25, 100, '2025-12-20', 1, 'คงที่');

-- วันที่ 21 ธันวาคม 2025 - เริ่มลดลง
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'moderate', 'medium_risk', 1.0, 35, 140, '2025-12-21', 1, 'น้ำเริ่มลด'),
(2, @session_id, 'mild', 'low_risk', 0.4, 12, 48, '2025-12-21', 1, 'น้ำลดลง'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-21', 1, 'น้ำลดหมดแล้ว'),
(50, @session_id, 'severe', 'high_risk', 1.6, 80, 350, '2025-12-21', 1, 'น้ำเริ่มลดช้าๆ'),
(51, @session_id, 'moderate', 'medium_risk', 1.2, 50, 200, '2025-12-21', 1, 'น้ำลดลง'),
(52, @session_id, 'mild', 'low_risk', 0.6, 20, 80, '2025-12-21', 1, 'น้ำลดลงมาก'),
(100, @session_id, 'moderate', 'medium_risk', 0.9, 35, 140, '2025-12-21', 1, 'น้ำลดลง'),
(101, @session_id, 'mild', 'low_risk', 0.5, 15, 60, '2025-12-21', 1, 'น้ำลดลง');

-- วันที่ 22 ธันวาคม 2025 - ดีขึ้นเรื่อยๆ
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'mild', 'low_risk', 0.5, 18, 72, '2025-12-22', 1, 'น้ำลดมาก'),
(2, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-22', 1, 'กลับสู่ปกติ'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-22', 1, 'ปกติ'),
(50, @session_id, 'moderate', 'medium_risk', 1.1, 55, 220, '2025-12-22', 1, 'น้ำลดต่อเนื่อง'),
(51, @session_id, 'mild', 'low_risk', 0.7, 30, 120, '2025-12-22', 1, 'น้ำลดมาก'),
(52, @session_id, 'safe', 'safe', 0.1, 5, 20, '2025-12-22', 1, 'เกือบหมด'),
(100, @session_id, 'mild', 'low_risk', 0.5, 20, 80, '2025-12-22', 1, 'น้ำลดมาก'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-22', 1, 'กลับสู่ปกติ');

-- วันที่ 23 ธันวาคม 2025 - วันนี้
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'กลับสู่ปกติแล้ว'),
(2, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ'),
(50, @session_id, 'mild', 'low_risk', 0.6, 25, 100, '2025-12-23', 1, 'น้ำเหลือเล็กน้อย'),
(51, @session_id, 'safe', 'safe', 0.2, 8, 32, '2025-12-23', 1, 'เกือบหมด'),
(52, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'กลับสู่ปกติ'),
(100, @session_id, 'safe', 'safe', 0.1, 3, 12, '2025-12-23', 1, 'เกือบปกติ'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ');

-- ตรวจสอบผลลัพธ์
SELECT 
    f.recorded_day,
    f.flood_level,
    COUNT(*) as village_count,
    SUM(f.affected_population) as total_population
FROM flood_area_status f
WHERE f.session_id = @session_id
GROUP BY f.recorded_day, f.flood_level
ORDER BY f.recorded_day, FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe');
