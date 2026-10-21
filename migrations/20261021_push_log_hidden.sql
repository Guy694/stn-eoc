-- ลบรายการออกจากประวัติการส่งแจ้งเตือน (เช่น ข้อความทดสอบ) แบบซ่อน ไม่ลบแถวจริง
-- เก็บแถวไว้เพราะ alert_key ใช้กันส่งเตือนภัยอัตโนมัติซ้ำ · ซ่อนแล้วไม่แสดงทั้งหน้าผู้ดูแลและหน้าประชาชน · รันซ้ำได้
SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE public_push_log ADD COLUMN hidden_at DATETIME NULL AFTER finished_at, ADD COLUMN hidden_by INT NULL AFTER hidden_at',
        'SELECT 1')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'public_push_log' AND COLUMN_NAME = 'hidden_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
