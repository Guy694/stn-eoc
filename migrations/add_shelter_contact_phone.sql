-- Migration: Add contact_phone to shelter_centers table
-- Run this in phpMyAdmin or MySQL terminal

ALTER TABLE shelter_centers
ADD COLUMN contact_phone VARCHAR(20) NULL AFTER shelter_capacity;

-- Add index for faster queries (optional)
-- ALTER TABLE shelter_centers ADD INDEX idx_contact_phone (contact_phone);
