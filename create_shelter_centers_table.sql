-- Create table for Shelter Centers
CREATE TABLE IF NOT EXISTS shelter_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sheltername VARCHAR(255) NOT NULL COMMENT 'ชื่อศูนย์พักพิงชั่วคราว',
    eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL COMMENT 'ประเภท EOC',
    lat DECIMAL(10, 7) NOT NULL COMMENT 'ละติจูด',
    lon DECIMAL(10, 7) NOT NULL COMMENT 'ลองจิจูด',
    address TEXT COMMENT 'ที่อยู่',
    tambon VARCHAR(100) NOT NULL COMMENT 'ตำบล',
    district_name VARCHAR(100) COMMENT 'อำเภอ',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน (1=เปิด, 0=ปิด)',
    shelter_capacity INT NOT NULL COMMENT 'ความจุ (จำนวนคน)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tambon (tambon),
    INDEX idx_district (district_name),
    INDEX idx_active (is_active),
    INDEX idx_eoc_type (eoc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='ตารางข้อมูลศูนย์พักพิงชั่วคราว';

-- Create table for tracking shelter occupancy per EOC session
CREATE TABLE IF NOT EXISTS shelter_occupancy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL COMMENT 'รหัสศูนย์พักพิง',
    eoc_session_id INT NOT NULL COMMENT 'รหัส EOC Session',
    current_occupancy INT DEFAULT 0 COMMENT 'จำนวนผู้พักพิงปัจจุบัน',
    max_occupancy_reached INT DEFAULT 0 COMMENT 'จำนวนผู้พักพิงสูงสุดที่เคยมี',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_shelter_session (shelter_id, eoc_session_id),
    FOREIGN KEY (shelter_id) REFERENCES shelter_centers(id) ON DELETE CASCADE,
    INDEX idx_session (eoc_session_id),
    INDEX idx_occupancy (current_occupancy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='ตารางติดตามจำนวนผู้พักพิงในแต่ละ EOC Session';

-- Insert sample data for different EOC types
INSERT INTO shelter_centers (sheltername, eoc_type, lat, lon, address, tambon, district_name, is_active, shelter_capacity) VALUES
-- Flood shelters
('ศูนย์พักพิงน้ำท่วม - โรงเรียนบ้านควนกาหลง', 'flood', 6.7234, 100.0823, '123 หมู่ 1', 'ควนกาหลง', 'เมืองสตูล', 1, 500),
('ศูนย์พักพิงน้ำท่วม - วัดประจำตำบล', 'flood', 6.6845, 100.0512, '89 หมู่ 3', 'คลองขุด', 'เมืองสตูล', 1, 300),
('ศูนย์พักพิงน้ำท่วม - หอประชุมอำเภอ', 'flood', 6.6238, 100.0673, '12 ถนนสตูล-ควนโดน', 'พิมาน', 'เมืองสตูล', 1, 800),
-- Tsunami shelters
('ศูนย์พักพิงสึนามิ - โรงเรียนบ้านตันหยงโป', 'tsunami', 6.5234, 100.1234, '45 หมู่ 2', 'ตันหยงโป', 'เมืองสตูล', 1, 400),
('ศูนย์พักพิงสึนามิ - วัดควนธานี', 'tsunami', 6.4123, 99.9876, '56 หมู่ 5', 'ควนธานี', 'มะนัง', 1, 350),
-- Earthquake shelters
('ศูนย์พักพิงแผ่นดินไหว - สนามกีฬาอำเภอ', 'earthquake', 6.7845, 100.1523, '67 หมู่ 4', 'ทุ่งนุ้ย', 'ควนโดน', 1, 600),
-- Disease shelters
('ศูนย์พักคนเจ็บโรคระบาด - โรงพยาบาลสนาม', 'disease', 6.6345, 100.0912, '34 หมู่ 7', 'คลองขุด', 'เมืองสตูล', 1, 200),
-- Drought shelters (temporary water distribution centers)
('ศูนย์บริการน้ำภัยแล้ง - ที่ว่าการอำเภอ', 'drought', 6.6538, 100.0773, '89 ถนนสตูล', 'ตำบลพิมาน', 'เมืองสตูล', 1, 150);
