SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ดึง session_id ที่ active
SET @session_id = (SELECT id FROM eoc_sessions WHERE eoc_type = 'flood' AND status = 'active' ORDER BY opened_at DESC LIMIT 1);

-- วันที่ 18 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'moderate', 'medium_risk', 0.8, 25, 100, '2025-12-18', 1, 'น้ำเริ่มท่วมบริเวณถนน'),
(2, @session_id, 'mild', 'low_risk', 0.3, 10, 40, '2025-12-18', 1, 'น้ำขังเล็กน้อย'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-18', 1, 'ปกติ'),
(50, @session_id, 'severe', 'severe_risk', 1.8, 80, 350, '2025-12-18', 1, 'น้ำท่วมหนัก อพยพประชาชน'),
(51, @session_id, 'moderate', 'high_risk', 1.2, 45, 180, '2025-12-18', 1, 'น้ำท่วมสูงขึ้น'),
(52, @session_id, 'mild', 'medium_risk', 0.5, 20, 80, '2025-12-18', 1, 'ระดับน้ำเพิ่มขึ้น'),
(100, @session_id, 'moderate', 'medium_risk', 0.9, 30, 120, '2025-12-18', 1, 'น้ำท่วมปานกลาง'),
(101, @session_id, 'mild', 'low_risk', 0.4, 15, 60, '2025-12-18', 1, 'น้ำขังบางจุด');

-- วันที่ 19 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'severe', 'high_risk', 1.5, 45, 180, '2025-12-19', 1, 'น้ำท่วมสูงขึ้นมาก'),
(2, @session_id, 'moderate', 'medium_risk', 0.7, 20, 80, '2025-12-19', 1, 'สถานการณ์แย่ลง'),
(3, @session_id, 'mild', 'low_risk', 0.2, 5, 20, '2025-12-19', 1, 'เริ่มมีน้ำขัง'),
(50, @session_id, 'severe', 'severe_risk', 2.2, 100, 450, '2025-12-19', 1, 'สถานการณ์วิกฤต'),
(51, @session_id, 'severe', 'severe_risk', 1.8, 65, 260, '2025-12-19', 1, 'น้ำท่วมหนักมาก'),
(52, @session_id, 'moderate', 'high_risk', 1.0, 35, 140, '2025-12-19', 1, 'ระดับน้ำสูงขึ้น'),
(100, @session_id, 'severe', 'high_risk', 1.4, 50, 200, '2025-12-19', 1, 'สถานการณ์เลวลง'),
(101, @session_id, 'moderate', 'medium_risk', 0.8, 25, 100, '2025-12-19', 1, 'น้ำท่วมเพิ่มขึ้น');

-- วันที่ 20 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'severe', 'high_risk', 1.5, 45, 180, '2025-12-20', 1, 'ระดับน้ำคงที่'),
(2, @session_id, 'moderate', 'medium_risk', 0.7, 20, 80, '2025-12-20', 1, 'คงที่'),
(3, @session_id, 'mild', 'low_risk', 0.2, 5, 20, '2025-12-20', 1, 'คงที่'),
(50, @session_id, 'severe', 'severe_risk', 2.1, 100, 450, '2025-12-20', 1, 'ระดับน้ำยังสูง'),
(51, @session_id, 'severe', 'severe_risk', 1.7, 65, 260, '2025-12-20', 1, 'คงที่'),
(52, @session_id, 'moderate', 'high_risk', 0.9, 35, 140, '2025-12-20', 1, 'คงที่'),
(100, @session_id, 'severe', 'high_risk', 1.3, 50, 200, '2025-12-20', 1, 'คงที่'),
(101, @session_id, 'moderate', 'medium_risk', 0.8, 25, 100, '2025-12-20', 1, 'คงที่');

-- วันที่ 21 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'moderate', 'medium_risk', 1.0, 35, 140, '2025-12-21', 1, 'น้ำเริ่มลด'),
(2, @session_id, 'mild', 'low_risk', 0.4, 12, 48, '2025-12-21', 1, 'น้ำลดลง'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-21', 1, 'น้ำลดหมดแล้ว'),
(50, @session_id, 'severe', 'high_risk', 1.6, 80, 350, '2025-12-21', 1, 'น้ำเริ่มลดช้าๆ'),
(51, @session_id, 'moderate', 'medium_risk', 1.2, 50, 200, '2025-12-21', 1, 'น้ำลดลง'),
(52, @session_id, 'mild', 'low_risk', 0.6, 20, 80, '2025-12-21', 1, 'น้ำลดลงมาก'),
(100, @session_id, 'moderate', 'medium_risk', 0.9, 35, 140, '2025-12-21', 1, 'น้ำลดลง'),
(101, @session_id, 'mild', 'low_risk', 0.5, 15, 60, '2025-12-21', 1, 'น้ำลดลง');

-- วันที่ 22 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'mild', 'low_risk', 0.5, 18, 72, '2025-12-22', 1, 'น้ำลดมาก'),
(2, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-22', 1, 'กลับสู่ปกติ'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-22', 1, 'ปกติ'),
(50, @session_id, 'moderate', 'medium_risk', 1.1, 55, 220, '2025-12-22', 1, 'น้ำลดต่อเนื่อง'),
(51, @session_id, 'mild', 'low_risk', 0.7, 30, 120, '2025-12-22', 1, 'น้ำลดมาก'),
(52, @session_id, 'safe', 'safe', 0.1, 5, 20, '2025-12-22', 1, 'เกือบหมด'),
(100, @session_id, 'mild', 'low_risk', 0.5, 20, 80, '2025-12-22', 1, 'น้ำลดมาก'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-22', 1, 'กลับสู่ปกติ');

-- วันที่ 23 ธันวาคม 2025
INSERT INTO flood_area_status (vid, session_id, flood_level, status, water_level, affected_households, affected_population, recorded_day, recorded_by, notes) VALUES
(1, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'กลับสู่ปกติแล้ว'),
(2, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ'),
(3, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ'),
(50, @session_id, 'mild', 'low_risk', 0.6, 25, 100, '2025-12-23', 1, 'น้ำเหลือเล็กน้อย'),
(51, @session_id, 'safe', 'safe', 0.2, 8, 32, '2025-12-23', 1, 'เกือบหมด'),
(52, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'กลับสู่ปกติ'),
(100, @session_id, 'safe', 'safe', 0.1, 3, 12, '2025-12-23', 1, 'เกือบปกติ'),
(101, @session_id, 'safe', 'safe', 0, 0, 0, '2025-12-23', 1, 'ปกติ');
