-- Confirm existing email users after disabling email confirmation in Supabase Auth settings.
-- Future users are controlled by supabase/config.toml:
-- [auth.email] enable_confirmations = false

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email IS NOT NULL
  AND email_confirmed_at IS NULL;
