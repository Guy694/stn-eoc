-- Table สำหรับเก็บสถานะเปิด/ปิด EOC แต่ละเรื่อง
CREATE TABLE IF NOT EXISTS eoc_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT FALSE,
    activated_at DATETIME NULL,
    activated_by INT NULL,
    deactivated_at DATETIME NULL,
    deactivated_by INT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (activated_by) REFERENCES officer(id) ON DELETE SET NULL,
    FOREIGN KEY (deactivated_by) REFERENCES officer(id) ON DELETE SET NULL,
    INDEX idx_eoc_type (eoc_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table สำหรับเก็บ Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    username VARCHAR(100) NULL,
    action_type ENUM(
        'login', 'logout', 
        'eoc_activate', 'eoc_deactivate',
        'data_create', 'data_update', 'data_delete',
        'profile_update', 'password_change',
        'officer_create', 'officer_update', 'officer_delete',
        'other'
    ) NOT NULL,
    target_type VARCHAR(50) NULL COMMENT 'ประเภทของข้อมูลที่กระทำ เช่น flood_record, officer, eoc_status',
    target_id VARCHAR(100) NULL COMMENT 'ID ของข้อมูลที่กระทำ',
    description TEXT NULL COMMENT 'รายละเอียดการกระทำ',
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    metadata JSON NULL COMMENT 'ข้อมูลเพิ่มเติมในรูปแบบ JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES officer(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert ข้อมูล EOC ทั้ง 5 เรื่อง (ปิดทั้งหมดเป็นค่าเริ่มต้น)
INSERT INTO eoc_status (eoc_type, is_active, description) VALUES
('flood', FALSE, 'ศูนย์ EOC น้ำท่วม - จัดการเหตุการณ์น้ำท่วมและอุทกภัย'),
('drought', FALSE, 'ศูนย์ EOC ภัยแล้ง - จัดการเหตุการณ์ภัยแล้งและการขาดแคลนน้ำ'),
('tsunami', FALSE, 'ศูนย์ EOC สึนามิ - จัดการเหตุการณ์คลื่นสึนามิ'),
('earthquake', FALSE, 'ศูนย์ EOC แผ่นดินไหว - จัดการเหตุการณ์แผ่นดินไหว'),
('disease', FALSE, 'ศูนย์ EOC โรคระบาด - จัดการเหตุการณ์โรคระบาดและภัยสุขภาพ')
ON DUPLICATE KEY UPDATE description = VALUES(description);
