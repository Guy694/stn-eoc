-- รายงานประจำวันที่แยก "หน่วยบริการ" ในอำเภอเดียวกันได้ (เช่น สำรวจ/จ่ายยา Doxy รายหน่วยบริการตามชีตของ สสจ.)
-- unit_key ว่าง = รายงานระดับอำเภอ (MCATT / หน่วยแพทย์ / MERT / ทรัพยากร)
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'eoc_team_daily_reports' AND COLUMN_NAME = 'unit_key');
SET @sql = IF(@exists = 0, 'ALTER TABLE eoc_team_daily_reports ADD COLUMN unit_key VARCHAR(150) NOT NULL DEFAULT '''' COMMENT ''หน่วยบริการ (ว่าง = ทั้งอำเภอ)'' AFTER district_name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'eoc_team_daily_reports' AND INDEX_NAME = 'uniq_team_report_day');
SET @sql = IF(@exists > 0, 'ALTER TABLE eoc_team_daily_reports DROP INDEX uniq_team_report_day', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'eoc_team_daily_reports' AND INDEX_NAME = 'uniq_team_report_unit_day');
SET @sql = IF(@exists = 0, 'ALTER TABLE eoc_team_daily_reports ADD UNIQUE KEY uniq_team_report_unit_day (session_id, report_type, report_date, district_name, unit_key)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
