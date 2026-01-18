-- Multi-Photo Upload Support
-- Add photos column as JSON array to support multiple photos

ALTER TABLE public_incident_reports
ADD COLUMN IF NOT EXISTS photos JSON NULL COMMENT 'Array of photo base64 strings',
ADD COLUMN IF NOT EXISTS photo_count INT DEFAULT 0 COMMENT 'Number of photos uploaded';

-- Initialize empty array for all existing records
UPDATE public_incident_reports
SET photos = JSON_ARRAY(),
    photo_count = 0
WHERE photos IS NULL;

-- Note: Old 'photo' column (if exists) is kept for backward compatibility
-- New reports will use 'photos' array instead
-- You can manually drop the old column later if needed:
-- ALTER TABLE public_incident_reports DROP COLUMN IF EXISTS photo;
