-- =============================================
-- Extend shelter_centers for Satun shelter Google Sheet import
-- =============================================

ALTER TABLE shelter_centers
MODIFY lat DECIMAL(10,7) NULL,
MODIFY lon DECIMAL(10,7) NULL,
ADD COLUMN source_key VARCHAR(80) NULL COMMENT 'Stable import key from source sheet' AFTER id,
ADD COLUMN shelter_status VARCHAR(50) NULL COMMENT 'สถานะจากชีต เช่น ปิด/ยังไม่เปิด/เปิด' AFTER eoc_type,
ADD COLUMN current_occupancy_total INT NULL DEFAULT 0 COMMENT 'จำนวนผู้พักพิง/อพยพรวมจากชีต' AFTER shelter_capacity,
ADD COLUMN occupancy_child_0_5 INT NULL DEFAULT 0 AFTER current_occupancy_total,
ADD COLUMN occupancy_child_6_17 INT NULL DEFAULT 0 AFTER occupancy_child_0_5,
ADD COLUMN occupancy_youth_18_25 INT NULL DEFAULT 0 AFTER occupancy_child_6_17,
ADD COLUMN occupancy_working_26_59 INT NULL DEFAULT 0 AFTER occupancy_youth_18_25,
ADD COLUMN occupancy_elderly_60_plus INT NULL DEFAULT 0 AFTER occupancy_working_26_59,
ADD COLUMN occupancy_disabled INT NULL DEFAULT 0 AFTER occupancy_elderly_60_plus,
ADD COLUMN occupancy_bedridden INT NULL DEFAULT 0 AFTER occupancy_disabled,
ADD COLUMN responsible_org VARCHAR(255) NULL AFTER contact_phone,
ADD COLUMN coordinator_name VARCHAR(255) NULL AFTER responsible_org,
ADD COLUMN coordinator_phone VARCHAR(100) NULL AFTER coordinator_name,
ADD COLUMN health_service_name VARCHAR(255) NULL AFTER coordinator_phone,
ADD COLUMN health_staff_per_day VARCHAR(255) NULL AFTER health_service_name,
ADD COLUMN health_contact_phone VARCHAR(255) NULL AFTER health_staff_per_day,
ADD COLUMN source_as_of_date DATE NULL AFTER health_contact_phone,
ADD COLUMN import_source VARCHAR(255) NULL AFTER source_as_of_date,
ADD UNIQUE KEY uq_shelter_centers_source_key (source_key);
