ALTER TABLE area_population
  MODIFY district_code VARCHAR(20) NULL,
  MODIFY population_year INT NULL,
  ADD COLUMN male_population BIGINT NOT NULL DEFAULT 0 AFTER district_name,
  ADD COLUMN female_population BIGINT NOT NULL DEFAULT 0 AFTER male_population,
  ADD COLUMN population_scope VARCHAR(40) NOT NULL DEFAULT 'all' AFTER population_year;

ALTER TABLE area_population
  DROP INDEX uniq_area_population_year,
  ADD UNIQUE KEY uniq_area_population_source
    (province_code, district_name, population_scope, source_name),
  ADD CONSTRAINT chk_area_population_gender_total
    CHECK (population = male_population + female_population);
