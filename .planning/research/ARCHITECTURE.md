# Architecture Patterns

**Domain:** Apple Sign-In integration into existing Supabase + Expo Router auth architecture
**Researched:** 2026-02-22

## Recommended Architecture

### High-Level Change Summary

Replace the two-screen phone OTP flow (`phone.tsx` -> `otp.tsx`) with a single-screen Apple Sign-In flow, then expand `profile-setup.tsx` to collect phone number. The auth context, root navigator logic, and Supabase client remain structurally identical -- the changes are surgical, not architectural.

```
CURRENT FLOW:
  phone.tsx ──> otp.tsx ──> [auth-context checks isNewUser] ──> profile-setup.tsx ──> (tabs)
  signInWithOtp()          verifyOtp()                          upsert users row

NEW FLOW:
  sign-in.tsx ──> [auth-context checks isNewUser] ──> profile-setup.tsx ──> (tabs)
  Apple signInAsync()                                  upsert users row
  + signInWithIdToken()                                (now with phone_number field)
```

### Component Map: What Changes

| Component | Status | Change Description |
|-----------|--------|--------------------|
| `app/(auth)/phone.tsx` | DELETE | Replaced by sign-in.tsx |
| `app/(auth)/otp.tsx` | DELETE | No longer needed |
| `app/(auth)/sign-in.tsx` | NEW | Apple Sign-In button + signInWithIdToken |
| `app/(auth)/profile-setup.tsx` | MODIFY | Add phone number input field (required) |
| `app/(auth)/_layout.tsx` | MODIFY | Update Stack.Screen entries (remove phone/otp, add sign-in) |
| `app/_layout.tsx` | MODIFY | Change unauthenticated redirect from `/(auth)/phone` to `/(auth)/sign-in` |
| `lib/auth-context.tsx` | MODIFY | Update `checkIsNewUser` to also check phone_number |
| `lib/supabase.ts` | NO CHANGE | Supabase client config is auth-method-agnostic |
| `lib/group-members.ts` | NO CHANGE | Phone utilities unchanged |
| `app/(tabs)/profile.tsx` | MINOR MODIFY | Update sign-out confirmation text |
| `app.json` | MODIFY | Add `ios.usesAppleSignIn: true` + expo-apple-authentication plugin |
| `components/groups/AddMemberModal.tsx` | NO CHANGE | Still uses phone numbers for invites |

### Database Changes

| Object | Status | Change Description |
|--------|--------|--------------------|
| `users` table | MIGRATE | `phone_number` column: remove NOT NULL, keep UNIQUE (allow NULL) |
| `users` table TypeScript types | MODIFY | `phone_number: string \| null` in Insert type |
| `handle_pending_member_claim` trigger | MODIFY | Must handle Apple users (no phone at signup time) |
| `add_pending_member` RPC | NO CHANGE | Still matches on phone_number in users table |
| `get_my_pending_invites` RPC | NO CHANGE | Matches on user_id, not phone |
| `accept_invite` / `decline_invite` RPCs | NO CHANGE | Operate on pending_member_id |
| RLS policies | NO CHANGE | All based on auth.uid(), not phone |
| Supabase Auth config | MODIFY | Enable Apple provider in dashboard |

## Detailed Architecture

### 1. Apple Sign-In Screen (`app/(auth)/sign-in.tsx`)

**New file.** Replaces `phone.tsx` and `otp.tsx` with a single screen.

**Data Flow:**

```
User taps Apple Sign-In button
  |
  v
AppleAuthentication.signInAsync({
  requestedScopes: [FULL_NAME, EMAIL]
})
  |
  v
credential.identityToken (JWT from Apple)
credential.fullName (only on FIRST sign-in ever)
  |
  v
supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken,
})
  |
  v
Supabase creates/finds auth.users row
  - id: new UUID
  - email: from Apple (may be relay address)
  - phone: EMPTY STRING (not null) -- Apple provides no phone
  - raw_user_meta_data: { email, email_verified, ... }
  |
  v
If credential.fullName exists (first sign-in):
  supabase.auth.updateUser({
    data: { full_name, given_name, family_name }
  })
  |
  v
auth.onAuthStateChange fires -> AuthProvider picks up session
  |
  v
auth-context.checkIsNewUser() runs -> finds no display_name AND no phone_number
  -> isNewUser = true -> redirects to profile-setup
```

**Key implementation details:**
- Use `expo-apple-authentication`'s `AppleAuthenticationButton` component for Apple's required button styling
- Check `AppleAuthentication.isAvailableAsync()` before rendering (always true on iOS 13+)
- Handle `ERR_REQUEST_CANCELED` error code (user dismissed the sheet -- not an error)
- No nonce is required for the Expo `signInAsync` + Supabase `signInWithIdToken` flow. The Expo library handles the Apple authentication natively without requiring a custom nonce. (Nonce is only needed for the Android/web OAuth browser flow.)
- Capture `credential.fullName` on first sign-in and save via `updateUser` -- Apple never provides it again

**Confidence:** HIGH -- based on official Supabase docs example for Expo + Apple Sign-In

### 2. Auth Context Changes (`lib/auth-context.tsx`)

**Current `checkIsNewUser` logic:**
```typescript
// Current: only checks display_name
if (error || !data || !data.display_name) {
  setIsNewUser(true);
}
```

**New `checkIsNewUser` logic:**
```typescript
// New: check BOTH display_name AND phone_number
const { data } = await supabase
  .from("users")
  .select("display_name, phone_number")
  .eq("id", userId)
  .single();

if (!data || !data.display_name || !data.phone_number) {
  setIsNewUser(true);
} else {
  setIsNewUser(false);
}
```

**Why:** With phone OTP, `phone_number` was always populated at auth time (the trigger inserted it). With Apple Sign-In, the user has no phone number until profile setup completes. We must gate on BOTH fields to ensure the user reaches profile setup.

**Edge case -- existing users:** Users who authenticated with phone OTP before the Apple Sign-In migration already have `display_name` AND `phone_number`. They will pass the `isNewUser` check and go straight to `(tabs)`. No forced re-onboarding.

### 3. Profile Setup Changes (`app/(auth)/profile-setup.tsx`)

**Current profile-setup collects:**
- Display name (required, min 2 chars)
- Avatar emoji (optional, random default)

**New profile-setup collects:**
- Display name (required, min 2 chars)
- Phone number (required, PH format +63 9XX XXX XXXX) -- UNVERIFIED
- Avatar emoji (optional, random default)

**Critical change in the upsert:**

```typescript
// Current upsert
await supabase.from("users").upsert({
  id: user.id,
  phone_number: user.phone ?? "",  // <-- comes from auth.users phone field
  display_name: trimmedName,
  avatar_url: selectedEmoji,
});

// New upsert
await supabase.from("users").upsert({
  id: user.id,
  phone_number: `+63${rawDigits}`,  // <-- comes from user input
  display_name: trimmedName,
  avatar_url: selectedEmoji,
});
```

**Phone number is unverified.** This is an explicit design decision from PROJECT.md. The phone number is collected for the invite/pending-member system, not for authentication. Users could enter a wrong number, but:
- The social pressure of a barkada app self-corrects (friends know each other's numbers)
- A wrong number means invites won't find you -- self-punishing mistake
- Verification would require re-introducing the OTP flow we're removing

**Phone uniqueness validation:** The `users.phone_number` column has a UNIQUE constraint. If the user enters a phone number already claimed by another user, the upsert will fail. The UI must handle this error gracefully: "This phone number is already registered to another account."

### 4. Database Schema Migration

**Migration: `ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL`**

This is the critical schema change. Currently:
```sql
phone_number text unique not null
```

Must become:
```sql
phone_number text unique  -- nullable
```

**Why:** When Apple Sign-In creates the auth.users row, the `handle_pending_member_claim` trigger fires and currently does:
```sql
insert into users (id, phone_number)
values (new.id, new.phone)
on conflict (id) do nothing;
```

For Apple Sign-In users, `new.phone` will be an empty string (Supabase stores '' not NULL for the phone field when the user signed in via social provider). This creates a problem:

1. The UNIQUE constraint on `phone_number` means only ONE user can have '' as their phone_number
2. The NOT NULL constraint means we can't store NULL

**Solution:** Make `phone_number` nullable, and update the trigger to store NULL instead of empty string:

```sql
-- Updated trigger
insert into users (id, phone_number)
values (new.id, NULLIF(new.phone, ''))
on conflict (id) do nothing;
```

NULL values are exempt from UNIQUE constraints in PostgreSQL, so multiple Apple Sign-In users can exist without phone numbers simultaneously.

**Confidence:** HIGH for the nullable migration approach. MEDIUM for `new.phone` being empty string vs NULL -- this is based on Supabase's typical behavior with social providers, but should be verified with a test sign-in. The NULLIF guard handles both cases safely.

### 5. Trigger Update (`handle_pending_member_claim`)

**Current trigger (from migration 00019):**
```sql
-- Ensure public.users row exists
insert into users (id, phone_number)
values (new.id, new.phone)
on conflict (id) do nothing;

-- Link identity to pending invites
update pending_members
set user_id = new.id
where user_id is null
  and ltrim(phone_number, '+') = ltrim(new.phone, '+');
```

**Updated trigger:**
```sql
-- Ensure public.users row exists (phone may be empty for Apple Sign-In)
insert into users (id, phone_number)
values (new.id, NULLIF(NULLIF(new.phone, ''), ' '))
on conflict (id) do nothing;

-- Link identity to pending invites (only if phone is present)
if new.phone is not null and new.phone != '' then
  update pending_members
  set user_id = new.id
  where user_id is null
    and ltrim(phone_number, '+') = ltrim(new.phone, '+');
end if;
```

**Why the conditional:** Apple Sign-In users have no phone at signup time. The pending_member linking by phone cannot happen. However, there's a second linking opportunity: when the user completes profile setup and provides their phone number, a NEW function should link any pending invites matching that phone.

### 6. New RPC: Link Phone After Profile Setup

**New function needed: `link_phone_to_pending_invites`**

After profile-setup saves the phone number to the `users` table, we need to retroactively link any `pending_members` rows that match this phone. This replicates what the auth trigger used to do for phone OTP users, but now happens at profile-setup time.

```sql
create or replace function public.link_phone_to_pending_invites(
  p_phone_number text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_phone text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  normalized_phone := ltrim(p_phone_number, '+');

  -- Link pending invites to this user
  update pending_members
  set user_id = current_user_id
  where user_id is null
    and ltrim(phone_number, '+') = normalized_phone;
end;
$$;
```

**Called from profile-setup** after the users upsert succeeds. This is the mechanism that replaces the auth trigger's phone-matching for Apple Sign-In users.

### 7. Root Navigator Changes (`app/_layout.tsx`)

**Minimal change:**
```typescript
// Current
router.replace("/(auth)/phone");

// New
router.replace("/(auth)/sign-in");
```

The rest of the navigator logic (session check, isNewUser routing, profile-setup redirect) works identically. This is the beauty of the existing architecture -- the auth method is decoupled from the navigation logic.

### 8. Auth Layout Changes (`app/(auth)/_layout.tsx`)

```typescript
// Current
<Stack.Screen name="phone" />
<Stack.Screen name="otp" />
<Stack.Screen name="profile-setup" />

// New
<Stack.Screen name="sign-in" />
<Stack.Screen name="profile-setup" />
```

### 9. App Config Changes (`app.json`)

```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true
    },
    "plugins": [
      "expo-apple-authentication",
      // ... existing plugins
    ]
  }
}
```

### 10. Supabase Dashboard Configuration

Enable Apple as an auth provider in the Supabase dashboard:

1. Go to Authentication > Providers > Apple
2. Enable the Apple provider
3. For the native `signInWithIdToken` flow on iOS, you need:
   - **Bundle ID** (from app.json: `com.kkbsplit.app`) -- this is the audience claim Supabase validates in the Apple ID token
   - No Service ID, Secret Key, or redirect URL needed for native-only flow
4. If you want to support Android/web later, you'd need the full OAuth config (Service ID, .p8 key, etc.)

**Confidence:** MEDIUM -- The dashboard configuration for native-only Apple Sign-In is simpler than the full OAuth flow, but the exact fields vary across Supabase dashboard versions. Verify in the actual dashboard.

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `sign-in.tsx` | Apple native auth + Supabase token exchange | `expo-apple-authentication`, `supabase.auth` |
| `auth-context.tsx` | Session state, isNewUser detection | `supabase.auth`, `supabase.from("users")` |
| `profile-setup.tsx` | Collect display name + phone + avatar, upsert user | `supabase.from("users")`, `supabase.rpc("link_phone_to_pending_invites")` |
| `_layout.tsx` (root) | Route based on session + isNewUser | `auth-context` |
| `handle_pending_member_claim` trigger | Create users row on auth signup | `auth.users`, `public.users`, `public.pending_members` |
| `link_phone_to_pending_invites` RPC | Link pending invites when phone collected | `public.pending_members` |

## Data Flow: Complete Auth + Invite Linking Journey

```
1. User taps "Sign in with Apple"
   -> Apple native auth sheet appears
   -> User authenticates with Face ID / password

2. Apple returns credential (identityToken, fullName, email)
   -> sign-in.tsx calls supabase.auth.signInWithIdToken({ provider: 'apple', token })
   -> Supabase validates token, creates auth.users row
      - auth.users.phone = '' (empty string)
      - auth.users.email = Apple email or relay

3. Trigger fires: handle_pending_member_claim
   -> Creates public.users row with id, phone_number = NULL
   -> Skips pending_members linking (no phone to match)

4. Auth state change fires -> AuthProvider detects session
   -> checkIsNewUser: no display_name, no phone_number -> isNewUser = true
   -> Root navigator redirects to profile-setup

5. User fills in display name + phone number + avatar
   -> profile-setup.tsx upserts: { id, display_name, phone_number: '+63...', avatar_url }
   -> Calls link_phone_to_pending_invites('+63...')
      -> Any pending_members with matching phone get user_id linked
   -> refreshProfile() -> isNewUser = false
   -> Root navigator redirects to (tabs)

6. User now in app, invite inbox shows linked pending invites
   -> get_my_pending_invites() returns invites linked in step 5
   -> User can accept/decline as normal
```

## Patterns to Follow

### Pattern 1: Platform-gated Apple Button

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

// Only render on iOS -- expo-apple-authentication is iOS-only
if (Platform.OS !== 'ios') return null;

// Check runtime availability
const isAvailable = await AppleAuthentication.isAvailableAsync();
if (!isAvailable) return null;
```

This app is iOS-focused (Filipino barkada app distributed via TestFlight), so the Platform gate is a safety net, not a feature flag.

### Pattern 2: First-Sign-In Name Capture

Apple provides fullName ONLY on the very first sign-in. If you miss it, it's gone forever (unless the user revokes your app in Settings and re-authorizes).

```typescript
const credential = await AppleAuthentication.signInAsync({ ... });

// IMMEDIATELY after signInWithIdToken succeeds:
if (credential.fullName?.givenName) {
  await supabase.auth.updateUser({
    data: {
      full_name: [
        credential.fullName.givenName,
        credential.fullName.familyName,
      ].filter(Boolean).join(' '),
    },
  });
}
```

This metadata is stored in `auth.users.raw_user_meta_data` and can optionally be used as a default for `display_name` in profile setup.

### Pattern 3: NULLIF for Phone Normalization

```sql
NULLIF(NULLIF(new.phone, ''), ' ')
```

PostgreSQL UNIQUE constraints allow multiple NULLs but not multiple empty strings. Always normalize empty/whitespace phone values to NULL in database operations.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Verifying Apple Email for Phone Matching

**What:** Trying to use the Apple email (which may be a relay like `abc123@privaterelay.appleid.com`) to match users.
**Why bad:** Apple relay emails are unique per app and opaque. They tell you nothing about the user's identity for matching purposes.
**Instead:** Use phone number for matching (collected during profile setup), which is the established pattern in this app.

### Anti-Pattern 2: Storing Empty String as Phone Number

**What:** Allowing `phone_number = ''` in the users table.
**Why bad:** The UNIQUE constraint means only one user can have `phone_number = ''`. The second Apple Sign-In user breaks.
**Instead:** Use NULL for missing phone numbers. PostgreSQL UNIQUE allows multiple NULLs.

### Anti-Pattern 3: Making Phone Number Optional Long-Term

**What:** Allowing users to skip the phone number in profile setup.
**Why bad:** The entire invite system (`add_pending_member`, `pending_members` table, invite inbox) depends on phone numbers to link users. A user without a phone number cannot receive phone-based invites.
**Instead:** Phone number is required in profile setup. The `isNewUser` check gates on both `display_name` AND `phone_number`.

### Anti-Pattern 4: Re-running Auth Trigger for Phone Linking

**What:** Trying to fire the `handle_pending_member_claim` trigger again after phone is collected.
**Why bad:** The trigger fires on `INSERT INTO auth.users`, not on update. You cannot re-trigger it.
**Instead:** Use a separate RPC (`link_phone_to_pending_invites`) called explicitly from profile-setup after phone is saved.

### Anti-Pattern 5: Using Supabase OAuth (Browser) Flow for Apple on iOS

**What:** Using `supabase.auth.signInWithOAuth({ provider: 'apple' })` which opens a browser.
**Why bad:** On iOS, Apple requires native Sign-In with Apple for apps that offer social login. The browser-based OAuth flow is for web apps. Apple may reject your app in review.
**Instead:** Use `expo-apple-authentication` (native) + `signInWithIdToken` (token exchange).

## Migration Strategy

### Order of Operations

This is critical. The schema migration must happen BEFORE the app code deploys, because:
- Existing users have phone numbers (safe with new nullable column)
- New Apple Sign-In users need nullable phone_number
- The trigger must handle the new flow

**Step 1: Database migration** (backward compatible)
```sql
-- 1. Allow NULL phone numbers
ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;

-- 2. Update trigger to handle empty phone
CREATE OR REPLACE FUNCTION public.handle_pending_member_claim() ...

-- 3. Create new linking RPC
CREATE OR REPLACE FUNCTION public.link_phone_to_pending_invites() ...

-- 4. Update TypeScript types
```

**Step 2: Supabase dashboard** (no downtime)
- Enable Apple provider with bundle ID

**Step 3: App code** (new binary required)
- Install expo-apple-authentication
- Add sign-in.tsx, remove phone.tsx + otp.tsx
- Update profile-setup.tsx, auth-context.tsx, layouts
- Update app.json
- Build new binary with EAS

**Step 4: Deploy new binary** (users update)
- Old binaries continue working until forced update (phone OTP still functional until Supabase phone provider disabled)
- New binary uses Apple Sign-In

**Step 5: Disable phone OTP** (cleanup, after all users migrated)
- Turn off phone provider in Supabase dashboard
- Existing sessions from phone OTP continue until JWT expiry

### Backward Compatibility

The migration is safe because:
- Making `phone_number` nullable is backward compatible (existing rows have values)
- The updated trigger uses NULLIF, which is a no-op when phone has a value (existing phone OTP users unaffected)
- The new `link_phone_to_pending_invites` RPC is additive (doesn't change existing RPCs)
- RLS policies use `auth.uid()`, not phone -- unaffected by auth method change

## Scalability Considerations

Not a primary concern for this app (targeting 5-10 testers), but worth noting:

| Concern | Current (Phone OTP) | After (Apple Sign-In) |
|---------|---------------------|----------------------|
| Auth cost | Supabase phone SMS costs per OTP | Zero -- Apple Sign-In is free |
| Phone number collection | Verified at auth time | Unverified at profile setup |
| Invite matching speed | Immediate at signup (trigger) | Delayed until profile setup (RPC) |
| Multiple device support | Phone OTP works on any device | Apple Sign-In requires iOS |

## Build Order (Suggested Phase Structure)

Based on dependency analysis:

1. **Database migration** -- must come first, zero downtime
   - ALTER phone_number nullable
   - Update trigger
   - Create link_phone RPC
   - Update TypeScript types

2. **Supabase dashboard config** -- enable Apple provider
   - Configure bundle ID

3. **Install + configure expo-apple-authentication** -- new binary dependency
   - `npx expo install expo-apple-authentication`
   - Update app.json

4. **New sign-in screen** -- core auth change
   - Create sign-in.tsx with Apple button
   - Wire up signInWithIdToken flow

5. **Update profile-setup** -- phone collection
   - Add phone input field
   - Call link_phone_to_pending_invites after save
   - Update checkIsNewUser in auth-context

6. **Update navigation** -- route changes
   - Root layout redirect
   - Auth layout Stack.Screen entries
   - Delete phone.tsx and otp.tsx

7. **Polish + test** -- edge cases
   - Profile screen sign-out text
   - Error handling (duplicate phone, cancelled auth)
   - Test with fresh Apple ID and existing phone user

## Sources

- [Supabase Apple Sign-In Docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) -- HIGH confidence, official documentation
- [Supabase Expo Social Auth Quickstart](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth) -- HIGH confidence, official example
- [Expo Apple Authentication API](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) -- HIGH confidence, official SDK docs
- [Supabase Native Mobile Auth Blog](https://supabase.com/blog/native-mobile-auth) -- HIGH confidence, official blog
- [Supabase User Management Guide](https://supabase.com/docs/guides/auth/managing-user-data) -- HIGH confidence, official docs
- [Supabase Users Docs](https://supabase.com/docs/guides/auth/users) -- HIGH confidence, official docs
- Codebase analysis of existing auth flow, migrations, and data model -- HIGH confidence, direct source
