-- Create table for IT Resources (Server, Internet, Network, Hardware)
CREATE TABLE IF NOT EXISTS it_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resource_type ENUM('server', 'internet', 'network', 'hardware') NOT NULL COMMENT 'ประเภททรัพยากร',
    
    -- ข้อมูลหน่วยบริการ
    unit_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหน่วยบริการ/สถานที่',
    unit_code VARCHAR(50) COMMENT 'รหัสหน่วยบริการ',
    location VARCHAR(255) COMMENT 'ที่ตั้ง',
    
    -- ข้อมูล Server
    server_name VARCHAR(100) COMMENT 'ชื่อ Server',
    server_ip VARCHAR(45) COMMENT 'IP Address',
    server_os VARCHAR(100) COMMENT 'Operating System',
    
    -- ข้อมูล Internet
    isp_provider VARCHAR(100) COMMENT 'ผู้ให้บริการ (AIS, TRUE, DTAC, TOT, 3BB ฯลฯ)',
    connection_type VARCHAR(50) COMMENT 'ประเภทการเชื่อมต่อ (Fiber, 4G, 5G, ADSL)',
    bandwidth VARCHAR(50) COMMENT 'ความเร็ว (เช่น 100Mbps)',
    
    -- สถานะ
    status ENUM('online', 'offline', 'maintenance', 'unknown') DEFAULT 'unknown' COMMENT 'สถานะการใช้งาน',
    last_check DATETIME COMMENT 'ตรวจสอบล่าสุด',
    
    -- หมายเหตุ
    notes TEXT COMMENT 'หมายเหตุ',
    contact_person VARCHAR(100) COMMENT 'ผู้รับผิดชอบ',
    contact_phone VARCHAR(20) COMMENT 'เบอร์ติดต่อ',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_resource_type (resource_type),
    INDEX idx_status (status),
    INDEX idx_unit_name (unit_name),
    INDEX idx_isp_provider (isp_provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ตารางข้อมูลทรัพยากร IT Support';

-- Sample data
INSERT INTO it_resources (resource_type, unit_name, unit_code, location, server_name, server_ip, server_os, status, contact_person, contact_phone) VALUES
('server', 'สำนักงานสาธารณสุขจังหวัดสตูล', 'SSJ-STN', 'อ.เมืองสตูล', 'Main Server', '192.168.1.1', 'Windows Server 2019', 'online', 'นายสมชาย ใจดี', '074-711111'),
('server', 'โรงพยาบาลสตูล', 'HOS-STN', 'อ.เมืองสตูล', 'HIS Server', '192.168.1.10', 'Linux Ubuntu 22.04', 'online', 'นายวิชัย เก่งกาจ', '074-722222');

INSERT INTO it_resources (resource_type, unit_name, unit_code, location, isp_provider, connection_type, bandwidth, status, contact_person, contact_phone) VALUES
('internet', 'สำนักงานสาธารณสุขจังหวัดสตูล', 'SSJ-STN', 'อ.เมืองสตูล', 'TOT', 'Fiber', '100Mbps', 'online', 'นายสมชาย ใจดี', '074-711111'),
('internet', 'รพ.สต.ควนกาหลง', 'PCU-KKL', 'อ.ควนกาหลง', 'AIS', '4G', '50Mbps', 'online', 'นางสาวมะลิ สวย', '074-733333'),
('internet', 'รพ.สต.ทุ่งนุ้ย', 'PCU-TN', 'อ.ควนกาหลง', '3BB', 'Fiber', '200Mbps', 'offline', 'นายประสิทธิ์ ดี', '074-744444');
