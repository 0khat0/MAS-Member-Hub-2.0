-- Create extension if available (optional)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY,
  owner_email TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ NULL,
  email_verification_token_hash TEXT NULL,
  email_verification_expires_at TIMESTAMPTZ NULL,
  household_code TEXT UNIQUE NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Members alterations
ALTER TABLE IF EXISTS members
  ADD COLUMN IF NOT EXISTS household_id uuid NULL REFERENCES households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS barcode TEXT NULL;

-- Helpful indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_email_unique ON households (lower(owner_email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_member_code ON members (member_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_household_code ON households (household_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_barcode ON members (barcode);


