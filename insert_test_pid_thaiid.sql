-- ตัวอย่างข้อมูลสำหรับทดสอบระบบ ThaiID Login
-- อัพเดตข้อมูล PID สำหรับ officer ที่มีอยู่

-- ข้อมูล PID ตัวอย่าง (ต้องแก้ไขเป็นเลขบัตรประชาชนจริงที่ลงทะเบียนกับ ThaiID)

-- 1. Admin
UPDATE officer 
SET pid = '1234567890123', 
    last_login = NULL 
WHERE username = 'admin';

-- 2. MCATT Team
UPDATE officer 
SET pid = '1234567890124', 
    last_login = NULL 
WHERE username = 'mcatt01';

-- 3. SAT Team
UPDATE officer 
SET pid = '1234567890125', 
    last_login = NULL 
WHERE username = 'sat01';

-- 4. SeRHT Team
UPDATE officer 
SET pid = '1234567890126', 
    last_login = NULL 
WHERE username = 'serht01';

-- 5. Staff
UPDATE officer 
SET pid = '1234567890127', 
    last_login = NULL 
WHERE username = 'staff01';

-- ตรวจสอบข้อมูลหลังอัพเดต
SELECT 
    id,
    username,
    full_name,
    role,
    pid,
    email,
    phone,
    thaiid_token,
    last_login,
    created_at
FROM officer
WHERE pid IS NOT NULL
ORDER BY id;

-- สร้างรายงานสรุปผู้ใช้ที่รองรับ ThaiID
SELECT 
    COUNT(*) as total_users,
    COUNT(pid) as users_with_pid,
    COUNT(thaiid_token) as users_with_token,
    COUNT(last_login) as users_logged_in
FROM officer;

-- ตรวจสอบ Activity Logs เกี่ยวกับ ThaiID
SELECT 
    al.id,
    al.user_name,
    al.action,
    al.details,
    al.timestamp,
    al.ip_address
FROM activity_logs al
WHERE al.action = 'LOGIN_THAIID'
ORDER BY al.timestamp DESC
LIMIT 20;

-- หมายเหตุ:
-- 1. เลข PID ที่ใช้ในตัวอย่างนี้เป็นเลขสมมติ ต้องแก้ไขเป็นเลขบัตรประชาชนจริง
-- 2. เลขบัตรประชาชนต้องตรงกับที่ลงทะเบียนกับ ThaiID
-- 3. ผู้ใช้แต่ละคนต้องมี PID ที่ไม่ซ้ำกัน (UNIQUE constraint)
-- 4. หลังจากอัพเดต PID แล้ว ผู้ใช้สามารถ login ด้วย ThaiID ได้ทันที
