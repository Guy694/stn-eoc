-- Extend disease_reports so imported dengue case data can be mapped by village
-- without storing patient-identifying fields from the source spreadsheet.

ALTER TABLE disease_reports
MODIFY health_facility_id INT NULL COMMENT 'รหัสหน่วยบริการ (nullable for village-level imports)';

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN village_polygon_id INT NULL AFTER health_facility_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'village_polygon_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN district_name VARCHAR(100) NULL AFTER disease_name',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'district_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN tambon_name VARCHAR(100) NULL AFTER district_name',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'tambon_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN moo VARCHAR(10) NULL AFTER tambon_name',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'moo'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN village_name VARCHAR(150) NULL AFTER moo',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'village_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN home_lat DECIMAL(10,7) NULL AFTER village_name',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'home_lat'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN home_lng DECIMAL(11,7) NULL AFTER home_lat',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'home_lng'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN source_key VARCHAR(191) NULL AFTER home_lng',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'source_key'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD COLUMN import_source VARCHAR(255) NULL AFTER source_key',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND COLUMN_NAME = 'import_source'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD UNIQUE KEY unique_disease_reports_source_key (source_key)',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND INDEX_NAME = 'unique_disease_reports_source_key'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD INDEX idx_disease_reports_village (session_id, disease_name, district_name, tambon_name, moo)',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND INDEX_NAME = 'idx_disease_reports_village'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE disease_reports ADD INDEX idx_disease_reports_polygon (village_polygon_id)',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'disease_reports'
      AND INDEX_NAME = 'idx_disease_reports_polygon'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
