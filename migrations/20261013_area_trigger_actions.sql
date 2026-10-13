-- ติ๊กการดำเนินการตาม Trigger ของแต่ละประกาศ (ประกาศใหม่ = เริ่มเช็กลิสต์ใหม่)
CREATE TABLE IF NOT EXISTS eoc_area_trigger_actions (
    trigger_id INT NOT NULL,
    action_index TINYINT NOT NULL,
    done TINYINT(1) NOT NULL DEFAULT 0,
    note VARCHAR(255) NULL,
    updated_by INT NULL,
    updated_by_name VARCHAR(150) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (trigger_id, action_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
