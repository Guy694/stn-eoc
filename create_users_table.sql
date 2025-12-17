-- ===================================
-- ตารางสำหรับจัดการผู้ใช้ระบบ
-- ===================================

-- 1. สร้างตาราง roles (บทบาทผู้ใช้)
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL COMMENT 'ชื่อบทบาท เช่น admin, eoc_staff, public',
    role_display_name VARCHAR(100) NOT NULL COMMENT 'ชื่อแสดง',
    description TEXT COMMENT 'คำอธิบายบทบาท',
    permissions JSON COMMENT 'สิทธิ์การเข้าถึง',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. สร้างตาราง users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT 'ชื่อผู้ใช้',
    password_hash VARCHAR(255) NOT NULL COMMENT 'รหัสผ่านแบบ hash',
    email VARCHAR(100) UNIQUE COMMENT 'อีเมล',
    full_name VARCHAR(150) NOT NULL COMMENT 'ชื่อ-นามสกุล',
    phone VARCHAR(20) COMMENT 'เบอร์โทรศัพท์',
    role_id INT NOT NULL COMMENT 'รหัสบทบาท',
    
    -- ข้อมูลการทำงาน
    department VARCHAR(100) COMMENT 'หน่วยงาน',
    position VARCHAR(100) COMMENT 'ตำแหน่ง',
    
    -- พื้นที่รับผิดชอบ
    district_code VARCHAR(10) COMMENT 'รหัสอำเภอที่รับผิดชอบ',
    tambon_code VARCHAR(10) COMMENT 'รหัสตำบลที่รับผิดชอบ',
    
    -- สถานะ
    is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
    is_verified BOOLEAN DEFAULT FALSE COMMENT 'ยืนยันอีเมลแล้ว',
    last_login TIMESTAMP NULL COMMENT 'เข้าสู่ระบบล่าสุด',
    
    -- Metadata
    created_by INT COMMENT 'ผู้สร้าง',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. สร้างตาราง user_sessions (สำหรับจัดการ session)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45) COMMENT 'IP Address',
    user_agent TEXT COMMENT 'Browser/Device info',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (session_token),
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. สร้างตาราง user_activity_log (บันทึกกิจกรรม)
CREATE TABLE IF NOT EXISTS user_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL COMMENT 'การกระทำ',
    resource VARCHAR(255) COMMENT 'ทรัพยากรที่เข้าถึง',
    details JSON COMMENT 'รายละเอียดเพิ่มเติม',
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- ข้อมูลเริ่มต้น
-- ===================================

-- 5. เพิ่ม roles เริ่มต้น
INSERT INTO roles (role_name, role_display_name, description, permissions) VALUES
('admin', 'ผู้ดูแลระบบ', 'สิทธิ์เต็มทุกอย่าง', JSON_OBJECT(
    'dashboard', true,
    'eoc', JSON_OBJECT('view', true, 'create', true, 'edit', true, 'delete', true),
    'admin', JSON_OBJECT('view', true, 'create', true, 'edit', true, 'delete', true),
    'reports', JSON_OBJECT('view', true, 'create', true, 'export', true),
    'users', JSON_OBJECT('view', true, 'create', true, 'edit', true, 'delete', true)
)),
('eoc_manager', 'ผู้จัดการ EOC', 'จัดการเหตุการณ์และทีมงาน', JSON_OBJECT(
    'dashboard', true,
    'eoc', JSON_OBJECT('view', true, 'create', true, 'edit', true, 'delete', false),
    'admin', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false),
    'reports', JSON_OBJECT('view', true, 'create', true, 'export', true),
    'users', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false)
)),
('eoc_staff', 'เจ้าหน้าที่ EOC', 'บันทึกข้อมูลภัยพิบัติ', JSON_OBJECT(
    'dashboard', true,
    'eoc', JSON_OBJECT('view', true, 'create', true, 'edit', true, 'delete', false),
    'admin', JSON_OBJECT('view', false, 'create', false, 'edit', false, 'delete', false),
    'reports', JSON_OBJECT('view', true, 'create', false, 'export', false),
    'users', JSON_OBJECT('view', false, 'create', false, 'edit', false, 'delete', false)
)),
('local_officer', 'เจ้าหน้าที่ท้องถิ่น', 'บันทึกข้อมูลระดับพื้นที่', JSON_OBJECT(
    'dashboard', true,
    'eoc', JSON_OBJECT('view', true, 'create', true, 'edit', false, 'delete', false),
    'admin', JSON_OBJECT('view', false, 'create', false, 'edit', false, 'delete', false),
    'reports', JSON_OBJECT('view', true, 'create', false, 'export', false),
    'users', JSON_OBJECT('view', false, 'create', false, 'edit', false, 'delete', false)
)),
('public', 'ประชาชน', 'ดูข้อมูลสาธารณะ', JSON_OBJECT(
    'dashboard', false,
    'eoc', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false),
    'admin', JSON_OBJECT('view', false, 'create', false, 'edit', false, 'delete', false),
    'reports', JSON_OBJECT('view', true, 'create', false, 'export', false),
    'users', JSON_OBJECT('view', false, 'create', false, 'edit', false, 'delete', false)
));

-- 6. เพิ่มผู้ใช้เริ่มต้น
-- รหัสผ่าน: admin123 (ควรใช้ bcrypt ในการ hash)
-- สำหรับตัวอย่างนี้ใช้ SHA256 ง่ายๆ ก่อน (ในการใช้งานจริงควรใช้ bcrypt)
INSERT INTO users (username, password_hash, email, full_name, phone, role_id, department, position, is_active, is_verified) VALUES
('admin', SHA2('admin123', 256), 'admin@satun-eoc.go.th', 'ผู้ดูแลระบบ', '074-123456', 1, 'ศูนย์ EOC จังหวัดสตูล', 'ผู้ดูแลระบบ', TRUE, TRUE),
('eoc_manager1', SHA2('manager123', 256), 'manager@satun-eoc.go.th', 'นายสมชาย ใจดี', '074-111111', 2, 'ศูนย์ EOC จังหวัดสตูล', 'ผู้จัดการ EOC', TRUE, TRUE),
('staff_flood', SHA2('staff123', 256), 'flood@satun-eoc.go.th', 'นางสมใจ รักงาน', '074-222222', 3, 'ศูนย์ EOC จังหวัดสตูล', 'เจ้าหน้าที่ฝ่ายน้ำท่วม', TRUE, TRUE),
('staff_drought', SHA2('staff123', 256), 'drought@satun-eoc.go.th', 'นายประสิทธิ์ ช่วยงาน', '074-333333', 3, 'ศูนย์ EOC จังหวัดสตูล', 'เจ้าหน้าที่ฝ่ายภัยแล้ง', TRUE, TRUE),
('local_mueang', SHA2('local123', 256), 'mueang@satun.go.th', 'นายสมศักดิ์ พัฒนา', '074-444444', 4, 'อำเภอเมืองสตูล', 'นักวิเคราะห์', TRUE, TRUE);

-- ===================================
-- Stored Procedures สำหรับจัดการผู้ใช้
-- ===================================

DELIMITER $$

-- 7. ตรวจสอบ login
CREATE PROCEDURE sp_authenticate_user(
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(255)
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_password_hash VARCHAR(255);
    
    -- ดึงข้อมูลผู้ใช้
    SELECT id, password_hash INTO v_user_id, v_password_hash
    FROM users 
    WHERE username = p_username AND is_active = TRUE;
    
    -- ตรวจสอบรหัสผ่าน (ใช้ SHA256 สำหรับตัวอย่าง)
    IF v_password_hash = SHA2(p_password, 256) THEN
        -- อัพเดท last_login
        UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = v_user_id;
        
        -- คืนข้อมูลผู้ใช้
        SELECT 
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.phone,
            u.department,
            u.position,
            u.district_code,
            u.tambon_code,
            r.role_name,
            r.role_display_name,
            r.permissions,
            u.last_login
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = v_user_id;
    ELSE
        -- รหัสผ่านไม่ถูกต้อง
        SELECT NULL as id;
    END IF;
END$$

-- 8. สร้าง session
CREATE PROCEDURE sp_create_session(
    IN p_user_id INT,
    IN p_session_token VARCHAR(255),
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT,
    IN p_expires_hours INT
)
BEGIN
    INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
    VALUES (
        p_user_id, 
        p_session_token, 
        p_ip_address, 
        p_user_agent, 
        DATE_ADD(CURRENT_TIMESTAMP, INTERVAL p_expires_hours HOUR)
    );
    
    SELECT LAST_INSERT_ID() as session_id;
END$$

-- 9. ตรวจสอบ session
CREATE PROCEDURE sp_validate_session(
    IN p_session_token VARCHAR(255)
)
BEGIN
    SELECT 
        s.id as session_id,
        s.user_id,
        u.username,
        u.full_name,
        r.role_name,
        r.permissions,
        s.expires_at
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    WHERE s.session_token = p_session_token 
      AND s.expires_at > CURRENT_TIMESTAMP
      AND u.is_active = TRUE;
END$$

-- 10. บันทึก activity log
CREATE PROCEDURE sp_log_activity(
    IN p_user_id INT,
    IN p_action VARCHAR(100),
    IN p_resource VARCHAR(255),
    IN p_details JSON,
    IN p_ip_address VARCHAR(45)
)
BEGIN
    INSERT INTO user_activity_log (user_id, action, resource, details, ip_address)
    VALUES (p_user_id, p_action, p_resource, p_details, p_ip_address);
END$$

-- 11. ดึงผู้ใช้ทั้งหมด (สำหรับ admin)
CREATE PROCEDURE sp_get_all_users()
BEGIN
    SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.phone,
        u.department,
        u.position,
        r.role_display_name as role,
        u.is_active,
        u.last_login,
        u.created_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC;
END$$

-- 12. สร้างผู้ใช้ใหม่
CREATE PROCEDURE sp_create_user(
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(255),
    IN p_email VARCHAR(100),
    IN p_full_name VARCHAR(150),
    IN p_phone VARCHAR(20),
    IN p_role_id INT,
    IN p_department VARCHAR(100),
    IN p_position VARCHAR(100),
    IN p_district_code VARCHAR(10),
    IN p_tambon_code VARCHAR(10),
    IN p_created_by INT
)
BEGIN
    INSERT INTO users (
        username, password_hash, email, full_name, phone, 
        role_id, department, position, district_code, tambon_code, created_by
    ) VALUES (
        p_username, SHA2(p_password, 256), p_email, p_full_name, p_phone,
        p_role_id, p_department, p_position, p_district_code, p_tambon_code, p_created_by
    );
    
    SELECT LAST_INSERT_ID() as user_id;
END$$

-- 13. อัพเดทข้อมูลผู้ใช้
CREATE PROCEDURE sp_update_user(
    IN p_user_id INT,
    IN p_email VARCHAR(100),
    IN p_full_name VARCHAR(150),
    IN p_phone VARCHAR(20),
    IN p_department VARCHAR(100),
    IN p_position VARCHAR(100),
    IN p_is_active BOOLEAN
)
BEGIN
    UPDATE users SET
        email = COALESCE(p_email, email),
        full_name = COALESCE(p_full_name, full_name),
        phone = COALESCE(p_phone, phone),
        department = COALESCE(p_department, department),
        position = COALESCE(p_position, position),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_user_id;
    
    SELECT ROW_COUNT() as affected_rows;
END$$

-- 14. เปลี่ยนรหัสผ่าน
CREATE PROCEDURE sp_change_password(
    IN p_user_id INT,
    IN p_old_password VARCHAR(255),
    IN p_new_password VARCHAR(255)
)
BEGIN
    DECLARE v_current_hash VARCHAR(255);
    
    SELECT password_hash INTO v_current_hash
    FROM users WHERE id = p_user_id;
    
    IF v_current_hash = SHA2(p_old_password, 256) THEN
        UPDATE users SET password_hash = SHA2(p_new_password, 256)
        WHERE id = p_user_id;
        
        SELECT 1 as success, 'Password changed successfully' as message;
    ELSE
        SELECT 0 as success, 'Current password is incorrect' as message;
    END IF;
END$$

DELIMITER ;

-- ===================================
-- Views สำหรับรายงาน
-- ===================================

-- 15. View: ผู้ใช้ที่ active
CREATE OR REPLACE VIEW v_active_users AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    r.role_display_name as role,
    u.department,
    u.last_login,
    TIMESTAMPDIFF(DAY, u.last_login, CURRENT_TIMESTAMP) as days_since_login
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.is_active = TRUE;

-- 16. View: สถิติการใช้งาน
CREATE OR REPLACE VIEW v_user_statistics AS
SELECT 
    r.role_display_name as role,
    COUNT(*) as total_users,
    SUM(CASE WHEN u.is_active THEN 1 ELSE 0 END) as active_users,
    SUM(CASE WHEN u.last_login > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as active_last_week
FROM users u
JOIN roles r ON u.role_id = r.id
GROUP BY r.id, r.role_display_name;

-- 17. View: Activity log สรุป
CREATE OR REPLACE VIEW v_activity_summary AS
SELECT 
    DATE(created_at) as activity_date,
    action,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM user_activity_log
WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY DATE(created_at), action
ORDER BY activity_date DESC, count DESC;

-- ===================================
-- Indexes เพิ่มเติมสำหรับ Performance
-- ===================================

ALTER TABLE users ADD INDEX idx_district (district_code);
ALTER TABLE users ADD INDEX idx_tambon (tambon_code);
ALTER TABLE users ADD INDEX idx_last_login (last_login);

-- ===================================
-- สิ้นสุดการสร้าง
-- ===================================

SELECT 'User management system created successfully!' as message;
