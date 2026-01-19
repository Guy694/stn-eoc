-- Create test commander account
-- Username: commander01
-- Password: commander123
INSERT INTO officer (username, password_hash, role, given_name, family_name, position, department, is_active, email, phone)
VALUES (
    'commander01',
    '$2b$10$f9h/HnG7lun3cLIkj6vgiupWst8bLAGFC8cuNvTmf8z7KIG3WWb7K',
    'commander',
    'สมชาย',
    'ใจกล้า',
    'ผู้บัญชาการ EOC',
    'ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน',
    1,
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
    is_active = 1;
