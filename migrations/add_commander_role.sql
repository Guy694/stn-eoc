-- Add commander role to existing enum columns before inserting commander users.
ALTER TABLE officer
    MODIFY role ENUM('user','staff','MCATT','SAT','SeRHT','commander','admin') NOT NULL DEFAULT 'user',
    MODIFY requested_role ENUM('staff','MCATT','SAT','SeRHT','commander','admin') DEFAULT 'staff' COMMENT 'สิทธิ์การเข้าสู่ระบบ';

ALTER TABLE user_sessions
    MODIFY role ENUM('staff','MCATT','SAT','SeRHT','commander','admin') NOT NULL DEFAULT 'staff';

-- Create test commander account
-- Username: commander01
-- Set the password hash from a secure, environment-specific temporary password.
INSERT INTO officer (username, password_hash, role, given_name, family_name, position, department, is_approved, approved_time, email, phone)
VALUES (
    'commander01',
    '$2b$10$f9h/HnG7lun3cLIkj6vgiupWst8bLAGFC8cuNvTmf8z7KIG3WWb7K',
    'commander',
    'สมชาย',
    'ใจกล้า',
    'ผู้บัญชาการ EOC',
    'ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน',
    1,
    NOW(),
    'commander@satun.go.th',
    '074-123-456'
)
ON DUPLICATE KEY UPDATE
    password_hash = '$2b$10$f9h/HnG7lun3cLIkj6vgiupWst8bLAGFC8cuNvTmf8z7KIG3WWb7K',
    role = 'commander',
    given_name = 'สมชาย',
    family_name = 'ใจกล้า',
    position = 'ผู้บัญชาการ EOC',
    department = 'ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน',
    is_approved = 1,
    approved_time = COALESCE(approved_time, NOW());
