-- สร้างตาราง shelter_session_activations
-- ใช้สำหรับเปิด/ปิดศูนย์พักพิงตาม EOC Session

CREATE TABLE IF NOT EXISTS shelter_session_activations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL,
    session_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    current_occupancy INT DEFAULT 0,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deactivated_at DATETIME NULL,
    notes TEXT NULL,
    UNIQUE KEY unique_shelter_session (shelter_id, session_id),
    INDEX idx_shelter_id (shelter_id),
    INDEX idx_session_id (session_id),
    INDEX idx_session_active (session_id, is_active)
);

-- หมายเหตุ: ไม่ใช้ FOREIGN KEY เพื่อความเข้ากันได้กับ data type ที่แตกต่างกัน
-- Application จะจัดการ data integrity แทน
