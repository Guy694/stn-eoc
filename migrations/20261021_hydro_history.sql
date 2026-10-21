-- ประวัติฝนรายสถานี (ThaiWater) และระดับน้ำทะเลหน้าสตูล เก็บรายชั่วโมง เพื่อดูแนวโน้มย้อนหลัง
-- (ระดับน้ำในคลองเก็บอยู่แล้วในตาราง dpm_water_readings: สถานี ปภ. รหัส STN… และ ThaiWater รหัส TW…)
CREATE TABLE IF NOT EXISTS rain_readings (
    station_id VARCHAR(40) NOT NULL,
    hour_at DATETIME NOT NULL COMMENT 'ชั่วโมงตามเวลาไทย (ค่าล่าสุดที่ดึงได้ในชั่วโมงนั้น)',
    station_name VARCHAR(191) NOT NULL,
    amphoe VARCHAR(100) NULL,
    tambon VARCHAR(100) NULL,
    lat DECIMAL(9,6) NULL,
    lng DECIMAL(9,6) NULL,
    rain_1h DECIMAL(7,1) NULL,
    rain_24h DECIMAL(7,1) NULL COMMENT 'ฝนสะสม 24 ชม. ณ เวลาที่วัด (มม.)',
    observed_at DATETIME NULL COMMENT 'เวลาที่สถานีวัด (เวลาไทย)',
    fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_id, hour_at),
    KEY idx_rain_hour (hour_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sea_level_readings (
    hour_at DATETIME NOT NULL PRIMARY KEY COMMENT 'ชั่วโมงตามเวลาไทย',
    observed_level DECIMAL(7,3) NULL COMMENT 'ค่าวัดจริงจากสถานี IOC (ม.)',
    observed_station VARCHAR(40) NULL,
    model_level DECIMAL(7,3) NULL COMMENT 'ระดับน้ำทะเลหน้าสตูลจากแบบจำลอง Open-Meteo (ม. MSL)',
    status_key VARCHAR(20) NULL,
    fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
