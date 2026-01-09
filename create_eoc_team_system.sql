-- ========================================
-- ระบบจัดการทีมงาน EOC แบบยืดหยุ่น
-- รองรับการมอบหมายทีมงานตาม EOC Type และ Session
-- ========================================

-- ------------------------------------------------
-- 1. ตาราง eoc_teams: กำหนดทีมงานใน EOC
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS eoc_teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสทีม เช่น RISKCOM, MCAT, SAT',
    team_name_th VARCHAR(100) NOT NULL COMMENT 'ชื่อทีมภาษาไทย',
    team_name_en VARCHAR(100) NOT NULL COMMENT 'ชื่อทีมภาษาอังกฤษ',
    description TEXT COMMENT 'คำอธิบายหน้าที่ของทีม',
    icon VARCHAR(20) DEFAULT '👥' COMMENT 'ไอคอนแทนทีม',
    color VARCHAR(20) DEFAULT 'blue' COMMENT 'สีประจำทีม',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อมูลทีมงานเริ่มต้น
INSERT INTO eoc_teams (team_code, team_name_th, team_name_en, description, icon, color, sort_order) VALUES
('RISKCOM', 'ฝ่ายประชาสัมพันธ์', 'Risk Communication', 'รับผิดชอบการสื่อสารประชาสัมพันธ์และแจ้งเตือนประชาชน', '📢', 'purple', 1),
('MCAT', 'ทีมประเมินสถานการณ์', 'Multi-Agency Coordination', 'รายงานข้อมูลเพื่อประเมินสถานการณ์และแสดงบนแผนที่', '📊', 'blue', 2),
('SAT', 'ทีมค้นหาและกู้ภัย', 'Search and Rescue Team', 'ทีมปฏิบัติการค้นหาและกู้ภัย', '🚑', 'red', 3),
('SeRHT', 'ทีมกู้ภัยทางอากาศ', 'Search and Rescue Helicopter', 'ทีมกู้ภัยทางอากาศด้วยเฮลิคอปเตอร์', '🚁', 'orange', 4),
('MEDICAL', 'ทีมแพทย์และสาธารณสุข', 'Medical Team', 'ทีมแพทย์และเจ้าหน้าที่สาธารณสุข', '⚕️', 'green', 5),
('LOGISTICS', 'ทีมลำเลียง', 'Logistics Team', 'จัดการด้านลำเลียงและอุปกรณ์', '📦', 'yellow', 6),
('SHELTER', 'ทีมศูนย์พักพิง', 'Shelter Management', 'บริหารจัดการศูนย์พักพิงและผู้ประสบภัย', '🏕️', 'teal', 7);

-- ------------------------------------------------
-- 2. ตาราง eoc_type_modules: กำหนด Module/เมนูสำหรับแต่ละ EOC Type
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS eoc_type_modules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL,
    module_code VARCHAR(50) NOT NULL COMMENT 'รหัส module เช่น flood_map, disease_report',
    module_name_th VARCHAR(100) NOT NULL,
    module_name_en VARCHAR(100) NOT NULL,
    module_type ENUM('map', 'report', 'data_entry', 'dashboard', 'analytics') NOT NULL,
    route_path VARCHAR(200) NOT NULL COMMENT 'เส้นทาง URL',
    icon VARCHAR(20) DEFAULT '📄',
    description TEXT,
    form_config JSON COMMENT 'Configuration สำหรับฟอร์มรายงาน (ถ้าเป็น data_entry)',
    map_config JSON COMMENT 'Configuration สำหรับแผนที่ (ถ้าเป็น map)',
    required_teams JSON COMMENT 'ทีมที่ต้องใช้ในโมดูลนี้ [array of team_codes]',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_eoc_module (eoc_type, module_code),
    INDEX idx_eoc_type (eoc_type),
    INDEX idx_module_type (module_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตัวอย่าง Modules สำหรับ flood
INSERT INTO eoc_type_modules (eoc_type, module_code, module_name_th, module_name_en, module_type, route_path, icon, required_teams, sort_order) VALUES
('flood', 'flood_map', 'แผนที่น้ำท่วม', 'Flood Map', 'map', '/eoc/flood/map', '🗺️', '["MCAT","RISKCOM"]', 1),
('flood', 'daily_report', 'รายงานประจำวัน', 'Daily Report', 'data_entry', '/eoc/flood/daily-report', '📝', '["MCAT"]', 2),
('flood', 'shelter_management', 'จัดการศูนย์พักพิง', 'Shelter Management', 'data_entry', '/eoc/flood/shelters', '🏕️', '["SHELTER","LOGISTICS"]', 3),
('flood', 'rescue_operations', 'ปฏิบัติการกู้ภัย', 'Rescue Operations', 'report', '/eoc/flood/rescue', '🚑', '["SAT","SeRHT"]', 4);

-- ตัวอย่าง Modules สำหรับ disease (โรคระบาด)
INSERT INTO eoc_type_modules (eoc_type, module_code, module_name_th, module_name_en, module_type, route_path, icon, required_teams, sort_order) VALUES
('disease', 'disease_map', 'แผนที่โรคระบาด', 'Disease Map', 'map', '/eoc/disease/map', '🦠', '["MEDICAL","MCAT"]', 1),
('disease', 'patient_report', 'รายงานผู้ป่วย', 'Patient Report', 'data_entry', '/eoc/disease/patients', '🏥', '["MEDICAL"]', 2),
('disease', 'epidemiology', 'ข้อมูลระบาดวิทยา', 'Epidemiology Data', 'analytics', '/eoc/disease/epidemiology', '📈', '["MEDICAL"]', 3),
('disease', 'public_health', 'มาตรการสาธารณสุข', 'Public Health Measures', 'report', '/eoc/disease/measures', '💉', '["MEDICAL","RISKCOM"]', 4);

-- ตัวอย่าง Modules สำหรับ drought
INSERT INTO eoc_type_modules (eoc_type, module_code, module_name_th, module_name_en, module_type, route_path, icon, required_teams, sort_order) VALUES
('drought', 'drought_map', 'แผนที่ภัยแล้ง', 'Drought Map', 'map', '/eoc/drought/map', '🌵', '["MCAT","RISKCOM"]', 1),
('drought', 'water_supply', 'ข้อมูลแหล่งน้ำ', 'Water Supply', 'data_entry', '/eoc/drought/water-supply', '💧', '["LOGISTICS"]', 2),
('drought', 'relief_distribution', 'การแจกจ่ายช่วยเหลือ', 'Relief Distribution', 'report', '/eoc/drought/relief', '📦', '["LOGISTICS","SHELTER"]', 3);

-- ------------------------------------------------
-- 3. ตาราง eoc_session_teams: กำหนดทีมงานเฉพาะสำหรับแต่ละ Session
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS eoc_session_teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    eoc_session_id BIGINT NOT NULL COMMENT 'FK to eoc_sessions.id',
    team_id INT NOT NULL COMMENT 'FK to eoc_teams.id',
    team_lead_officer_id INT COMMENT 'หัวหน้าทีมในครั้งนี้ (FK to officer.id)',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT COMMENT 'ผู้ที่มอบหมาย (FK to officer.id)',
    notes TEXT COMMENT 'หมายเหตุการมอบหมาย',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_session_team (eoc_session_id, team_id),
    FOREIGN KEY (eoc_session_id) REFERENCES eoc_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES eoc_teams(id),
    INDEX idx_session (eoc_session_id),
    INDEX idx_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- 4. ตาราง eoc_team_members: สมาชิกในทีมแต่ละ Session
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS eoc_team_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_team_id INT NOT NULL COMMENT 'FK to eoc_session_teams.id',
    officer_id INT NOT NULL COMMENT 'FK to officer.id',
    role_in_team VARCHAR(100) COMMENT 'บทบาทในทีม เช่น "หัวหน้า", "สมาชิก", "ผู้ประสานงาน"',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT COMMENT 'ผู้ที่มอบหมาย',
    removed_at TIMESTAMP NULL COMMENT 'เวลาที่ถอดออกจากทีม',
    removed_by INT NULL COMMENT 'ผู้ที่ถอดออก',
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_team_id) REFERENCES eoc_session_teams(id) ON DELETE CASCADE,
    FOREIGN KEY (officer_id) REFERENCES officer(id),
    INDEX idx_session_team (session_team_id),
    INDEX idx_officer (officer_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- 5. ตาราง module_permissions: สิทธิ์การเข้าถึง Module ตาม Team
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS module_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    module_id INT NOT NULL COMMENT 'FK to eoc_type_modules.id',
    team_id INT NOT NULL COMMENT 'FK to eoc_teams.id',
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE COMMENT 'อนุมัติข้อมูล',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_module_team (module_id, team_id),
    FOREIGN KEY (module_id) REFERENCES eoc_type_modules(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES eoc_teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตัวอย่าง: MCAT สามารถสร้างและแก้ไขรายงานประจำวันของน้ำท่วม
INSERT INTO module_permissions (module_id, team_id, can_view, can_create, can_edit, can_delete)
SELECT 
    m.id,
    t.id,
    TRUE,
    TRUE,
    TRUE,
    FALSE
FROM eoc_type_modules m
CROSS JOIN eoc_teams t
WHERE m.module_code = 'daily_report' 
  AND m.eoc_type = 'flood'
  AND t.team_code = 'MCAT';

-- RISKCOM สามารถดูและอนุมัติ
INSERT INTO module_permissions (module_id, team_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 
    m.id,
    t.id,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    TRUE
FROM eoc_type_modules m
CROSS JOIN eoc_teams t
WHERE m.module_code = 'daily_report' 
  AND m.eoc_type = 'flood'
  AND t.team_code = 'RISKCOM';

-- ------------------------------------------------
-- สร้าง Views สำหรับการใช้งาน
-- ------------------------------------------------

-- View: ดูว่าแต่ละ Session มีทีมอะไรบ้าง
CREATE OR REPLACE VIEW vw_session_team_summary AS
SELECT 
    s.id AS session_id,
    s.eoc_type,
    s.session_number,
    s.status AS session_status,
    t.team_code,
    t.team_name_th,
    t.icon,
    st.is_active,
    o.full_name AS team_lead_name,
    o.role AS team_lead_role,
    COUNT(tm.id) AS member_count,
    st.assigned_at
FROM eoc_sessions s
LEFT JOIN eoc_session_teams st ON s.id = st.eoc_session_id
LEFT JOIN eoc_teams t ON st.team_id = t.id
LEFT JOIN officer o ON st.team_lead_officer_id = o.id
LEFT JOIN eoc_team_members tm ON st.id = tm.session_team_id AND tm.is_active = TRUE
GROUP BY s.id, st.id;

-- View: ดูว่าเจ้าหน้าที่คนใดอยู่ในทีมใดของ Session ไหน
CREATE OR REPLACE VIEW vw_officer_team_assignments AS
SELECT 
    o.id AS officer_id,
    o.username,
    o.full_name,
    o.role AS officer_role,
    s.id AS session_id,
    s.eoc_type,
    s.session_number,
    s.status AS session_status,
    t.team_code,
    t.team_name_th,
    tm.role_in_team,
    tm.assigned_at,
    tm.is_active
FROM officer o
JOIN eoc_team_members tm ON o.id = tm.officer_id
JOIN eoc_session_teams st ON tm.session_team_id = st.id
JOIN eoc_teams t ON st.team_id = t.id
JOIN eoc_sessions s ON st.eoc_session_id = s.id
WHERE tm.is_active = TRUE;

-- ------------------------------------------------
-- ข้อมูลตัวอย่าง: มอบหมายทีมให้ Session
-- ------------------------------------------------

-- สมมติว่า Session ID 27 (flood ครั้งที่ 2) ต้องการมอบหมายทีม
-- มอบหมายทีม MCAT
INSERT INTO eoc_session_teams (eoc_session_id, team_id, team_lead_officer_id, assigned_by, notes)
SELECT 27, t.id, 4, 1, 'มอบหมายทีมประเมินสถานการณ์'
FROM eoc_teams t
WHERE t.team_code = 'MCAT';

-- มอบหมายทีม RISKCOM
INSERT INTO eoc_session_teams (eoc_session_id, team_id, team_lead_officer_id, assigned_by, notes)
SELECT 27, t.id, 2, 1, 'มอบหมายทีมประชาสัมพันธ์'
FROM eoc_teams t
WHERE t.team_code = 'RISKCOM';

-- เพิ่มสมาชิกในทีม MCAT (สมมติว่า session_team_id = 1)
-- INSERT INTO eoc_team_members (session_team_id, officer_id, role_in_team, assigned_by)
-- VALUES (1, 4, 'หัวหน้าทีม', 1);

SELECT '✅ สร้างโครงสร้างระบบทีมงาน EOC สำเร็จ' AS status;
