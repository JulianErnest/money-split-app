# Phase 13: Database & Infrastructure Prep - Research

**Researched:** 2026-02-22
**Domain:** PostgreSQL schema migration, Supabase Auth configuration, Expo app.json config
**Confidence:** HIGH

## Summary

Phase 13 prepares the database and infrastructure for Apple Sign-In users without breaking existing phone OTP users. The work is entirely backward-compatible: existing phone OTP users are unaffected by all changes. The phase covers five requirements (DB-01 through DB-05) spanning three domains: (1) PostgreSQL schema migration to make `users.phone_number` nullable and update the auth trigger, (2) a new RPC for deferred invite linking, (3) Supabase dashboard configuration for the Apple provider, and (4) Expo app.json configuration for the `expo-apple-authentication` plugin.

All changes use standard PostgreSQL migration patterns and well-documented Supabase/Expo configuration. The existing codebase has 23 migrations, a mature trigger system, and established RPC patterns that serve as templates. The current `handle_pending_member_claim` trigger (migration 00019) must be rewritten to handle NULL phone from Apple Sign-In users, using `NULLIF` to convert empty strings to NULL. A new `link_phone_to_pending_invites` RPC must be created for Phase 15 to call when the user provides their phone number during profile setup.

**Primary recommendation:** Write a single migration file (00024) containing the ALTER TABLE, trigger rewrite, and new RPC. Configure Supabase dashboard and app.json in the same plan. Regenerate TypeScript types last.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase CLI | ^2.76.9 | Database migrations, type generation | Already in project devDependencies |
| @supabase/supabase-js | ^2.96.0 | Client SDK with `signInWithIdToken` support | Already installed, supports Apple native auth since v2.21.0 |
| PostgreSQL 15+ | (Supabase managed) | Database engine | Supabase standard, supports NULLIF, nullable UNIQUE |
| expo-apple-authentication | ~8.0.x | Config plugin for Sign in with Apple capability | Official Expo SDK package, required for EAS Build capability sync |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-crypto | ~15.0.x | Cryptographic nonce generation (SHA-256) | Phase 14 (auth implementation), NOT this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single migration file | Separate migrations per change | Single file is simpler; all changes are atomic and interdependent |
| `NULLIF(new.phone, '')` | `CASE WHEN` statement | NULLIF is more concise for the empty-string-to-NULL pattern |
| Partial unique index | Standard UNIQUE constraint | Standard UNIQUE already allows multiple NULLs in PostgreSQL; no change needed |

**Installation:**
```bash
npx expo install expo-apple-authentication
```

## Architecture Patterns

### Migration File Structure
```
supabase/migrations/
  00024_apple_auth_prep.sql   # Single migration: ALTER + trigger + RPC
```

### Pattern 1: ALTER TABLE with Backward Compatibility
**What:** Drop NOT NULL constraint on an existing column that has data in every row
**When to use:** Adding a new auth method that does not provide the same fields as the original
**Example:**
```sql
-- Source: Standard PostgreSQL ALTER TABLE
-- Safe: existing rows retain their values, only new rows can have NULL
ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;
-- UNIQUE constraint remains: allows multiple NULLs but not duplicate non-NULL values
```

### Pattern 2: NULLIF Guard in Trigger
**What:** Convert empty strings to NULL at the database level to prevent UNIQUE constraint violations
**When to use:** When an upstream system (Supabase Auth) may provide empty string instead of NULL
**Example:**
```sql
-- Source: PostgreSQL NULLIF documentation
-- Handles both empty string '' and actual NULL from auth.users.phone
INSERT INTO users (id, phone_number)
VALUES (new.id, NULLIF(new.phone, ''))
ON CONFLICT (id) DO NOTHING;
```

### Pattern 3: Conditional Logic in Trigger
**What:** Skip phone-dependent operations when phone is not available
**When to use:** When the trigger must handle both phone OTP users (have phone) and Apple users (no phone)
**Example:**
```sql
-- Only attempt phone-based invite linking if phone is present
IF NULLIF(new.phone, '') IS NOT NULL THEN
  UPDATE pending_members
  SET user_id = new.id
  WHERE user_id IS NULL
    AND ltrim(phone_number, '+') = ltrim(new.phone, '+');
END IF;
```

### Pattern 4: Security Definer RPC with Phone Normalization
**What:** RPC that links pending invites by phone, called from client after profile setup
**When to use:** When invite linking cannot happen at auth time (Apple users have no phone at auth time)
**Example:**
```sql
-- Follows the same pattern as existing RPCs (add_pending_member, accept_invite)
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
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  normalized_phone := ltrim(p_phone_number, '+');
  -- Link pending invites to this user (same pattern as handle_pending_member_claim)
  UPDATE pending_members
  SET user_id = current_user_id
  WHERE user_id IS NULL
    AND ltrim(phone_number, '+') = normalized_phone;
END;
$$;
```

### Anti-Patterns to Avoid
- **Storing empty string as phone_number:** Use NULL, never `''`. The UNIQUE constraint allows multiple NULLs but only one empty string. The second Apple Sign-In user would crash.
- **Adding a DEFAULT value to phone_number:** Do NOT set `DEFAULT ''` or `DEFAULT NULL` -- omit the default entirely. Existing INSERT statements handle this explicitly.
- **Splitting the ALTER and trigger into separate migrations:** They are interdependent. If the ALTER runs but the trigger is not updated, the trigger will insert `''` into phone_number (violating uniqueness for the second Apple user). Keep them atomic.
- **Using `CREATE TRIGGER` instead of `CREATE OR REPLACE FUNCTION`:** The trigger `on_auth_user_created_claim_pending` already exists (from migration 00007). Only the function body needs replacing. Do NOT drop and recreate the trigger itself.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multiple NULLs in UNIQUE column | Partial unique index | PostgreSQL standard UNIQUE | Standard UNIQUE already allows multiple NULLs by SQL spec |
| Phone format normalization | Custom regex | `ltrim(phone_number, '+')` | Already the established pattern in migrations 00014, 00018, 00019 |
| EAS Build capability sync | Manual entitlements | `expo-apple-authentication` config plugin | Plugin automatically manages iOS entitlements during EAS Build |
| Type generation after migration | Manual type editing | `npx supabase gen types typescript` | Automated, covers all tables, RPCs, and nullable changes |

**Key insight:** This phase is infrastructure prep -- every change follows established PostgreSQL and Supabase patterns already present in the codebase. The existing 23 migrations provide templates for every operation needed.

## Common Pitfalls

### Pitfall 1: Trigger Crashes on NULL Phone (CRITICAL)
**What goes wrong:** The current `handle_pending_member_claim` trigger (migration 00019) does `INSERT INTO users (id, phone_number) VALUES (new.id, new.phone)`. For Apple Sign-In users, `new.phone` is empty string `''` (Supabase stores `''` not NULL for social providers). With the NOT NULL constraint, this works but creates a uniqueness problem: the second Apple user gets `duplicate key value violates unique constraint "users_phone_number_key"`. The trigger's exception handler swallows this, so no `public.users` row is created. All RLS policies that join on `public.users` fail silently, and the user sees a blank app.
**Why it happens:** The trigger was written assuming all users have phone numbers (phone OTP was the only auth method).
**How to avoid:** (1) DROP NOT NULL on phone_number, (2) use NULLIF(new.phone, '') in the trigger to store NULL instead of empty string, (3) wrap phone-matching logic in a conditional.
**Warning signs:** After Apple Sign-In, user exists in `auth.users` but not in `public.users`. Profile setup fails. App shows no groups.

### Pitfall 2: Empty String vs NULL UNIQUE Constraint Violation
**What goes wrong:** If the migration makes phone_number nullable but the trigger still inserts `new.phone` (empty string `''`) instead of NULL, the UNIQUE constraint allows only ONE row with `phone_number = ''`. The second Apple user crashes.
**Why it happens:** Developers make the column nullable but forget to update the trigger to use NULLIF.
**How to avoid:** The ALTER TABLE and trigger rewrite MUST be in the same migration file. Test with two Apple Sign-In users (or simulate by inserting two users with NULL phone).
**Warning signs:** First Apple user works, second fails with "duplicate key value violates unique constraint."

### Pitfall 3: EAS Build Disables Sign in with Apple Capability
**What goes wrong:** If `expo-apple-authentication` is not in the `app.json` plugins array before the first EAS build after adding Apple Sign-In code, EAS Build's automatic capability sync will disable the "Sign in with Apple" capability in Apple Developer Portal. The app builds successfully but Apple Sign-In fails at runtime.
**Why it happens:** EAS Build syncs local entitlements with Apple's servers. Missing plugin = missing entitlement = capability disabled remotely.
**How to avoid:** Add the plugin to app.json in THIS phase (before any auth code is written). Set `ios.usesAppleSignIn: true` as well.
**Warning signs:** App builds fine, Apple Sign-In button renders, but pressing it throws an error or nothing happens. Check Apple Developer Portal for the capability status.

### Pitfall 4: Supabase Dashboard Apple Provider Misconfiguration
**What goes wrong:** For native-only `signInWithIdToken`, only the Apple provider toggle and the bundle ID in "Authorized Client IDs" are needed. Developers waste time trying to configure the OAuth fields (Service ID, Secret Key, redirect URL) which are not needed for native flow.
**Why it happens:** The Supabase dashboard shows all fields regardless of whether you are using native or OAuth flow. Documentation focuses on the full OAuth setup.
**How to avoid:** For native iOS only: (1) Enable the Apple provider toggle, (2) Add the App ID / bundle ID (`com.kkbsplit.app`) to the Authorized Client IDs field, (3) Leave Secret Key, Service ID, and redirect URL empty.
**Warning signs:** `signInWithIdToken` returns 400 or 422 error. Check that the provider is enabled and the bundle ID matches.

### Pitfall 5: Forgetting to Regenerate TypeScript Types
**What goes wrong:** After making `phone_number` nullable, the TypeScript types in `lib/database.types.ts` still show `phone_number: string` (non-nullable). Code that accesses `phone_number` compiles without null checks but fails at runtime.
**Why it happens:** Type generation is a manual step that is easy to forget after running a migration.
**How to avoid:** Run `npx supabase gen types typescript --local > lib/database.types.ts` immediately after applying the migration. Verify that `phone_number` shows as `string | null` in the Row type.
**Warning signs:** TypeScript compiles without errors but runtime behavior is wrong. Profile screen shows `undefined` or `null` where phone should be.

### Pitfall 6: link_phone_to_pending_invites RPC Missing Auth Check
**What goes wrong:** If the new RPC does not validate `auth.uid()`, any unauthenticated request could link pending invites to arbitrary users.
**Why it happens:** Copy-paste from trigger code which runs in a different security context.
**How to avoid:** Always include the `IF current_user_id IS NULL THEN RAISE EXCEPTION` guard. Use `SECURITY DEFINER` with `SET row_security = off` (same pattern as all other RPCs in this project).
**Warning signs:** Security audit finds unauthenticated RPC access.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Complete Migration File (00024_apple_auth_prep.sql)
```sql
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
```

### app.json Changes
```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true,
      "bundleIdentifier": "com.kkbsplit.app"
    },
    "plugins": [
      "expo-router",
      ["expo-splash-screen", { ... }],
      "expo-sqlite",
      "expo-font",
      "expo-apple-authentication"
    ]
  }
}
```

### TypeScript Type Regeneration
```bash
# After applying migration to local Supabase
npx supabase gen types typescript --local > lib/database.types.ts
```

Expected change in generated types:
```typescript
// Before (current)
Row: {
  phone_number: string;
  // ...
}
Insert: {
  phone_number: string;
  // ...
}

// After (post-migration)
Row: {
  phone_number: string | null;
  // ...
}
Insert: {
  phone_number?: string | null;
  // ...
}
```

### Supabase Dashboard Configuration Steps
```
1. Go to: Supabase Dashboard > Authentication > Providers > Apple
2. Toggle: Enable Apple provider = ON
3. Field: Authorized Client IDs = com.kkbsplit.app
4. Leave empty: Secret Key, Service ID, redirect URL (OAuth-only fields)
5. Save
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phone OTP only, phone_number NOT NULL | Multi-provider auth, phone_number nullable | This migration | Apple Sign-In users can exist without phone at auth time |
| Trigger always matches phone on signup | Conditional phone matching in trigger | This migration | Trigger no longer crashes for social provider users |
| Invite linking only at signup time | Deferred linking via RPC | This migration | Phone-based invites work for users who provide phone later |

**Deprecated/outdated:**
- The trigger behavior from migration 00019 (unconditional phone insert + unconditional phone matching) is replaced by this migration. The trigger still exists but the function body is replaced via `CREATE OR REPLACE`.

## Open Questions

1. **Exact value of `auth.users.phone` for Apple Sign-In users**
   - What we know: Supabase typically stores `''` (empty string) for social provider users, not NULL
   - What's unclear: Could be NULL in some Supabase versions
   - Recommendation: Use `NULLIF(new.phone, '')` which handles both `''` and NULL safely. Verify during Phase 14 testing.

2. **Supabase dashboard Apple provider "Authorized Client IDs" exact field behavior**
   - What we know: For native-only flow, the bundle ID (`com.kkbsplit.app`) goes in this field. No secret key needed.
   - What's unclear: Some documentation references "Services ID" for this field (OAuth flow). The dashboard UI may be confusing.
   - Recommendation: Enter `com.kkbsplit.app` in the Authorized Client IDs field. If auth fails in Phase 14, revisit this configuration. This is a manual dashboard step with no code risk.

3. **Whether `npx supabase gen types` correctly makes phone_number nullable**
   - What we know: The type generator reflects column constraints
   - What's unclear: Whether it correctly generates `string | null` vs `string`
   - Recommendation: Run type generation and manually verify the output. If incorrect, hand-edit the types file.

## Sources

### Primary (HIGH confidence)
- PostgreSQL ALTER TABLE documentation -- nullable column changes, UNIQUE constraint NULL behavior
- Supabase Apple Sign-In docs (https://supabase.com/docs/guides/auth/social-login/auth-apple) -- provider configuration, native flow requirements
- Expo Apple Authentication docs (https://docs.expo.dev/versions/latest/sdk/apple-authentication/) -- config plugin, app.json settings
- Codebase analysis: migrations 00001 (initial schema), 00007 (auto-link trigger), 00014 (phone normalization), 00019 (consent-aware trigger), 00020 (accept/decline RPCs)
- Existing project research: `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md`

### Secondary (MEDIUM confidence)
- Supabase Expo Social Auth Quickstart (https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth) -- signInWithIdToken pattern
- Supabase Native Mobile Auth Blog (https://supabase.com/blog/native-mobile-auth) -- native flow rationale
- Supabase GitHub raw docs (https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx) -- Authorized Client IDs = App ID (bundle ID) for native

### Tertiary (LOW confidence)
- None. All findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in project, standard PostgreSQL operations
- Architecture: HIGH -- follows established migration patterns (23 prior migrations), verified against existing trigger and RPC code
- Pitfalls: HIGH -- directly verified by reading existing migration code and cross-referencing with official Supabase/Expo docs
- Code examples: HIGH -- modeled on existing codebase patterns (migration 00019 trigger, migration 00020 RPCs)

**Research date:** 2026-02-22
**Valid until:** 60 days (database migration patterns are stable; Supabase dashboard UI may change)
