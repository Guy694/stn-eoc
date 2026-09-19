-- เก็บสถิติรวมของเว็บไซต์โดยไม่บันทึก IP หรือข้อมูลส่วนบุคคล
CREATE TABLE IF NOT EXISTS site_statistics (
    metric_key VARCHAR(64) PRIMARY KEY,
    metric_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO site_statistics (metric_key, metric_value)
VALUES ('total_visits', 0)
ON DUPLICATE KEY UPDATE metric_key = VALUES(metric_key);

