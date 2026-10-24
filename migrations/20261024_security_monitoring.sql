-- เฝ้าระวังความปลอดภัย (ตั้งค่าระบบ › ผู้เข้าชม และ Telegram กลุ่มผู้ดูแลระบบ)
-- 1) security_audit_log: ผู้ดูแลเปลี่ยนสิทธิ์ อนุมัติ/ยกเลิกอนุมัติ รีเซ็ตรหัสผ่าน สร้าง/ลบบัญชี
-- 2) security_alert_log: แจ้งเตือนการเข้าชม/เข้าใช้ผิดปกติที่ส่งไปแล้ว (ใช้กันแจ้งซ้ำ และสรุปรายสัปดาห์)
-- 3) security_monitor_state: สถานะงานเบื้องหลัง เช่น ส่งสรุปรายสัปดาห์ของสัปดาห์ไหนไปแล้ว
-- ลบอัตโนมัติเมื่อเกิน 2 ปี (lib/pdpaRetention.mjs)
CREATE TABLE IF NOT EXISTS security_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id INT NULL,
    actor_username VARCHAR(100) NULL,
    action VARCHAR(40) NOT NULL COMMENT 'role_change | approval_granted | approval_revoked | password_reset | account_created | account_deleted',
    target_id INT NULL,
    target_username VARCHAR(100) NULL,
    detail VARCHAR(500) NULL,
    ip_address VARCHAR(64) NULL,
    KEY idx_security_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_alert_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    kind VARCHAR(40) NOT NULL COMMENT 'traffic_spike | ip_flood | staff_foreign_access | failed_login_burst',
    alert_key VARCHAR(120) NOT NULL COMMENT 'ใช้กันแจ้งซ้ำในช่วงพัก',
    title VARCHAR(200) NOT NULL,
    detail TEXT NULL,
    delivered INT NOT NULL DEFAULT 0,
    KEY idx_security_alert_time (created_at),
    KEY idx_security_alert_key (alert_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_monitor_state (
    state_key VARCHAR(64) PRIMARY KEY,
    state_value VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
