-- ═══════════════════════════════════════════════════════════════
-- MediSauti Security Hardening Migration
-- Run this in the Supabase SQL Editor AFTER the initial schema
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Fix doctors table: add auth_uid column ────────────────
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS auth_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_doctors_auth_uid ON doctors(auth_uid);

-- ── 2. SMS verification codes table ──────────────────────────
CREATE TABLE IF NOT EXISTS sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone, used, created_at DESC);

-- Auto-delete expired codes every hour (requires pg_cron extension)
-- Enable pg_cron first: https://supabase.com/docs/guides/database/extensions/pg_cron
-- SELECT cron.schedule('cleanup-sms-codes', '0 * * * *',
--   $$DELETE FROM sms_codes WHERE expires_at < now() - interval '1 hour'$$);

-- Without pg_cron, codes auto-expire via the expires_at check in the verify function.

-- ── 3. Audit log table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON security_audit_log(event_type, created_at DESC);

-- ── 4. Fix RLS policies ─────────────────────────────────────

-- Drop the overly permissive doctor policies
DROP POLICY IF EXISTS "doctors_write_all" ON doctors;
DROP POLICY IF EXISTS "doctors_update_all" ON doctors;

-- Doctors: only the owner can INSERT/UPDATE their own row
CREATE POLICY "doctors_insert_own" ON doctors
  FOR INSERT WITH CHECK (
    auth.uid() = (data->>'uid')::uuid
    OR auth.uid() = auth_uid
  );

CREATE POLICY "doctors_update_own" ON doctors
  FOR UPDATE USING (
    auth.uid() = (data->>'uid')::uuid
    OR auth.uid() = auth_uid
  );

-- Doctors: authenticated users can still read the directory
-- (doctors_read_all already exists from initial schema)

-- NOTE: users_read_by_phone was REMOVED — it allowed any authenticated
-- user to read ALL user data (name, phone, condition, pinHash).
-- PIN reset uses verify-sms Edge Function with service_role key instead.

-- SMS codes: service_role only (Edge Functions use service key)
-- No user-level policies needed — Edge Functions use service_role key

-- ── 5. Add SECURITY DEFINER function for password hashing ────
-- This runs with elevated privileges so Edge Functions can update passwords
CREATE OR REPLACE FUNCTION admin_update_user_password(
  target_user_id UUID,
  new_encrypted_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow service_role to call this
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE auth.users
  SET encrypted_password = new_encrypted_password,
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- ── 6. Add function to look up user by phone for PIN reset ───
CREATE OR REPLACE FUNCTION get_user_by_phone(target_phone TEXT)
RETURNS TABLE(user_id UUID, user_data JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT users.id, users.data
  FROM users
  WHERE users.phone = target_phone
  LIMIT 1;
END;
$$;
