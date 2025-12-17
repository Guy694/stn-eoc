-- ลบ views ที่ไม่ใช้แล้ว
DROP VIEW IF EXISTS v_active_users;
DROP VIEW IF EXISTS v_activity_summary;
DROP VIEW IF EXISTS v_user_statistics;

-- ลบตาราง roles ถ้ามี
DROP TABLE IF EXISTS roles;
