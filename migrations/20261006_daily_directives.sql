-- รายงานประจำวัน "สถานการณ์/ข้อสั่งการ" แบบเป็นข้อๆ (1 แถว = 1 ข้อ เพื่อติดตามสถานะรายข้อได้)
CREATE TABLE IF NOT EXISTS eoc_daily_directives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    eoc_session_id BIGINT NOT NULL,
    report_date DATE NOT NULL,
    item_order INT NOT NULL DEFAULT 0,
    item_level TINYINT NOT NULL DEFAULT 0 COMMENT '0 = ข้อหลัก, 1-2 = ข้อย่อย',
    content TEXT NOT NULL,
    item_status ENUM('open', 'done') NOT NULL DEFAULT 'open',
    team_code VARCHAR(40) NULL COMMENT 'ทีมของผู้เขียนข้อ',
    carried_from_id INT NULL COMMENT 'ยกมาจากข้อของวันก่อน',
    created_by INT NULL,
    updated_by INT NULL,
    completed_by INT NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_daily_directives_day (eoc_session_id, report_date, item_order),
    KEY idx_daily_directives_status (eoc_session_id, item_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
