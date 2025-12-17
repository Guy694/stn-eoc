-- Table สำหรับเก็บประวัติการเปิด/ปิด EOC แต่ละครั้ง (Sessions)
CREATE TABLE IF NOT EXISTS eoc_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL,
    session_number INT NOT NULL COMMENT 'ลำดับการเปิด EOC ครั้งที่',
    opened_at DATETIME NOT NULL,
    opened_by INT NOT NULL,
    open_reason TEXT NULL COMMENT 'เหตุผลการเปิด EOC',
    closed_at DATETIME NULL,
    closed_by INT NULL,
    close_reason TEXT NULL COMMENT 'เหตุผลการปิด EOC',
    duration_hours DECIMAL(10,2) NULL COMMENT 'ระยะเวลาที่เปิด (ชั่วโมง)',
    status ENUM('active', 'closed') DEFAULT 'active',
    
    -- สถิติสรุปของ session นี้
    total_activities INT DEFAULT 0 COMMENT 'จำนวนกิจกรรมทั้งหมดในช่วงนี้',
    total_data_entries INT DEFAULT 0 COMMENT 'จำนวนข้อมูลที่บันทึกในช่วงนี้',
    affected_areas TEXT NULL COMMENT 'พื้นที่ที่ได้รับผลกระทบ (JSON)',
    summary TEXT NULL COMMENT 'สรุปภาพรวมของ session',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (opened_by) REFERENCES officer(id) ON DELETE RESTRICT,
    FOREIGN KEY (closed_by) REFERENCES officer(id) ON DELETE RESTRICT,
    
    INDEX idx_eoc_type (eoc_type),
    INDEX idx_status (status),
    INDEX idx_opened_at (opened_at),
    INDEX idx_session_number (eoc_type, session_number),
    UNIQUE KEY unique_active_session (eoc_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เพิ่ม column session_id ใน activity_logs เพื่อเชื่อมโยงกับ EOC session
ALTER TABLE activity_logs 
ADD COLUMN eoc_session_id BIGINT NULL AFTER target_id,
ADD INDEX idx_eoc_session_id (eoc_session_id),
ADD CONSTRAINT fk_activity_logs_eoc_session 
    FOREIGN KEY (eoc_session_id) REFERENCES eoc_sessions(id) ON DELETE SET NULL;
