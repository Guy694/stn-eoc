-- ===============================================
-- ลบ Objects ที่ไม่ใช้งานในระบบ STN-EOC
-- ===============================================
-- อัปเดต: 23 ธันวาคม 2568
-- ===============================================

-- ลบ Views ที่ไม่ใช้แล้ว
DROP VIEW IF EXISTS v_active_users;
DROP VIEW IF EXISTS v_activity_summary;
DROP VIEW IF EXISTS v_user_statistics;

-- ลบ Tables ที่ไม่ได้ใช้งาน
-- 1. User Management Tables (ใช้ officer แทน)
DROP TABLE IF EXISTS user_activity_log;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

-- 2. Deprecated Tables (ใช้ flood_area_status แทน)
DROP TABLE IF EXISTS daily_village_flood;
DROP TABLE IF EXISTS daily_village_flood_status;
DROP TABLE IF EXISTS daily_village_summary;

-- 3. Module ที่ยังไม่ได้พัฒนา
DROP TABLE IF EXISTS drought_area_status;

-- 4. Old EOC Table (ใช้ eoc_sessions แทน)
DROP TABLE IF EXISTS eoc;

-- แสดงผลลัพธ์
SELECT 'Objects cleanup completed!' AS message;
SHOW TABLES;