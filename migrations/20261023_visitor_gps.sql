-- ตำแหน่ง GPS ที่ผู้เข้าชมอนุญาต (ปัดเหลือทศนิยม 2 ตำแหน่ง ≈ 1 กม. ไม่ถึงระดับบ้าน)
-- เจ้าหน้าที่: กดอนุญาตจากแถบขอความยินยอมหลังเข้าสู่ระบบ · ประชาชน: ใช้ตำแหน่งที่อนุญาตไว้ตอนใช้ฟีเจอร์ (บ้านฉันเสี่ยงไหม แจ้งเหตุ ฯลฯ)
-- รันซ้ำได้
SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE visitor_access_log
            ADD COLUMN gps_latitude DECIMAL(6,2) NULL AFTER geo_source,
            ADD COLUMN gps_longitude DECIMAL(7,2) NULL AFTER gps_latitude,
            ADD COLUMN gps_accuracy_m INT NULL AFTER gps_longitude,
            ADD COLUMN gps_context VARCHAR(30) NULL AFTER gps_accuracy_m',
        'SELECT 1')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitor_access_log' AND COLUMN_NAME = 'gps_latitude'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
