-- เพิ่ม column report_type ในตาราง public_incident_reports
-- เพื่อแยกประเภทรายงานเป็น "แจ้งความช่วยเหลือ" และ "แจ้งเส้นทางการจราจร"

ALTER TABLE public_incident_reports
ADD COLUMN report_type ENUM('help_request', 'traffic_report') DEFAULT 'help_request'
AFTER disaster_type;

-- อัพเดทข้อมูลเดิมให้เป็น help_request (default)
UPDATE public_incident_reports
SET report_type = 'help_request'
WHERE report_type IS NULL;
