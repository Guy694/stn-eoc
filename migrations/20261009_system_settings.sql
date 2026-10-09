-- ค่าตั้งระบบแบบ key–value (เช่น โหมดปิดปรับปรุงระบบ)
-- รันซ้ำได้
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
