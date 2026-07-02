-- =============================================
-- Base vulnerable group data usable across EOC sessions/types
-- =============================================

CREATE TABLE IF NOT EXISTS vulnerable_group_baselines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    province VARCHAR(100) NOT NULL DEFAULT 'สตูล',
    district VARCHAR(100) NOT NULL,
    tambon VARCHAR(100) NOT NULL,
    village VARCHAR(100) NULL,
    elderly INT NULL DEFAULT 0,
    children INT NULL DEFAULT 0,
    disabled INT NULL DEFAULT 0,
    bedridden INT NULL DEFAULT 0,
    pregnant INT NULL DEFAULT 0,
    chronic_illness INT NULL DEFAULT 0,
    total_cared INT NULL DEFAULT 0,
    moved INT NULL DEFAULT 0,
    notes TEXT NULL,
    needs TEXT NULL,
    import_source VARCHAR(255) NULL,
    source_url TEXT NULL,
    source_as_of_date DATE NULL,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_baseline_location (province, district, tambon, village),
    INDEX idx_location (district, tambon),
    INDEX idx_source_as_of_date (source_as_of_date)
);
