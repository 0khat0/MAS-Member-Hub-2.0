-- Migration: Remove member_code, enhance household_code as account number
-- Date: 2025-01-15

-- Remove member_code column from members table
ALTER TABLE IF EXISTS members DROP COLUMN IF EXISTS member_code;

-- Drop the unique index on member_code
DROP INDEX IF EXISTS idx_members_member_code;

-- Update household_code to be 6 characters (remove MAS- prefix if exists)
UPDATE households 
SET household_code = SUBSTRING(household_code FROM 5) 
WHERE household_code LIKE 'MAS-%';

-- Ensure household_code is unique and indexed
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_account_number ON households (household_code);

-- Add comment to clarify household_code is now the account number
COMMENT ON COLUMN households.household_code IS 'Account number for the household (6 characters)';
