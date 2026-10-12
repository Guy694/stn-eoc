-- ระดับน้ำสถานีเฝ้าระวังของ ปภ. (cctv.disaster.go.th) เก็บรายชั่วโมง เพื่อเทียบย้อนหลังในรายงานระดับน้ำ
CREATE TABLE IF NOT EXISTS dpm_water_readings (
    station_code VARCHAR(20) NOT NULL,
    hour_at DATETIME NOT NULL COMMENT 'ชั่วโมงตามเวลาไทย (เก็บค่าแรกที่ดึงได้ในชั่วโมงนั้น)',
    station_name VARCHAR(191) NOT NULL,
    water_level DECIMAL(8,2) NULL,
    bank_level DECIMAL(8,2) NULL,
    malfunction TINYINT(1) NOT NULL DEFAULT 0,
    fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_code, hour_at),
    KEY idx_dpm_water_hour (hour_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
