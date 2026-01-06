-- SQL Script to add eoc_type column to existing shelter_centers table

-- Step 1: Add eoc_type column (allow NULL temporarily)
ALTER TABLE shelter_centers 
ADD COLUMN eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NULL AFTER sheltername;

-- Step 2: Update existing records (set default to 'flood' or update based on name)
UPDATE shelter_centers 
SET eoc_type = CASE 
    WHEN sheltername LIKE '%น้ำท่วม%' THEN 'flood'
    WHEN sheltername LIKE '%สึนามิ%' THEN 'tsunami'
    WHEN sheltername LIKE '%แผ่นดินไหว%' THEN 'earthquake'
    WHEN sheltername LIKE '%โรคระบาด%' OR sheltername LIKE '%โรงพยาบาล%' THEN 'disease'
    WHEN sheltername LIKE '%ภัยแล้ง%' OR sheltername LIKE '%น้ำ%' THEN 'drought'
    ELSE 'flood' -- default to flood for general shelters
END
WHERE eoc_type IS NULL;

-- Step 3: Make eoc_type NOT NULL
ALTER TABLE shelter_centers 
MODIFY COLUMN eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease') NOT NULL;

-- Step 4: Add index for better performance
ALTER TABLE shelter_centers 
ADD INDEX idx_eoc_type (eoc_type);

-- Verify the changes
SELECT id, sheltername, eoc_type FROM shelter_centers;
