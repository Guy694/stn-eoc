-- เพิ่ม column disaster_type ในตาราง public_incident_reports
ALTER TABLE public_incident_reports
ADD COLUMN IF NOT EXISTS disaster_type VARCHAR(50) DEFAULT 'flood' COMMENT 'ประเภทภัยพิบัติ (flood, drought, tsunami, earthquake, disease)'
AFTER urgency;

-- เพิ่ม index สำหรับ disaster_type
ALTER TABLE public_incident_reports
ADD INDEX IF NOT EXISTS idx_disaster_type (disaster_type);

-- อัพเดทข้อมูลเก่าให้มี disaster_type เป็น flood (default)
UPDATE public_incident_reports 
SET disaster_type = 'flood' 
WHERE disaster_type IS NULL OR disaster_type = '';
