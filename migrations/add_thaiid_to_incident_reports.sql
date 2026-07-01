-- Add ThaiID verification columns to public_incident_reports.
-- MySQL 8 does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so use
-- information_schema checks and dynamic SQL to keep this migration re-runnable.

SET @db_name = DATABASE();

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND COLUMN_NAME = 'verified_by_thaiid'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE public_incident_reports ADD COLUMN verified_by_thaiid BOOLEAN DEFAULT FALSE COMMENT ''Whether this report was submitted by a ThaiID-verified citizen''',
    'SELECT ''verified_by_thaiid already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND COLUMN_NAME = 'national_id'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE public_incident_reports ADD COLUMN national_id VARCHAR(13) NULL COMMENT ''Deprecated: do not store raw National ID''',
    'SELECT ''national_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND COLUMN_NAME = 'citizen_id'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE public_incident_reports ADD COLUMN citizen_id INT NULL COMMENT ''Citizen table id for ThaiID-verified reports''',
    'SELECT ''citizen_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND COLUMN_NAME = 'citizen_pid_hash'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE public_incident_reports ADD COLUMN citizen_pid_hash VARCHAR(64) NULL COMMENT ''HMAC hash of citizen National ID''',
    'SELECT ''citizen_pid_hash already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND INDEX_NAME = 'idx_verified_by_thaiid'
);
SET @sql = IF(
    @index_exists = 0,
    'CREATE INDEX idx_verified_by_thaiid ON public_incident_reports(verified_by_thaiid)',
    'SELECT ''idx_verified_by_thaiid already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND INDEX_NAME = 'idx_citizen_id'
);
SET @sql = IF(
    @index_exists = 0,
    'CREATE INDEX idx_citizen_id ON public_incident_reports(citizen_id)',
    'SELECT ''idx_citizen_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'public_incident_reports'
      AND INDEX_NAME = 'idx_citizen_pid_hash'
);
SET @sql = IF(
    @index_exists = 0,
    'CREATE INDEX idx_citizen_pid_hash ON public_incident_reports(citizen_pid_hash)',
    'SELECT ''idx_citizen_pid_hash already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Do not populate national_id with raw PID. Use citizen_id/citizen_pid_hash for lookups.
