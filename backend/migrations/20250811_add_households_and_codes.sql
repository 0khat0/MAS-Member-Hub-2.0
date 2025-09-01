-- Create extension if available (optional)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Add households table
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email VARCHAR NOT NULL,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    email_verification_token_hash TEXT,
    email_verification_expires_at TIMESTAMP WITH TIME ZONE,
    household_code VARCHAR(6) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_households_owner_email ON households (owner_email);
CREATE INDEX IF NOT EXISTS idx_households_created_at ON households (created_at);
-- Removed unique constraint on owner_email to allow retry with same email
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_households_email_unique ON households (lower(owner_email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_household_code ON households (household_code);

-- Members alterations
ALTER TABLE IF EXISTS members
  ADD COLUMN IF NOT EXISTS household_id uuid NULL REFERENCES households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS barcode TEXT NULL;

-- Helpful indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_member_code ON members (member_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_barcode ON members (barcode);


