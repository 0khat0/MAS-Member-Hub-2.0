-- Drop legacy email-verification columns.
-- This app does not support OTP or email verification flows.

ALTER TABLE households
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS email_verification_token_hash,
  DROP COLUMN IF EXISTS email_verification_expires_at;


