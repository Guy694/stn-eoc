-- เก็บยอดเข้าชมรายวันแบบสรุปเท่านั้น ไม่มี IP, cookie หรือข้อมูลระบุตัวบุคคล
CREATE TABLE IF NOT EXISTS site_visit_daily (
    visit_date DATE PRIMARY KEY,
    visit_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
