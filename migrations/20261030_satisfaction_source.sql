-- ประเมินความพึงพอใจ: เพิ่มคำถาม "รับทราบข่าวสารระบบนี้จากช่องทางไหน" (เลือกได้หลายข้อ ไม่บังคับ) — รันซ้ำได้
-- sources = รหัสช่องทางคั่นด้วยจุลภาค เช่น facebook,line · source_other = ข้อความเมื่อเลือก "อื่น ๆ" (ไม่ระบุตัวตน)
SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE satisfaction_feedback ADD COLUMN sources VARCHAR(120) NULL AFTER comment',
        'SELECT 1')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'satisfaction_feedback' AND COLUMN_NAME = 'sources'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE satisfaction_feedback ADD COLUMN source_other VARCHAR(100) NULL AFTER sources',
        'SELECT 1')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'satisfaction_feedback' AND COLUMN_NAME = 'source_other'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
