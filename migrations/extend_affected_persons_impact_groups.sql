-- =============================================
-- Extend affected_persons with impact groups from flood care sheet
-- =============================================

ALTER TABLE affected_persons
ADD COLUMN citizen_property INT NOT NULL DEFAULT 0 AFTER tambon,
ADD COLUMN citizen_injured INT NOT NULL DEFAULT 0 AFTER citizen_property,
ADD COLUMN citizen_deaths INT NOT NULL DEFAULT 0 AFTER citizen_injured,
ADD COLUMN citizen_missing INT NOT NULL DEFAULT 0 AFTER citizen_deaths,
ADD COLUMN volunteer_property INT NOT NULL DEFAULT 0 AFTER citizen_missing,
ADD COLUMN volunteer_injured INT NOT NULL DEFAULT 0 AFTER volunteer_property,
ADD COLUMN volunteer_deaths INT NOT NULL DEFAULT 0 AFTER volunteer_injured,
ADD COLUMN volunteer_missing INT NOT NULL DEFAULT 0 AFTER volunteer_deaths,
ADD COLUMN staff_property INT NOT NULL DEFAULT 0 AFTER volunteer_missing,
ADD COLUMN staff_injured INT NOT NULL DEFAULT 0 AFTER staff_property,
ADD COLUMN staff_deaths INT NOT NULL DEFAULT 0 AFTER staff_injured,
ADD COLUMN staff_missing INT NOT NULL DEFAULT 0 AFTER staff_deaths,
ADD COLUMN medicine_support INT NOT NULL DEFAULT 0 AFTER affected,
ADD COLUMN evacuated INT NOT NULL DEFAULT 0 AFTER medicine_support,
ADD COLUMN not_evacuated INT NOT NULL DEFAULT 0 AFTER evacuated,
ADD INDEX idx_affected_persons_assistance (medicine_support, evacuated, not_evacuated);
