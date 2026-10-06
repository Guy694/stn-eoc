-- บันทึกการแจ้งเตือนอัตโนมัติ (Telegram) ของเหตุการณ์ — alert_key กันส่งเรื่องเดิมซ้ำ
CREATE TABLE IF NOT EXISTS eoc_alert_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    eoc_session_id BIGINT NOT NULL,
    alert_key VARCHAR(191) NOT NULL,
    level ENUM('critical','serious','warning','info') NOT NULL DEFAULT 'serious',
    message TEXT NOT NULL,
    delivered_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_eoc_alert (eoc_session_id, alert_key),
    KEY idx_eoc_alert_time (eoc_session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
