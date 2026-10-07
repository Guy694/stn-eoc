-- แจ้งเตือนระดับน้ำจากสถานี ThaiWater (ไม่ผูกกับเหตุการณ์ EOC — เตือนได้ก่อนเปิดศูนย์)
-- state = สถานะล่าสุดของแต่ละสถานี ใช้กันแจ้งซ้ำ / log = ประวัติที่แจ้ง ใช้แสดง popup บนหน้าจอเจ้าหน้าที่
CREATE TABLE IF NOT EXISTS water_station_alert_state (
    station_id VARCHAR(40) NOT NULL PRIMARY KEY,
    station_name VARCHAR(191) NOT NULL,
    state ENUM('normal','near','overflow') NOT NULL DEFAULT 'normal',
    bank_diff DECIMAL(6,2) NULL,
    observed_at DATETIME NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS water_alert_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(40) NOT NULL,
    station_name VARCHAR(191) NOT NULL,
    level ENUM('critical','serious','info') NOT NULL,
    state ENUM('normal','near','overflow') NOT NULL,
    previous_state ENUM('normal','near','overflow') NOT NULL,
    bank_diff DECIMAL(6,2) NULL,
    water_level_msl DECIMAL(8,2) NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    observed_at DATETIME NULL,
    delivered_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_water_alert_time (created_at),
    KEY idx_water_alert_station (station_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
