-- Add columns for ThaiID verification to public_incident_reports table

ALTER TABLE public_incident_reports
ADD COLUMN IF NOT EXISTS verified_by_thaiid BOOLEAN DEFAULT FALSE COMMENT 'Whether this report was submitted by a ThaiID-verified citizen',
ADD COLUMN IF NOT EXISTS national_id VARCHAR(13) NULL COMMENT 'National ID number (13 digits) - encrypted/hashed in production';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_verified_by_thaiid ON public_incident_reports(verified_by_thaiid);
CREATE INDEX IF NOT EXISTS idx_national_id ON public_incident_reports(national_id);

-- Note: In production, consider encrypting the national_id column for privacy
-- Example: Use AES_ENCRYPT() when inserting and AES_DECRYPT() when retrieving
