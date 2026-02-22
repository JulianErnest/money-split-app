# Phase 15: Profile Setup & Invite Linking - Research

**Researched:** 2026-02-22
**Domain:** React Native profile form, Supabase user_metadata, phone validation, RPC-based invite linking
**Confidence:** HIGH

## Summary

Phase 15 modifies the existing `profile-setup.tsx` screen to add phone number collection, pre-fill the display name from Apple-provided metadata, and call the `link_phone_to_pending_invites` RPC after saving. It also updates the `isNewUser` check in `auth-context.tsx` to gate on both `display_name` AND `phone_number`, and ensures no Apple relay email or phone OTP language appears in the UI.

The codebase already has all infrastructure in place: the `link_phone_to_pending_invites` RPC exists (migration 00024), the `users.phone_number` column is nullable (migration 00024), phone validation utilities exist in `lib/group-members.ts` (`isValidPHPhone`, `formatPhoneDisplay`), and the `AddMemberModal` component demonstrates the exact phone input pattern (prefix +63, raw digits, validation). The sign-in screen already captures `credential.fullName` and stores it in `user_metadata` via `supabase.auth.updateUser`. The profile sign-out message was already updated in Phase 14 ("sign in with Apple again").

**Primary recommendation:** Modify `profile-setup.tsx` to add a phone input field (reusing the `+63` prefix pattern from `AddMemberModal`), pre-fill `displayName` from `user.user_metadata.full_name`, call `link_phone_to_pending_invites` RPC after upsert, update `isNewUser` to check `phone_number` presence, and audit the profile screen to ensure no email is displayed.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.96.0 | User upsert, RPC calls (`link_phone_to_pending_invites`) | Already installed; typed RPC calls via database.types.ts |
| expo-router | ~6.0.23 | Auth routing (`isNewUser` gates profile-setup redirect) | Already installed; routing logic in `app/_layout.tsx` |
| react-native | 0.76.x | TextInput for phone field, KeyboardAvoidingView | Already installed; standard RN form components |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-safe-area-context | ~4.x | SafeAreaView wrapper on profile-setup | Already used in profile-setup.tsx |

### No New Dependencies Required
This phase requires zero new package installations. All libraries, utilities, and RPCs are already in the codebase.

## Architecture Patterns

### Files to Modify
```
lib/auth-context.tsx              # UPDATE: isNewUser checks both display_name AND phone_number (PROF-05)
app/(auth)/profile-setup.tsx      # UPDATE: Add phone input, pre-fill name, call link RPC (PROF-01-06)
app/(tabs)/profile.tsx            # AUDIT: Ensure no email displayed (CLEAN-02)
```

### Pattern 1: Phone Input with +63 Prefix (Reuse AddMemberModal Pattern)
**What:** A phone number input field with a fixed `+63` text prefix, accepting raw 10-digit input starting with 9, using `isValidPHPhone` for validation.
**When to use:** PROF-01 and PROF-02 require this exact pattern.
**Source:** `components/groups/AddMemberModal.tsx` lines 22-57, 109-123
**Example:**
```typescript
// Reuse existing validation from lib/group-members.ts
import { isValidPHPhone } from "@/lib/group-members";

const [phoneDigits, setPhoneDigits] = useState("");

function handlePhoneChange(text: string) {
  // Strip non-digits, limit to 10
  const digits = text.replace(/\D/g, "").slice(0, 10);
  setPhoneDigits(digits);
}

// Format for display: "917 123 4567"
function formatDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

const phoneValid = isValidPHPhone(phoneDigits);

// In JSX:
<View style={styles.phoneRow}>
  <Text style={styles.prefix}>+63</Text>
  <TextInput
    value={formatDisplay(phoneDigits)}
    onChangeText={handlePhoneChange}
    keyboardType="number-pad"
    maxLength={12} // "9XX XXX XXXX" with spaces
    placeholder="9XX XXX XXXX"
  />
</View>
```

### Pattern 2: Pre-fill Display Name from Apple User Metadata (PROF-04)
**What:** Read the Apple-provided full name from `user.user_metadata.full_name` and use it as the initial value for the display name field.
**When to use:** On first mount of profile-setup screen, when user has just completed Apple Sign-In.
**Source:** Supabase docs - user_metadata property; sign-in.tsx lines 93-109 (where fullName is saved)
**Example:**
```typescript
// Source: Supabase auth docs + codebase sign-in.tsx
const { user, refreshProfile } = useAuth();

const [displayName, setDisplayName] = useState("");

useEffect(() => {
  // PROF-04: Pre-fill Apple-provided name from user_metadata
  // This was captured in sign-in.tsx via supabase.auth.updateUser({ data: { full_name } })
  const appleName = user?.user_metadata?.full_name;
  if (appleName && typeof appleName === "string") {
    setDisplayName(appleName);
  }
}, []);
```

**CRITICAL:** `user.user_metadata` is the property path. The sign-in screen stores the name under the key `full_name` (see `app/(auth)/sign-in.tsx` line 104). This is accessed as `user.user_metadata.full_name`.

**Edge case:** On subsequent sign-ins (not first), Apple does NOT provide the fullName. But `supabase.auth.updateUser` persists it in `user_metadata`, so it will still be available from the Supabase User object. The pre-fill will work on all sign-ins, not just the first.

### Pattern 3: Two-Step Save (Upsert + RPC) for Invite Linking (PROF-06)
**What:** After upsert to the users table, call `link_phone_to_pending_invites` RPC to link any pending invites that match the phone number.
**When to use:** Always, when profile-setup saves a phone number.
**Example:**
```typescript
// Source: migration 00024_apple_auth_prep.sql + lib/database.types.ts
async function handleSubmit() {
  const phoneE164 = `+63${phoneDigits}`; // E.164 format

  // Step 1: Upsert user profile
  const { error: upsertError } = await supabase.from("users").upsert({
    id: user.id,
    display_name: trimmedName,
    phone_number: phoneE164,
    avatar_url: selectedEmoji,
  });

  if (upsertError) {
    // PROF-03: Handle uniqueness constraint violation
    if (upsertError.message.includes("duplicate key") ||
        upsertError.message.includes("unique") ||
        upsertError.code === "23505") {
      setError("This phone number is already registered to another account.");
      return;
    }
    setError(upsertError.message);
    return;
  }

  // Step 2: Link pending invites for this phone (PROF-06)
  const { error: linkError } = await supabase.rpc("link_phone_to_pending_invites", {
    p_phone_number: phoneE164,
  });

  // linkError is non-fatal -- user profile is saved, invites may fail to link
  if (linkError) {
    console.warn("Failed to link pending invites:", linkError.message);
  }

  // Step 3: Refresh auth context to update isNewUser
  await refreshProfile();
}
```

### Pattern 4: Updated isNewUser Check (PROF-05)
**What:** Gate `isNewUser` on BOTH `display_name` AND `phone_number` presence, not just `display_name`.
**When to use:** In `lib/auth-context.tsx`, the `checkIsNewUser` function.
**Source:** Current code at `lib/auth-context.tsx` lines 55-74
**Example:**
```typescript
// Source: lib/auth-context.tsx (to be updated)
async function checkIsNewUser(userId: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("display_name, phone_number") // PROF-05: Select both fields
      .eq("id", userId)
      .single();

    // PROF-05: Both must be present to complete onboarding
    if (error || !data || !data.display_name || !data.phone_number) {
      setIsNewUser(true);
    } else {
      setIsNewUser(false);
    }
  } catch {
    setIsNewUser(true);
  } finally {
    setIsLoading(false);
  }
}
```

### Anti-Patterns to Avoid
- **Storing phone without E.164 prefix:** The database stores phone numbers with country code (e.g., `+639171234567`). The `link_phone_to_pending_invites` RPC normalizes by stripping `+` prefix with `ltrim`. Always prepend `+63` to the raw digits before saving.
- **Calling `link_phone_to_pending_invites` before upsert completes:** The RPC links invites to the authenticated user via `auth.uid()`. The phone number in the users table does not need to exist first (the RPC matches against `pending_members.phone_number`). However, the upsert must succeed first so the user row has the phone_number set.
- **Using `user.phone` for the phone field:** For Apple Sign-In users, `user.phone` is undefined. The phone number comes from user input in the profile-setup form, NOT from the Supabase auth user object.
- **Saving empty string for phone_number:** Phase 14 already fixed this to `null`, but ensure the profile-setup only saves the phone when it has been entered and validated. Never write `""` to phone_number.
- **Showing Apple relay email:** The Supabase user object for Apple users may contain an Apple relay email (e.g., `xyz@privaterelay.appleid.com`). This should NEVER be displayed in the UI. The profile screen should only show `display_name` and `phone_number`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone number validation | Custom regex | `isValidPHPhone()` from `lib/group-members.ts` | Already tested, used in AddMemberModal |
| Phone display formatting | Custom formatter | `formatPhoneDisplay()` from `lib/group-members.ts` | Consistent format across app |
| Invite linking after phone save | Custom SQL or trigger | `link_phone_to_pending_invites` RPC | Already created in migration 00024, handles auth check and phone normalization |
| Phone input UI pattern | New component | Copy pattern from `AddMemberModal` (+63 prefix row) | Proven pattern, consistent UX |
| Auth state refresh | Manual session check | `refreshProfile()` from AuthContext | Already wired into the routing system |

**Key insight:** Every piece of infrastructure needed for this phase already exists. The phone validation utility, the phone input UI pattern, the invite linking RPC, and the auth context refresh are all implemented and tested. This phase is primarily about wiring existing pieces together in `profile-setup.tsx`.

## Common Pitfalls

### Pitfall 1: Phone Number Format Mismatch with Pending Members
**What goes wrong:** The phone number stored in `users.phone_number` doesn't match the format used in `pending_members.phone_number`, causing `link_phone_to_pending_invites` to fail silently.
**Why it happens:** The codebase has a history of format mismatches (see migration 00014). `pending_members` stores phone numbers normalized as `639XXXXXXXXX` (without `+`), while the client might send `+639XXXXXXXXX`.
**How to avoid:** The `link_phone_to_pending_invites` RPC handles this by `ltrim(p_phone_number, '+')` and comparing with `ltrim(phone_number, '+')`. Send the E.164 format (`+63${digits}`) and the RPC handles normalization. Also store in the users table as `+63${digits}` for consistency with the profile screen display format.
**Warning signs:** Profile saves successfully but pending invites don't appear in the invite inbox afterward.

### Pitfall 2: isNewUser Causes Redirect Loop
**What goes wrong:** After updating `checkIsNewUser` to gate on `phone_number`, existing users who signed up via the old phone OTP flow (and DO have both fields) are fine, but the new check could cause issues if the query fails or times out.
**Why it happens:** The `checkIsNewUser` function's error handler defaults to `setIsNewUser(true)`, which redirects to profile-setup. If the Supabase query intermittently fails, existing users get stuck in a redirect loop.
**How to avoid:** This is the existing behavior and is correct for the happy path. The error fallback is intentional -- it's better to re-show profile setup than to let a user through without a profile. No change needed for the error handler.
**Warning signs:** User sees profile-setup screen after being fully set up, but only when offline or during network issues.

### Pitfall 3: Uniqueness Constraint Error Message is Cryptic
**What goes wrong:** When two users enter the same phone number, the Supabase upsert returns a PostgreSQL error like `duplicate key value violates unique constraint "users_phone_number_key"`. This message is shown directly to the user.
**Why it happens:** The profile-setup error handler shows `upsertError.message` which contains the raw PostgreSQL error.
**How to avoid:** Check for uniqueness violation specifically (PostgreSQL error code `23505` or message containing "duplicate key" or "unique") and show a user-friendly message like "This phone number is already registered to another account."
**Warning signs:** User sees "duplicate key value violates unique constraint..." when entering a phone number already used by another account.

### Pitfall 4: Apple Name Not Available in user_metadata
**What goes wrong:** The `displayName` field is not pre-filled with the Apple-provided name.
**Why it happens:** Apple provides `fullName` ONLY on the first authorization. If the user previously authorized the app (during development/testing) and the `updateUser` call was missed or failed, `user_metadata.full_name` will be undefined.
**How to avoid:** Treat pre-fill as best-effort. If `user_metadata.full_name` is missing, the user simply types their name manually. The field should not be required to match any Apple-provided value.
**Warning signs:** Name field is empty on profile-setup even though user authorized with Apple for the first time. Could indicate the `updateUser` call in `sign-in.tsx` failed silently.

### Pitfall 5: Profile Screen Displays Apple Relay Email
**What goes wrong:** The profile screen shows `user.email` which is an Apple relay email like `xyz@privaterelay.appleid.com`.
**Why it happens:** Developer accidentally adds email display to the profile screen.
**How to avoid:** The current profile screen (`app/(tabs)/profile.tsx`) does NOT display email -- it shows `display_name` and `phone_number` only. Verify this remains true and add no email display. Grep the profile screen for `email` references.
**Warning signs:** Profile screen shows a cryptic `@privaterelay.appleid.com` address.

### Pitfall 6: Phone Input Keyboard Behavior
**What goes wrong:** The phone number input on profile-setup doesn't use `number-pad` keyboard type, forcing users to switch keyboards manually. Or the keyboard obscures the save button.
**Why it happens:** Missing `keyboardType="number-pad"` prop, or `KeyboardAvoidingView` not properly configured.
**How to avoid:** Set `keyboardType="number-pad"` on the phone TextInput. The existing `KeyboardAvoidingView` in profile-setup.tsx (lines 87-91) already handles keyboard avoidance.
**Warning signs:** Full QWERTY keyboard appears instead of number pad when tapping the phone field.

## Code Examples

### Complete Updated Profile Setup Screen (Key Changes)
```typescript
// Source: Existing profile-setup.tsx + AddMemberModal patterns + migration 00024
import { isValidPHPhone } from "@/lib/group-members";

// State additions:
const [phoneDigits, setPhoneDigits] = useState("");

// Pre-fill Apple name (PROF-04):
useEffect(() => {
  const appleName = user?.user_metadata?.full_name;
  if (appleName && typeof appleName === "string") {
    setDisplayName(appleName);
  }
  // Random emoji (existing)
  const randomIndex = Math.floor(Math.random() * DISPLAY_EMOJIS.length);
  setSelectedEmoji(DISPLAY_EMOJIS[randomIndex]);
}, []);

// Validation (PROF-01, PROF-02):
const trimmedName = displayName.trim();
const nameValid = trimmedName.length >= 2;
const phoneValid = isValidPHPhone(phoneDigits);
const isValid = nameValid && phoneValid; // Both required (PROF-05)

// Phone formatting for display:
function formatPhoneInput(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

// Submit handler (PROF-03, PROF-06):
async function handleSubmit() {
  setSubmitted(true);
  if (!isValid || !user) return;

  setSaving(true);
  setError("");

  const phoneE164 = `+63${phoneDigits}`;

  try {
    // Step 1: Upsert user profile
    const { error: upsertError } = await supabase.from("users").upsert({
      id: user.id,
      display_name: trimmedName,
      phone_number: phoneE164,
      avatar_url: selectedEmoji,
    });

    if (upsertError) {
      // PROF-03: Handle phone uniqueness violation
      if (upsertError.code === "23505" ||
          upsertError.message.includes("duplicate key") ||
          upsertError.message.includes("unique")) {
        setError("This phone number is already registered to another account.");
      } else {
        setError(upsertError.message);
      }
      setSaving(false);
      return;
    }

    // Step 2: Link pending invites (PROF-06)
    await supabase.rpc("link_phone_to_pending_invites", {
      p_phone_number: phoneE164,
    });

    // Step 3: Refresh auth context
    setSaving(false);
    await refreshProfile();
  } catch {
    setError("Something went wrong. Please try again.");
    setSaving(false);
  }
}
```

### Phone Input JSX (Following AddMemberModal Pattern)
```typescript
// Source: components/groups/AddMemberModal.tsx lines 105-123
<View style={styles.inputSection}>
  <Text variant="label" color="textTertiary">
    Phone number
  </Text>
  <View style={styles.phoneRow}>
    <Text style={styles.prefix}>+63</Text>
    <TextInput
      style={styles.phoneInput}
      value={formatPhoneInput(phoneDigits)}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, "").slice(0, 10);
        setPhoneDigits(digits);
        if (submitted && isValidPHPhone(digits)) setError("");
      }}
      keyboardType="number-pad"
      maxLength={12}
      placeholder="9XX XXX XXXX"
      placeholderTextColor={colors.inputPlaceholder}
      selectionColor={colors.accent}
    />
  </View>
  {submitted && !phoneValid ? (
    <Text variant="caption" color="error">
      Enter a valid Philippine mobile number
    </Text>
  ) : null}
</View>
```

### Updated isNewUser Check
```typescript
// Source: lib/auth-context.tsx checkIsNewUser function
async function checkIsNewUser(userId: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("display_name, phone_number")
      .eq("id", userId)
      .single();

    // PROF-05: Both display_name AND phone_number must be present
    if (error || !data || !data.display_name || !data.phone_number) {
      setIsNewUser(true);
    } else {
      setIsNewUser(false);
    }
  } catch {
    setIsNewUser(true);
  } finally {
    setIsLoading(false);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phone number from auth (user.phone) | Phone number from user input in profile setup | Phase 13-15 (Apple Sign-In migration) | Phone collected post-auth, not during auth |
| isNewUser checks display_name only | isNewUser checks display_name AND phone_number | Phase 15 | Users must provide phone to complete onboarding |
| Auth trigger links invites at signup | Deferred linking via link_phone_to_pending_invites RPC | Phase 13 migration 00024 | Apple users get invite linking at profile setup time |
| Profile-setup has no phone field | Profile-setup collects phone with PH validation | Phase 15 | Required field for invite system compatibility |

**Existing and ready to use:**
- `isValidPHPhone()` in `lib/group-members.ts` -- exact validation needed for PROF-02
- `formatPhoneDisplay()` in `lib/group-members.ts` -- display formatting
- `link_phone_to_pending_invites` RPC in migration 00024 -- invite linking
- `AddMemberModal` in `components/groups/AddMemberModal.tsx` -- phone input UI pattern

## CLEAN-01 Status: Already Complete

The sign-out message in `app/(tabs)/profile.tsx` line 76 already reads:
```
"You'll need to sign in with Apple again to access your account."
```
This was updated in Phase 14 (14-02-PLAN.md Task 2). No further changes needed for CLEAN-01.

## CLEAN-02 Analysis: No Email Currently Displayed

The profile screen (`app/(tabs)/profile.tsx`) currently displays:
- `display_name` (line 108)
- `phone_number` (lines 110-114)
- `avatar_url` (line 109)
- `created_at` (line 115)

No email field is displayed. The `user.email` property (which would contain the Apple relay email) is not referenced anywhere in the app UI. The `phoneNumber` fallback on line 112-113 does reference `user?.phone` but this would be undefined for Apple users. This line should be cleaned up to only use `profile?.phone_number` since that is the canonical source after profile setup.

**Specific change needed for CLEAN-02:** Remove the `user?.phone` fallback in profile.tsx line 112-113. After Phase 15, the phone number will always come from `profile.phone_number` (collected during profile setup). The `user.phone` fallback is a vestige of the phone OTP flow.

## Open Questions

1. **Phone number stored format consistency**
   - What we know: `pending_members` stores as `639XXXXXXXXX` (no `+`), the profile-setup currently would store as `+639XXXXXXXXX`. The `link_phone_to_pending_invites` RPC handles this with `ltrim`.
   - What's unclear: Whether to store as `+63...` or `63...` in the users table for consistency.
   - Recommendation: Store as `+639XXXXXXXXX` in the users table (E.164 format). This matches what the profile screen expects for display formatting. The RPC handles normalization for matching.

2. **Whether CLEAN-01 should be marked complete or re-verified**
   - What we know: Phase 14 already updated the sign-out message. Grep confirms no OTP references remain.
   - What's unclear: Whether the planner should include a verification task or mark as pre-completed.
   - Recommendation: Include a quick verification grep in the plan but do not re-implement. CLEAN-01 is already done.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `app/(auth)/profile-setup.tsx` -- current profile setup implementation, 245 lines
- Codebase analysis: `lib/auth-context.tsx` -- current isNewUser check, lines 55-74
- Codebase analysis: `components/groups/AddMemberModal.tsx` -- phone input pattern to reuse
- Codebase analysis: `lib/group-members.ts` -- `isValidPHPhone`, `formatPhoneDisplay` utilities
- Codebase analysis: `supabase/migrations/00024_apple_auth_prep.sql` -- `link_phone_to_pending_invites` RPC definition
- Codebase analysis: `lib/database.types.ts` -- TypeScript types for users table and RPCs
- Codebase analysis: `app/(auth)/sign-in.tsx` lines 93-109 -- where Apple fullName is stored in user_metadata
- Codebase analysis: `app/(tabs)/profile.tsx` -- current profile display (no email shown)
- Supabase docs (https://supabase.com/docs/guides/auth/managing-user-data) -- user_metadata access pattern

### Secondary (MEDIUM confidence)
- Phase 14 RESEARCH.md -- Apple Sign-In patterns, fullName capture behavior
- Phase 13 migration 00024 -- link_phone_to_pending_invites RPC design decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, zero new dependencies
- Architecture: HIGH -- all files identified, patterns verified against existing codebase, utilities already exist
- Pitfalls: HIGH -- phone format issues documented in migration history (00014), uniqueness constraint verified in schema (00001), Apple name behavior verified against sign-in.tsx implementation
- Code examples: HIGH -- based on existing codebase patterns (AddMemberModal, auth-context, migration 00024), cross-referenced with Supabase docs

**Research date:** 2026-02-22
**Valid until:** 30 days (stable patterns, no external library changes expected)
