-- ============================================
-- สร้างระบบ Session Management ที่ปลอดภัย
-- ============================================
-- วันที่: 29 ธันวาคม 2025
-- วัตถุประสงค์: เพิ่มความปลอดภัยให้ระบบ authentication
-- ============================================

USE stneoc;

-- 1. สร้างตาราง user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    title VARCHAR(50) NULL,
    given_name VARCHAR(200) NULL,
    family_name VARCHAR(200) NULL,
    email VARCHAR(100) NULL,
    phone VARCHAR(20) NULL,
    role ENUM('staff', 'MCATT', 'SAT', 'SeRHT', 'admin') NOT NULL DEFAULT 'staff',
    ip_address VARCHAR(45) NULL COMMENT 'IPv4 หรือ IPv6',
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    login_method ENUM('username_password', 'thaiid') DEFAULT 'username_password',
    INDEX idx_session_token (session_token),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (user_id) REFERENCES officer(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='เก็บ session ของผู้ใช้ที่ login';

-- 2. สร้างตาราง login_attempts (ป้องกัน brute force)
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success TINYINT(1) DEFAULT 0,
    INDEX idx_username (username),
    INDEX idx_ip_address (ip_address),
    INDEX idx_attempt_time (attempt_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='บันทึกความพยายาม login';

-- 3. สร้างตาราง security_logs (บันทึกเหตุการณ์ความปลอดภัย)
CREATE TABLE IF NOT EXISTS security_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('login_success', 'login_failed', 'logout', 'session_expired', 'suspicious_activity', 'account_locked') NOT NULL,
    user_id INT NULL,
    username VARCHAR(50) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    details TEXT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='บันทึกเหตุการณ์ความปลอดภัย';

-- 4. เพิ่มคอลัมน์ความปลอดภัยใน officer
ALTER TABLE officer 
ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ login ผิด',
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP NULL COMMENT 'ล็อคบัญชีจนถึง',
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL COMMENT 'เปลี่ยนรหัสผ่านล่าสุด',
ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) DEFAULT 0 COMMENT 'บังคับเปลี่ยนรหัสผ่าน',
ADD COLUMN IF NOT EXISTS two_factor_enabled TINYINT(1) DEFAULT 0 COMMENT 'เปิด 2FA หรือไม่',
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32) NULL COMMENT 'Secret key สำหรับ 2FA';

-- 5. สร้าง Stored Procedure สำหรับทำความสะอาด session หมดอายุ
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS cleanup_expired_sessions()
BEGIN
    -- ลบ session ที่หมดอายุ
    DELETE FROM user_sessions WHERE expires_at < NOW() OR is_active = 0;
    
    -- ลบ login attempts เก่ากว่า 24 ชั่วโมง
    DELETE FROM login_attempts WHERE attempt_time < DATE_SUB(NOW(), INTERVAL 24 HOUR);
    
    -- บันทึก log
    INSERT INTO security_logs (event_type, details, severity)
    VALUES ('session_expired', 'Cleanup expired sessions', 'low');
END$$

DELIMITER ;

-- 6. สร้าง Event สำหรับทำความสะอาดอัตโนมัติทุก 1 ชั่วโมง
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS cleanup_sessions_event;

CREATE EVENT cleanup_sessions_event
ON SCHEDULE EVERY 1 HOUR
DO CALL cleanup_expired_sessions();

-- 7. สร้าง View สำหรับดู active sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.id,
    s.session_token,
    s.user_id,
    s.username,
    CONCAT_WS(' ', s.title, s.given_name, s.family_name) as full_name,
    s.role,
    s.ip_address,
    s.login_method,
    s.created_at,
    s.last_activity,
    s.expires_at,
    TIMESTAMPDIFF(MINUTE, s.last_activity, NOW()) as idle_minutes,
    TIMESTAMPDIFF(MINUTE, NOW(), s.expires_at) as remaining_minutes
FROM user_sessions s
WHERE s.expires_at > NOW() AND s.is_active = 1
ORDER BY s.last_activity DESC;

-- 8. สร้าง View สำหรับตรวจสอบ suspicious activities
CREATE OR REPLACE VIEW suspicious_activities AS
SELECT 
    username,
    ip_address,
    COUNT(*) as failed_attempts,
    MAX(attempt_time) as last_attempt,
    TIMESTAMPDIFF(MINUTE, MIN(attempt_time), MAX(attempt_time)) as time_span_minutes
FROM login_attempts
WHERE success = 0 
  AND attempt_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY username, ip_address
HAVING failed_attempts >= 3
ORDER BY failed_attempts DESC, last_attempt DESC;

-- ============================================
-- ตรวจสอบโครงสร้างที่สร้าง
-- ============================================
SHOW TABLES;

-- ============================================
-- แสดง Active Sessions
-- ============================================
SELECT * FROM active_sessions LIMIT 5;

-- ============================================
-- สรุปการสร้าง
-- ============================================
-- ✅ user_sessions - เก็บ session ที่ปลอดภัย
-- ✅ login_attempts - ป้องกัน brute force
-- ✅ security_logs - บันทึกเหตุการณ์
-- ✅ cleanup procedure - ทำความสะอาดอัตโนมัติ
-- ✅ event scheduler - รันทุก 1 ชั่วโมง
-- ✅ views - ดูข้อมูลสำคัญ
-- ✅ officer columns - เพิ่มความปลอดภัย
-- ============================================
