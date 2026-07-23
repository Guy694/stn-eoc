CREATE TABLE IF NOT EXISTS area_population (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  province_code VARCHAR(10) NOT NULL,
  district_code VARCHAR(20) NULL,
  district_name VARCHAR(160) NOT NULL,
  male_population BIGINT NOT NULL DEFAULT 0,
  female_population BIGINT NOT NULL DEFAULT 0,
  population BIGINT NOT NULL,
  population_year INT NULL,
  population_scope VARCHAR(40) NOT NULL DEFAULT 'all',
  source_name VARCHAR(255) NOT NULL,
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_area_population_source (province_code, district_name, population_scope, source_name),
  CONSTRAINT chk_area_population_gender_total
    CHECK (population = male_population + female_population),
  KEY idx_area_population_district (district_name, population_year)
);

CREATE TABLE IF NOT EXISTS eoc_file_assets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  asset_type VARCHAR(60) NOT NULL,
  eoc_type VARCHAR(80) NULL,
  session_id BIGINT NULL,
  report_date DATE NULL,
  storage_path VARCHAR(500) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  uploaded_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_eoc_file_storage_path (storage_path),
  KEY idx_eoc_file_lookup (asset_type, eoc_type, session_id, report_date),
  KEY idx_eoc_file_created (created_at)
);

CREATE TABLE IF NOT EXISTS area_risk_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  district_name VARCHAR(160) NOT NULL,
  hazard_type VARCHAR(80) NOT NULL,
  susceptibility_score DECIMAL(8,2) NULL,
  model_version VARCHAR(80) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_area_hazard_model (district_name, hazard_type, model_version),
  KEY idx_area_risk_current (hazard_type, district_name, source_updated_at)
);

CREATE TABLE IF NOT EXISTS route_corridors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  corridor_key VARCHAR(120) NOT NULL,
  corridor_name VARCHAR(255) NOT NULL,
  district_names JSON NOT NULL,
  route_hint TEXT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_updated_at DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_route_corridor_key (corridor_key),
  KEY idx_route_corridor_active (is_active)
);
