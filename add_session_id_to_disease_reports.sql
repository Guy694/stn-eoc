-- เพิ่ม session_id ให้กับตาราง disease_reports
-- เพื่อให้รายงานโรคเชื่อมโยงกับ EOC Session แทนที่จะแยกตาม eoc_type

ALTER TABLE `disease_reports`
ADD COLUMN `session_id` INT UNSIGNED NULL AFTER `id`,
ADD KEY `idx_session_id` (`session_id`),
ADD CONSTRAINT `fk_disease_reports_session` 
    FOREIGN KEY (`session_id`) 
    REFERENCES `eoc_sessions` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

-- อัพเดท unique constraint ให้รวม session_id
ALTER TABLE `disease_reports`
DROP INDEX IF EXISTS `unique_report`,
ADD UNIQUE KEY `unique_report` (`session_id`, `report_date`, `health_facility_id`, `disease_name`);

-- หมายเหตุ: ถ้ามีข้อมูลเก่าอยู่แล้ว อาจต้องกำหนด session_id ให้กับข้อมูลเดิมก่อน
-- UPDATE disease_reports SET session_id = 1 WHERE session_id IS NULL;
