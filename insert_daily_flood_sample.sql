-- ข้อมูลตัวอย่างสำหรับทดสอบระบบ

-- วันที่ 1 ธันวาคม 2568 (2025-12-01)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-01', 'เมืองสตูล', 'severe', 45.50, 12000, 1.80),
('2025-12-01', 'ควนโดน', 'moderate', 30.20, 8000, 1.20),
('2025-12-01', 'ท่าแพ', 'mild', 15.80, 3000, 0.80),
('2025-12-01', 'ควนกาหลง', 'safe', 0, 0, 0.30),
('2025-12-01', 'ละงู', 'safe', 0, 0, 0.25),
('2025-12-01', 'ทุ่งหว้า', 'safe', 0, 0, 0.20),
('2025-12-01', 'มะนัง', 'safe', 0, 0, 0.15);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-01', 3, 1, 1, 1, 23000, 91.50, 'เริ่มมีฝนตกหนักในพื้นที่จังหวัดสตูล');

-- วันที่ 2 ธันวาคม 2568 (2025-12-02)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-02', 'เมืองสตูล', 'severe', 48.20, 13500, 2.10),
('2025-12-02', 'ควนโดน', 'severe', 35.70, 9500, 1.85),
('2025-12-02', 'ท่าแพ', 'moderate', 22.30, 5000, 1.10),
('2025-12-02', 'ควนกาหลง', 'safe', 0, 0, 0.40),
('2025-12-02', 'ละงู', 'safe', 0, 0, 0.35),
('2025-12-02', 'ทุ่งหว้า', 'safe', 0, 0, 0.30),
('2025-12-02', 'มะนัง', 'safe', 0, 0, 0.20);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-02', 3, 2, 1, 0, 28000, 106.20, 'สถานการณ์น้ำท่วมรุนแรงขึ้น เฝ้าระวังอย่างใกล้ชิด');

-- วันที่ 3 ธันวาคม 2568 (2025-12-03)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-03', 'เมืองสตูล', 'severe', 52.00, 15000, 2.40),
('2025-12-03', 'ควนโดน', 'severe', 40.50, 11000, 2.00),
('2025-12-03', 'ท่าแพ', 'moderate', 28.00, 6500, 1.30),
('2025-12-03', 'ละงู', 'mild', 12.00, 2000, 0.70),
('2025-12-03', 'ควนกาหลง', 'safe', 0, 0, 0.45),
('2025-12-03', 'ทุ่งหว้า', 'safe', 0, 0, 0.35),
('2025-12-03', 'มะนัง', 'safe', 0, 0, 0.25);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-03', 4, 2, 1, 1, 34500, 132.50, 'น้ำท่วมขยายพื้นที่ เริ่มเข้าถึงอ.ละงู');

-- วันที่ 4 ธันวาคม 2568 (2025-12-04)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-04', 'เมืองสตูล', 'severe', 55.80, 16500, 2.60),
('2025-12-04', 'ควนโดน', 'severe', 45.20, 12500, 2.20),
('2025-12-04', 'ท่าแพ', 'severe', 32.50, 8000, 1.90),
('2025-12-04', 'ละงู', 'moderate', 18.50, 4000, 1.05),
('2025-12-04', 'ควนกาหลง', 'safe', 0, 0, 0.50),
('2025-12-04', 'ทุ่งหว้า', 'safe', 0, 0, 0.40),
('2025-12-04', 'มะนัง', 'safe', 0, 0, 0.30);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-04', 4, 3, 1, 0, 41000, 152.00, 'สถานการณ์วิกฤต ระดับน้ำสูงสุด');

-- วันที่ 5 ธันวาคม 2568 (2025-12-05)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-05', 'เมืองสตูล', 'severe', 58.00, 17000, 2.70),
('2025-12-05', 'ควนโดน', 'severe', 48.00, 13000, 2.30),
('2025-12-05', 'ท่าแพ', 'moderate', 35.00, 9000, 1.50),
('2025-12-05', 'ละงู', 'mild', 20.00, 4500, 0.85),
('2025-12-05', 'ควนกาหลง', 'safe', 0, 0, 0.55),
('2025-12-05', 'ทุ่งหว้า', 'safe', 0, 0, 0.45),
('2025-12-05', 'มะนัง', 'safe', 0, 0, 0.35);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-05', 4, 2, 1, 1, 43500, 161.00, 'จุดสูงสุดของสถานการณ์ เริ่มมีแนวโน้มดีขึ้น');

-- วันที่ 6 ธันวาคม 2568 (2025-12-06)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-06', 'เมืองสตูล', 'moderate', 42.00, 12000, 1.80),
('2025-12-06', 'ควนโดน', 'moderate', 38.00, 10000, 1.60),
('2025-12-06', 'ท่าแพ', 'mild', 25.00, 6000, 0.95),
('2025-12-06', 'ละงู', 'safe', 0, 0, 0.50),
('2025-12-06', 'ควนกาหลง', 'safe', 0, 0, 0.40),
('2025-12-06', 'ทุ่งหว้า', 'safe', 0, 0, 0.35),
('2025-12-06', 'มะนัง', 'safe', 0, 0, 0.25);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-06', 3, 0, 2, 1, 28000, 105.00, 'สถานการณ์เริ่มคลี่คลาย ระดับน้ำลดลง');

-- วันที่ 7 ธันวาคม 2568 (2025-12-07)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-07', 'เมืองสตูล', 'moderate', 35.00, 10000, 1.40),
('2025-12-07', 'ควนโดน', 'mild', 28.00, 7000, 1.00),
('2025-12-07', 'ท่าแพ', 'mild', 18.00, 4000, 0.70),
('2025-12-07', 'ละงู', 'safe', 0, 0, 0.30),
('2025-12-07', 'ควนกาหลง', 'safe', 0, 0, 0.25),
('2025-12-07', 'ทุ่งหว้า', 'safe', 0, 0, 0.20),
('2025-12-07', 'มะนัง', 'safe', 0, 0, 0.15);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-07', 3, 0, 1, 2, 21000, 81.00, 'น้ำลดอย่างต่อเนื่อง');

-- วันที่ 8 ธันวาคม 2568 (2025-12-08)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-08', 'เมืองสตูล', 'mild', 25.00, 6000, 0.90),
('2025-12-08', 'ควนโดน', 'mild', 20.00, 5000, 0.75),
('2025-12-08', 'ท่าแพ', 'safe', 0, 0, 0.40),
('2025-12-08', 'ละงู', 'safe', 0, 0, 0.20),
('2025-12-08', 'ควนกาหลง', 'safe', 0, 0, 0.15),
('2025-12-08', 'ทุ่งหว้า', 'safe', 0, 0, 0.10),
('2025-12-08', 'มะนัง', 'safe', 0, 0, 0.10);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-08', 2, 0, 0, 2, 11000, 45.00, 'สถานการณ์ดีขึ้นเป็นลำดับ');

-- วันที่ 9 ธันวาคม 2568 (2025-12-09 - วันปัจจุบัน)
INSERT INTO daily_flood_status (record_date, district_name, flood_level, affected_area, affected_population, water_level) VALUES
('2025-12-09', 'เมืองสตูล', 'mild', 15.00, 3000, 0.60),
('2025-12-09', 'ควนโดน', 'safe', 0, 0, 0.35),
('2025-12-09', 'ท่าแพ', 'safe', 0, 0, 0.25),
('2025-12-09', 'ละงู', 'safe', 0, 0, 0.15),
('2025-12-09', 'ควนกาหลง', 'safe', 0, 0, 0.10),
('2025-12-09', 'ทุ่งหว้า', 'safe', 0, 0, 0.10),
('2025-12-09', 'มะนัง', 'safe', 0, 0, 0.10);

INSERT INTO daily_summary (record_date, total_affected_districts, severe_count, moderate_count, mild_count, total_population, total_area, notes) VALUES
('2025-12-09', 1, 0, 0, 1, 3000, 15.00, 'น้ำท่วมเกือบหมด เหลือเฉพาะบางพื้นที่');
