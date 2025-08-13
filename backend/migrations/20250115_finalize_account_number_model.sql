-- Migration: Finalize Account Number Model
-- Date: 2025-01-15
-- Purpose: Ensure all households have unique 6-character account numbers and remove legacy member_code

-- 1. Ensure household_code column exists and has proper constraints
DO $$ 
BEGIN
    -- Add household_code column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'households' AND column_name = 'household_code') THEN
        ALTER TABLE households ADD COLUMN household_code VARCHAR(6);
    END IF;
    
    -- Change to NOT NULL if it's currently nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'households' AND column_name = 'household_code' AND is_nullable = 'YES') THEN
        ALTER TABLE households ALTER COLUMN household_code SET NOT NULL;
    END IF;
    
    -- Change to VARCHAR(6) if it's not already
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'households' AND column_name = 'household_code' AND character_maximum_length != 6) THEN
        ALTER TABLE households ALTER COLUMN household_code TYPE VARCHAR(6);
    END IF;
END $$;

-- 2. Remove any legacy member_code references (if they still exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'member_code') THEN
        ALTER TABLE members DROP COLUMN member_code;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_members_member_code') THEN
        DROP INDEX idx_members_member_code;
    END IF;
END $$;

-- 3. Generate account numbers for any households that don't have them
DO $$
DECLARE
    h RECORD;
    new_code VARCHAR(6);
    attempts INTEGER;
    max_attempts INTEGER := 10;
BEGIN
    -- Function to generate a random 6-character code
    CREATE OR REPLACE FUNCTION generate_account_code() RETURNS VARCHAR(6) AS $$
    DECLARE
        alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        result TEXT := '';
        i INTEGER;
    BEGIN
        FOR i IN 1..6 LOOP
            result := result || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1);
        END LOOP;
        RETURN result;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Update households without codes
    FOR h IN SELECT id FROM households WHERE household_code IS NULL OR household_code = '' LOOP
        attempts := 0;
        LOOP
            new_code := generate_account_code();
            attempts := attempts + 1;
            
            -- Try to update with the new code
            BEGIN
                UPDATE households SET household_code = new_code WHERE id = h.id;
                EXIT; -- Success, exit the loop
            EXCEPTION WHEN unique_violation THEN
                -- Code already exists, try again
                IF attempts >= max_attempts THEN
                    RAISE EXCEPTION 'Failed to generate unique code for household % after % attempts', h.id, max_attempts;
                END IF;
                CONTINUE;
            END;
        END LOOP;
    END LOOP;
    
    -- Clean up the function
    DROP FUNCTION generate_account_code();
END $$;

-- 4. Ensure household_code is unique and indexed
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_account_number ON households (household_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_account_number_upper ON households (upper(household_code));

-- 5. Add check constraint for length (PostgreSQL 12+)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'household_code_len_check'
    ) THEN
        ALTER TABLE households ADD CONSTRAINT household_code_len_check 
        CHECK (char_length(household_code) = 6);
    END IF;
END $$;

-- 6. Add check constraint for valid characters
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'household_code_chars_check'
    ) THEN
        ALTER TABLE households ADD CONSTRAINT household_code_chars_check 
        CHECK (household_code ~ '^[A-Z2-9]{6}$');
    END IF;
END $$;

-- 7. Add comment to clarify the purpose
COMMENT ON COLUMN households.household_code IS 'Account number for the household (6 characters: A-Z, 2-9 only)';

-- 8. Verify the migration
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_households,
    COUNT(CASE WHEN household_code IS NOT NULL AND char_length(household_code) = 6 THEN 1 END) as valid_codes,
    COUNT(CASE WHEN household_code ~ '^[A-Z2-9]{6}$' THEN 1 END) as properly_formatted_codes
FROM households;
