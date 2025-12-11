-- สร้างตารางสำหรับจัดเก็บข้อมูลสถานพยาบาลจาก GeoJSON
CREATE TABLE health_facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'ชื่อสถานพยาบาล',
    typecode VARCHAR(50) NOT NULL COMMENT 'ประเภท เช่น รพ.ทั่วไป, รพ.ชุมชน, รพ.สต., ศสช., สสจ, สสอ., สอน.',
    changwat VARCHAR(100) DEFAULT 'สตูล' COMMENT 'จังหวัด',
    lat DECIMAL(10, 6) NOT NULL COMMENT 'ละติจูด',
    lon DECIMAL(10, 6) NOT NULL COMMENT 'ลองจิจูด',
    risk_level ENUM('ความเสี่ยงต่ำ', 'ความเสี่ยงปานกลาง', 'ความเสี่ยงสูง', 'ความเสี่ยงสูงมาก') COMMENT 'ระดับความเสี่ยง',
    district_name VARCHAR(100) COMMENT 'ชื่ออำเภอที่ตั้ง',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_typecode (typecode),
    INDEX idx_location (lat, lon),
    INDEX idx_risk (risk_level),
    INDEX idx_district (district_name),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ข้อมูลสถานพยาบาลในจังหวัดสตูล';

-- สร้างตาราง facility types สำหรับจัดกลุ่มประเภท
CREATE TABLE facility_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL COMMENT 'รหัสประเภท',
    name VARCHAR(255) NOT NULL COMMENT 'ชื่อประเภท',
    description TEXT COMMENT 'คำอธิบาย',
    icon_color VARCHAR(20) DEFAULT '#3B82F6' COMMENT 'สีของไอคอนบนแผนที่',
    marker_icon VARCHAR(50) DEFAULT 'hospital' COMMENT 'ชื่อไอคอน',
    display_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    
    INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ประเภทสถานพยาบาล';

-- Insert ข้อมูลประเภทสถานพยาบาล
INSERT INTO facility_types (code, name, description, icon_color, marker_icon, display_order) VALUES
('รพ.ทั่วไป', 'โรงพยาบาลทั่วไป', 'โรงพยาบาลขนาดใหญ่ ให้บริการแบบครบวงจร', '#DC2626', 'hospital', 1),
('รพ.ชุมชน', 'โรงพยาบาลชุมชน', 'โรงพยาบาลระดับอำเภอ', '#F59E0B', 'hospital', 2),
('รพ.สต.', 'โรงพยาบาลส่งเสริมสุขภาพตำบล', 'สถานีอนามัยระดับตำบล', '#10B981', 'clinic-medical', 3),
('ศสช.', 'ศูนย์สาธารณสุขชุมชน', 'ศูนย์บริการสาธารณสุขชุมชน', '#3B82F6', 'first-aid', 4),
('สสจ', 'สำนักงานสาธารณสุขจังหวัด', 'หน่วยงานบริหารระดับจังหวัด', '#6B7280', 'building', 5),
('สสอ.', 'สำนักงานสาธารณสุขอำเภอ', 'หน่วยงานบริหารระดับอำเภอ', '#8B5CF6', 'building', 6),
('สอน.', 'สถานีอนามัย', 'สถานีอนามัยเฉพาะทาง', '#EC4899', 'medkit', 7);
