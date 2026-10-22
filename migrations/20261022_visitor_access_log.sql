-- บันทึกการเข้าชมเพื่อความปลอดภัย: ใครเข้าหน้าไหน จาก IP/ตำแหน่งโดยประมาณใด (ดูได้ที่ ตั้งค่าระบบ › ผู้เข้าชม)
-- ตำแหน่งได้จาก IP (header ของ proxy/CDN หรือบริการค้นหาตำแหน่งที่ตั้งค่าไว้) ไม่ใช่ GPS ของผู้ใช้
-- ลบอัตโนมัติเมื่อเกิน VISITOR_LOG_RETENTION_DAYS (ค่าเริ่มต้น 90 วัน) — lib/pdpaRetention.mjs
CREATE TABLE IF NOT EXISTS visitor_access_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(64) NOT NULL,
    area ENUM('public', 'staff') NOT NULL DEFAULT 'public',
    path VARCHAR(255) NOT NULL,
    referrer_host VARCHAR(120) NULL,
    user_id INT NULL,
    username VARCHAR(100) NULL,
    role VARCHAR(50) NULL,
    device VARCHAR(20) NULL,
    browser VARCHAR(40) NULL,
    user_agent VARCHAR(300) NULL,
    network VARCHAR(20) NULL COMMENT 'public | private (เครือข่ายภายใน) | unknown',
    country VARCHAR(8) NULL,
    region VARCHAR(80) NULL,
    city VARCHAR(80) NULL,
    latitude DECIMAL(9,6) NULL,
    longitude DECIMAL(9,6) NULL,
    geo_source VARCHAR(20) NULL,
    KEY idx_visitor_time (visited_at),
    KEY idx_visitor_ip (ip_address, visited_at),
    KEY idx_visitor_user (user_id, visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
