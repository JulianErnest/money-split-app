-- Migration: Prepare database for Apple Sign-In users
-- Backward compatible: existing phone OTP users unaffected
--
-- Changes:
-- 1. Make users.phone_number nullable (Apple users have no phone at auth time)
-- 2. Rewrite handle_pending_member_claim trigger for NULL phone
-- 3. Create link_phone_to_pending_invites RPC (called from profile setup)

-- ============================================================================
-- PART 1: Make phone_number nullable
-- ============================================================================
-- Existing rows all have phone_number values (from phone OTP signup).
-- Apple Sign-In users will have NULL until they enter phone in profile setup.
-- PostgreSQL UNIQUE allows multiple NULLs, so this is safe.

ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;

-- ============================================================================
-- PART 2: Rewrite auth trigger for Apple Sign-In compatibility
-- ============================================================================
-- Key changes from migration 00019:
-- 1. Use NULLIF(new.phone, '') to store NULL instead of empty string
-- 2. Only attempt phone-based invite linking if phone is present
-- 3. Apple users get a users row with phone_number = NULL

CREATE OR REPLACE FUNCTION public.handle_pending_member_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure public.users row exists
  -- NULLIF converts empty string (from social providers) to NULL
  INSERT INTO users (id, phone_number)
  VALUES (new.id, NULLIF(new.phone, ''))
  ON CONFLICT (id) DO NOTHING;

  -- Link identity to pending invites (only if phone is present)
  -- Apple Sign-In users have no phone at signup time; linking happens
  -- later via link_phone_to_pending_invites RPC during profile setup
  IF NULLIF(new.phone, '') IS NOT NULL THEN
    UPDATE pending_members
    SET user_id = new.id
    WHERE user_id IS NULL
      AND ltrim(phone_number, '+') = ltrim(new.phone, '+');
  END IF;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_pending_member_claim failed for phone %: %',
      new.phone, SQLERRM;
    RETURN new;
END;
$$;

-- ============================================================================
-- PART 3: New RPC for deferred invite linking
-- ============================================================================
-- Called from profile-setup.tsx AFTER the user enters their phone number.
-- Replicates the phone-matching behavior that the trigger performs for phone
-- OTP users, but at profile-setup time instead of auth time.

CREATE OR REPLACE FUNCTION public.link_phone_to_pending_invites(
  p_phone_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_phone text;
BEGIN
  -- Auth check
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Normalize phone: strip leading '+' to match stored format
  normalized_phone := ltrim(p_phone_number, '+');

  -- Link pending invites to this user
  -- Same matching pattern as handle_pending_member_claim
  UPDATE pending_members
  SET user_id = current_user_id
  WHERE user_id IS NULL
    AND ltrim(phone_number, '+') = normalized_phone;
END;
$$;
