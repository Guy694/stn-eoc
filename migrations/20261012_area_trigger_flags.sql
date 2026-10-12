-- ประกาศธงเตือนภัย/Trigger การเคลื่อนย้ายกลุ่มเปราะบาง รายพื้นที่ในเหตุการณ์ EOC (เก็บทุกครั้งที่ประกาศ = ประวัติ)
-- district ว่าง = ทั้งจังหวัด · tambon ว่าง = ทั้งอำเภอ · stage ว่าง = ยกเลิกประกาศของพื้นที่นั้น
CREATE TABLE IF NOT EXISTS eoc_area_triggers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    district VARCHAR(100) NULL,
    tambon VARCHAR(100) NULL,
    stage VARCHAR(20) NULL COMMENT 't0, t1_green, t1_yellow, t1_red, t2 ... t6',
    note VARCHAR(500) NULL,
    declared_by INT NULL,
    declared_by_name VARCHAR(150) NULL,
    declared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_area_trigger_session (session_id, declared_at),
    KEY idx_area_trigger_area (session_id, district, tambon)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
