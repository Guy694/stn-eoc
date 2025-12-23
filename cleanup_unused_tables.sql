-- ===============================================
-- ลบ Tables ที่ไม่ได้ใช้งานในระบบ STN-EOC
-- ===============================================
-- วันที่: 23 ธันวาคม 2568
-- 
-- สรุป Tables ที่ตรวจสอบ:
-- ✅ ใช้งาน: activity_logs, eoc_sessions, eoc_status, facility_types, 
--            flood_area_status, health_facilities, officer, 
--            satun_village_polygon, user_activity_log, user_sessions
-- ❌ ไม่ใช้งาน: daily_village_flood, drought_area_status, roles, users
-- ===============================================

-- สำรอง Tables ก่อนลบ (เผื่อต้องกู้คืน)
-- CREATE TABLE daily_village_flood_backup AS SELECT * FROM daily_village_flood;
-- CREATE TABLE drought_area_status_backup AS SELECT * FROM drought_area_status;
-- CREATE TABLE roles_backup AS SELECT * FROM roles;
-- CREATE TABLE users_backup AS SELECT * FROM users;

-- ===============================================
-- 1. ลบ table daily_village_flood
-- ใช้ flood_area_status แทนแล้ว
-- ===============================================
DROP TABLE IF EXISTS `daily_village_flood`;

-- ===============================================
-- 2. ลบ table drought_area_status
-- ยังไม่มีการใช้งาน Drought Module
-- ===============================================
DROP TABLE IF EXISTS `drought_area_status`;

-- ===============================================
-- 3. ลบ table roles และ users
-- ระบบใช้ officer table สำหรับ authentication แทน
-- ไม่ได้ใช้ RBAC แบบ roles + users
-- ===============================================
DROP TABLE IF EXISTS `user_activity_log`;  -- ลบ table ลูกก่อน
DROP TABLE IF EXISTS `user_sessions`;       -- ลบ table ลูกก่อน
DROP TABLE IF EXISTS `users`;               -- ลบ parent table
DROP TABLE IF EXISTS `roles`;               -- ลบ table roles

-- ===============================================
-- ตรวจสอบ Tables ที่เหลือ
-- ===============================================
SHOW TABLES;

-- ===============================================
-- สรุป Tables ที่เหลือหลังจากลบ:
-- ===============================================
-- 1. activity_logs         - ✅ ใช้งาน (บันทึก EOC activities)
-- 2. eoc_sessions          - ✅ ใช้งาน (Session EOC)
-- 3. eoc_status            - ✅ ใช้งาน (สถานะ EOC แต่ละประเภท)
-- 4. facility_types        - ✅ ใช้งาน (ประเภทสถานพยาบาล)
-- 5. flood_area_status     - ✅ ใช้งาน (สถานะน้ำท่วมรายหมู่บ้าน)
-- 6. health_facilities     - ✅ ใช้งาน (ข้อมูลสถานพยาบาล)
-- 7. officer               - ✅ ใช้งาน (ผู้ใช้งานระบบ)
-- 8. satun_village_polygon - ✅ ใช้งาน (ข้อมูลหมู่บ้าน + GIS)
-- ===============================================

SELECT '🎉 ลบ Tables ที่ไม่ใช้งานเรียบร้อยแล้ว!' AS message;
