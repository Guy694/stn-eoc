-- แจ้งเตือนภัยถึงประชาชน (Web Push) — รันซ้ำได้
-- เก็บเฉพาะข้อมูลที่จำเป็นต่อการส่ง: ปลายทางของเบราว์เซอร์ กุญแจเข้ารหัส และพื้นที่ที่สนใจ (ไม่มีชื่อ/เบอร์โทร/พิกัดบ้าน)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  endpoint_hash CHAR(64) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(140) NOT NULL,
  auth_secret VARCHAR(48) NOT NULL,
  scope ENUM('all','areas') NOT NULL DEFAULT 'all',
  districts JSON NULL,
  tambons JSON NULL,
  user_agent VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  fail_count INT NOT NULL DEFAULT 0,
  last_status INT NULL,
  last_sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  KEY idx_push_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS public_push_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  alert_key VARCHAR(120) NOT NULL,
  kind ENUM('auto','manual','test') NOT NULL DEFAULT 'auto',
  level VARCHAR(16) NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL,
  url VARCHAR(255) NULL,
  target JSON NULL,
  recipients INT NOT NULL DEFAULT 0,
  delivered INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  removed INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  UNIQUE KEY uq_public_push_key (alert_key),
  KEY idx_public_push_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
