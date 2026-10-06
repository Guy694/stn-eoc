-- สถิติการใช้งานแบบสรุป: ไม่มี IP, cookie identifier, user agent หรือข้อมูลระบุตัวบุคคล
CREATE TABLE IF NOT EXISTS site_analytics_daily (
    event_date DATE NOT NULL,
    event_key VARCHAR(48) NOT NULL,
    page_path VARCHAR(160) NOT NULL DEFAULT '',
    source_path VARCHAR(160) NOT NULL DEFAULT '',
    device_type VARCHAR(16) NOT NULL DEFAULT 'other',
    event_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_date, event_key, page_path, source_path, device_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
