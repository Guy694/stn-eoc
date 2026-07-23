-- Standard provenance metadata for existing master-data sources.

ALTER TABLE agency_contacts
  ADD COLUMN source_name VARCHAR(255) NULL AFTER status,
  ADD COLUMN source_updated_at DATETIME NULL AFTER source_name,
  ADD COLUMN updated_by INT NULL AFTER source_updated_at,
  ADD CONSTRAINT fk_agency_contacts_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL;

ALTER TABLE health_facilities
  ADD COLUMN source_name VARCHAR(255) NULL AFTER risk_level,
  ADD COLUMN source_updated_at DATETIME NULL AFTER source_name,
  ADD COLUMN updated_by INT NULL AFTER source_updated_at,
  ADD CONSTRAINT fk_health_facilities_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL;

ALTER TABLE common_diseases
  ADD COLUMN source_name VARCHAR(255) NULL AFTER description,
  ADD COLUMN source_updated_at DATETIME NULL AFTER source_name,
  ADD COLUMN updated_by INT NULL AFTER source_updated_at,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD CONSTRAINT fk_common_diseases_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL;

ALTER TABLE area_risk_profiles
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER source_updated_at,
  ADD COLUMN updated_by INT NULL AFTER is_active,
  ADD CONSTRAINT fk_area_risk_profiles_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL;

ALTER TABLE route_corridors
  ADD COLUMN updated_by INT NULL AFTER is_active,
  ADD CONSTRAINT fk_route_corridors_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL;

ALTER TABLE satun_village_polygon
  ADD COLUMN source_name VARCHAR(255) NULL AFTER shape_area,
  ADD COLUMN source_updated_at DATETIME NULL AFTER source_name,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER source_updated_at,
  ADD COLUMN updated_by INT NULL AFTER is_active,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER updated_by,
  ADD CONSTRAINT fk_satun_polygon_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL,
  ADD KEY idx_satun_polygon_active (is_active, distname, subdistnam);

