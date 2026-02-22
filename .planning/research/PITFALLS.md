# Domain Pitfalls: Replacing Phone OTP with Apple Sign-In

**Domain:** Auth provider swap (Supabase phone OTP -> Apple Sign-In) in Expo managed workflow
**Researched:** 2026-02-22
**Overall confidence:** HIGH (verified against codebase + official Supabase/Expo/Apple docs)

---

## Critical Pitfalls

Mistakes that cause broken authentication, App Store rejection, or data corruption.

---

### Pitfall 1: `handle_pending_member_claim` Trigger Crashes on `new.phone` Being NULL

**What goes wrong:** The existing `on_auth_user_created_claim_pending` trigger (migration `00019`) fires `AFTER INSERT ON auth.users` and reads `new.phone` to match pending members. When a user signs up via Apple Sign-In, the `auth.users.phone` column is NULL because Apple provides an email (or private relay email), not a phone number. The trigger body does:

```sql
insert into users (id, phone_number)
values (new.id, new.phone)
on conflict (id) do nothing;
```

This will attempt to insert NULL into `public.users.phone_number`, which has a `NOT NULL` constraint (from `00001_initial_schema.sql`: `phone_number text unique not null`). The trigger's outer `EXCEPTION WHEN OTHERS` catch block will swallow the error silently, but the `public.users` row will NOT be created. Without a `public.users` row, all RLS policies that join on `public.users` will fail, and the user will see an empty app with no ability to create groups, view profiles, or do anything.

**Why it happens:** The trigger was written assuming all auth.users rows have a phone number (because phone OTP was the only auth method). Apple Sign-In populates `email` and `raw_user_meta_data` but leaves `phone` as NULL.

**Consequences:**
- User signs in with Apple, sees blank app
- No `public.users` row created -> all FK references fail
- `group_members` INSERT fails (FK to `public.users`)
- Silent failure (trigger catches exception, logs warning, but user sees no error)
- Pending member auto-linking silently fails

**Warning signs:**
- After Apple Sign-In, profile setup screen fails to save (upsert into `users` table fails)
- User appears in Supabase Auth dashboard but not in `public.users` table
- No error messages visible to the user

**Prevention:**
1. Alter `public.users.phone_number` to be NULLABLE before enabling Apple Sign-In: `ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;`
2. Rewrite `handle_pending_member_claim` to handle the case where `new.phone` is NULL -- skip the phone-based pending member matching if phone is not provided
3. Update the `users` table INSERT in the trigger to handle NULL phone: `INSERT INTO users (id, phone_number) VALUES (new.id, new.phone) ON CONFLICT (id) DO NOTHING;` only works if phone_number allows NULL
4. Add a separate code path in the trigger for Apple users (match by user metadata or skip matching entirely)

**Detection:** Query `SELECT id FROM auth.users WHERE id NOT IN (SELECT id FROM public.users)` after testing Apple Sign-In. If rows exist, the trigger is silently failing.

**Phase:** Must be addressed in the database migration phase, BEFORE enabling Apple Sign-In in the Supabase dashboard.

**Confidence:** HIGH -- directly verified by reading the trigger code in `00019` and the `NOT NULL` constraint in `00001`.

---

### Pitfall 2: `public.users.phone_number UNIQUE` Constraint Blocks Multiple Apple Users

**What goes wrong:** If you make `phone_number` NULLABLE (to fix Pitfall 1), multiple Apple Sign-In users who haven't entered their phone number yet would all have `phone_number = NULL`. PostgreSQL's UNIQUE constraint treats each NULL as distinct (NULLs are not equal to each other), so this actually works by default. However, if the migration accidentally uses a UNIQUE INDEX instead of a UNIQUE constraint, or if the migration adds a default value like empty string `''`, then the second Apple user will violate the unique constraint and the signup will fail.

**Why it happens:** Developers often "fix" NULL by defaulting to empty string `''`, which then violates UNIQUE when the second user signs up with no phone number.

**Consequences:**
- First Apple Sign-In user works fine
- Second Apple Sign-In user gets a database error on signup
- Error message is cryptic (unique constraint violation)

**Warning signs:**
- Works in solo testing, fails when a second tester uses Apple Sign-In
- Error in Supabase logs: `duplicate key value violates unique constraint "users_phone_number_key"`

**Prevention:**
1. Make `phone_number` NULLABLE (not empty string): `ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;` and do NOT set a default value
2. Verify the existing UNIQUE constraint (`users_phone_number_key`) handles NULLs correctly -- standard PostgreSQL UNIQUE allows multiple NULLs
3. If a partial unique index is needed later (unique only when non-null), create it explicitly: `CREATE UNIQUE INDEX users_phone_unique ON public.users(phone_number) WHERE phone_number IS NOT NULL;`

**Phase:** Database migration phase (same migration as Pitfall 1).

**Confidence:** HIGH -- verified by reading `00001_initial_schema.sql` constraint definition.

---

### Pitfall 3: Profile Setup Hardcodes `user.phone` for Users Table Insert

**What goes wrong:** The profile setup screen (`app/(auth)/profile-setup.tsx`, line 58) does:

```typescript
const { error: upsertError } = await supabase.from("users").upsert({
  id: user.id,
  phone_number: user.phone ?? "",
  display_name: trimmedName,
  avatar_url: selectedEmoji,
});
```

For Apple Sign-In users, `user.phone` is `undefined`, so `phone_number` becomes `""`. If the UNIQUE constraint is kept, the second Apple user's profile setup will fail. If NOT NULL is kept, the upsert silently succeeds but stores an empty string which is semantically wrong and breaks phone-based invite matching.

**Why it happens:** The profile setup was written for phone OTP where `user.phone` is always populated by Supabase Auth.

**Consequences:**
- Profile saves with empty string phone_number (or fails entirely)
- Phone-based invite matching breaks (phone_number `""` matches nothing)
- Profile screen shows empty phone number

**Warning signs:**
- Profile setup succeeds but phone number shows as blank on profile screen
- `add_pending_member` fails to match existing users by phone

**Prevention:**
1. Change profile setup to pass `phone_number: user.phone || null` (NULL, not empty string)
2. Add a separate "phone number collection" step in the post-auth flow for Apple users
3. Update the profile setup screen to conditionally show a phone number input field for Apple Sign-In users (since phone is not yet known)

**Phase:** Auth UI rewrite phase (when building the Apple Sign-In screen and updating profile setup).

**Confidence:** HIGH -- directly verified in `profile-setup.tsx` line 58.

---

### Pitfall 4: Apple Name Data Only Available on First Sign-In (Lost Forever If Not Captured)

**What goes wrong:** Apple provides the user's full name (`givenName`, `familyName`) only during the FIRST authorization. Every subsequent `signInWithIdToken` call returns NULL for name fields. If your code doesn't capture and store the name from Apple's credential response on first sign-in, it is permanently lost. The user must revoke app access via Apple ID settings and re-authorize to get the name again.

**Why it happens:** This is an Apple privacy design decision. Supabase Auth does NOT automatically extract the name from Apple's credential because it's only in the native response object, not in the ID token JWT claims.

**Consequences:**
- User signs up, name is not saved
- Display name defaults to "User" or empty
- No way to recover the name without the user revoking and re-authorizing
- During development/testing, developers often hit this: they sign in once without capturing the name, then can never test the name capture flow again with the same Apple ID

**Warning signs:**
- During testing, name capture works the first time but never again
- Production users report "my name isn't showing" after signing up
- `raw_user_meta_data` in auth.users shows empty name fields

**Prevention:**
1. In the `AppleAuthentication.signInAsync()` response handler, immediately extract `credential.fullName.givenName` and `credential.fullName.familyName` BEFORE calling `supabase.auth.signInWithIdToken()`
2. After Supabase auth succeeds, call `supabase.auth.updateUser({ data: { full_name: fullName } })` to persist in metadata
3. Pre-populate the display name field in profile setup with the captured Apple name
4. During development: to reset, go to Settings > Apple ID > Sign-In & Security > Sign in with Apple > [Your App] > Stop Using Apple ID. Then sign in again to get the name.

**Phase:** Apple Sign-In implementation phase (must be in the initial credential handler code).

**Confidence:** HIGH -- verified via [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) and [Expo Apple Authentication docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/).

---

### Pitfall 5: EAS Build Silently Disables Sign-in with Apple Capability

**What goes wrong:** EAS Build's automatic capability synchronization can disable the "Sign in with Apple" capability on the Apple Developer Console during a build. If the entitlement `com.apple.developer.applesignin` is not present in the local configuration, EAS Build assumes the capability is not needed and disables it remotely. This results in Apple Sign-In failing at runtime with a cryptic error -- the button appears but the authentication sheet never opens or returns an error.

**Why it happens:** EAS Build syncs local entitlements with Apple's servers. If the `expo-apple-authentication` config plugin is not in `app.json` (it is NOT currently in this project's `app.json`), the entitlement is missing locally, and EAS Build disables the remote capability.

**Consequences:**
- App builds successfully (no build error)
- Apple Sign-In button renders
- Pressing the button throws an error or nothing happens
- Only discovered when testing on a real device (simulator has its own issues)
- Debugging is difficult because the build succeeded

**Warning signs:**
- `AppleAuthentication.signInAsync()` throws `ERR_REQUEST_CANCELED` or similar
- Apple Sign-In works in development but not in EAS-built binaries
- Checking Apple Developer Portal shows "Sign in with Apple" capability is disabled

**Prevention:**
1. Add `"expo-apple-authentication"` to the `plugins` array in `app.json` BEFORE the first EAS build
2. Set `"ios": { "usesAppleSignIn": true }` in `app.json` for explicitness
3. After the first EAS build with the plugin, verify the capability is enabled in Apple Developer Portal
4. Test on a REAL DEVICE with an EAS-built binary (not Expo Go, not simulator)
5. Consider adding `EXPO_DEBUG=1` to the first build to see capability sync logs

**Phase:** Infrastructure/setup phase (before any Apple Sign-In code is written).

**Confidence:** HIGH -- verified via [Expo iOS capabilities docs](https://docs.expo.dev/build-reference/ios-capabilities/) and multiple reported issues ([#804](https://github.com/expo/eas-cli/issues/804), [#452](https://github.com/expo/eas-cli/issues/452), [#2599](https://github.com/expo/eas-cli/issues/2599)).

---

### Pitfall 6: Pending Member Invite Flow Fundamentally Changes (Phone Not Known at Auth Time)

**What goes wrong:** The entire `add_pending_member` RPC and invite system is designed around adding people by phone number. The flow is: User A enters User B's phone number -> pending_members row created with `phone_number` -> when User B signs up with that phone, auto-link trigger matches `new.phone` to `pending_members.phone_number`. With Apple Sign-In, User B's phone number is not in `auth.users.phone` -- it is collected LATER in the profile setup flow. This means the auto-link trigger fires at signup time but has no phone to match with. The phone number is only available after the user manually enters it in a phone collection step.

**Why it happens:** The current architecture couples authentication identity (phone number) with the invite matching key (also phone number). Apple Sign-In decouples these -- identity is Apple ID, but the invite key is still phone number.

**Consequences:**
- Users sign up via Apple but are never auto-linked to their pending invites
- Invites "disappear" -- they exist in `pending_members` but the `user_id` column is never set
- Users have to be manually added to groups after signing up
- The invite inbox (`get_my_pending_invites`) shows nothing because `user_id` is NULL

**Warning signs:**
- "I signed up but don't see my group invites"
- `pending_members` table has rows where `user_id IS NULL` for users who have signed up
- Group creator sees pending members that never convert to real members

**Prevention:**
1. Add a NEW trigger or RPC that runs AFTER the user enters their phone number (during profile setup or a dedicated phone collection step), not at auth time
2. Create a function like `claim_pending_by_phone(p_phone text)` that the client calls after the user enters their phone number
3. This function should do what the current trigger does: match `pending_members.phone_number` to the provided phone, set `user_id`, and create the invite linkage
4. Keep the existing trigger for backward compatibility but make it gracefully skip when `new.phone IS NULL`
5. Consider whether to run the claim immediately on phone entry (auto-link) or just set `user_id` (consent-aware)

**Phase:** Database migration + post-auth phone collection flow (must be designed before implementation).

**Confidence:** HIGH -- directly verified by reading trigger code in `00019` and the `add_pending_member` RPC in `00019`.

---

## Moderate Pitfalls

Mistakes that cause delays, confusing UX, or technical debt.

---

### Pitfall 7: Apple "Hide My Email" Private Relay Creates Unusable Email Addresses

**What goes wrong:** When users choose "Hide My Email" during Apple Sign-In, Apple generates a unique `@privaterelay.appleid.com` address. This email is stored in `auth.users.email`. If your app attempts to send emails to this relay address without configuring Apple's email relay service, the emails will bounce. Additionally, if you display this relay email anywhere in the UI, it looks confusing and unprofessional.

**Why it happens:** Apple's privacy-first design gives users the option to hide their real email. The relay email works for forwarding only if you configure your sending domain with Apple.

**Consequences:**
- Transactional emails (if any future feature sends them) bounce
- Profile screen shows `abc123@privaterelay.appleid.com` instead of a meaningful identifier
- Users are confused by the relay email

**Prevention:**
1. Never display Apple's email directly in the UI -- show display_name and phone number instead
2. If you need email communication later, register your sending domain with Apple's private relay service
3. Store the relay email in `auth.users` (Supabase does this automatically) but don't surface it in the app UI
4. Use phone number (collected post-auth) as the user-visible identifier

**Phase:** UI update phase (profile screen, any user-facing screens that might show email).

**Confidence:** MEDIUM -- verified via [Apple Hide My Email docs](https://support.apple.com/en-us/105078) and Supabase docs. This app currently does not send emails, so the impact is limited to UI display.

---

### Pitfall 8: Nonce Generation Missing or Incorrect Causes 400 Errors

**What goes wrong:** Apple Sign-In with `signInWithIdToken` requires a cryptographic nonce for security. The flow is: (1) generate a raw nonce, (2) pass it to `AppleAuthentication.signInAsync()`, (3) pass the same nonce to `supabase.auth.signInWithIdToken()`. If the nonce is missing, mismatched, or generated incorrectly, Supabase returns a 400 error with a vague message. Expo's `AppleAuthentication.signInAsync()` has a specific way to handle nonces that differs from web-based Apple JS SDK.

**Why it happens:** The nonce needs to be the RAW nonce (not hashed) when passed to Supabase, but Apple expects the SHA256 hash of the nonce in the ID token. Confusion about which value goes where causes mismatches.

**Consequences:**
- `signInWithIdToken` returns 400 error
- Authentication completely fails
- Difficult to debug because the error message doesn't mention nonce

**Prevention:**
1. Follow the exact pattern from [Supabase Expo social auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth):
   - Generate a random UUID as the raw nonce
   - Pass it directly to `signInWithIdToken({ provider: 'apple', token: identityToken, nonce: rawNonce })`
2. Use `crypto.randomUUID()` or a UUID library for nonce generation
3. Do NOT SHA256-hash the nonce before passing to Supabase (Supabase handles the hashing)
4. Test on a real device -- simulator Apple Auth returns different/test tokens

**Phase:** Apple Sign-In implementation phase.

**Confidence:** HIGH -- verified via [Supabase signInWithIdToken docs](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) and multiple GitHub issues ([#26747](https://github.com/supabase/supabase/issues/26747), [#1392](https://github.com/supabase/supabase-js/issues/1392)).

---

### Pitfall 9: Supabase Apple Provider Not Enabled in Dashboard

**What goes wrong:** Even with correct client-side code, `signInWithIdToken({ provider: 'apple' })` will fail with a 400 or 422 error if the Apple provider is not explicitly enabled in the Supabase dashboard. For the ID token (native) flow, you only need to enable the provider -- you do NOT need to provide a client_id or secret (those are only for the OAuth web flow). However, many developers either forget to enable it or incorrectly try to configure the OAuth fields.

**Why it happens:** Supabase disables all social providers by default. The dashboard UI can be confusing about which fields are required for native vs. web flows.

**Consequences:**
- `signInWithIdToken` returns error
- Misleading error messages (doesn't clearly say "provider not enabled")
- Time wasted configuring OAuth fields (client_id, secret) that aren't needed for native flow

**Prevention:**
1. Go to Supabase Dashboard > Authentication > Providers > Apple and toggle "Enable"
2. For native Expo flow using `signInWithIdToken`, you can leave Client ID and Secret EMPTY -- they are only needed for OAuth web redirect flow
3. Test the provider is enabled by making a test `signInWithIdToken` call
4. If you DO fill in Client ID, use the App ID (bundle identifier, e.g., `com.kkbsplit.app`), NOT the Services ID

**Phase:** Infrastructure/setup phase (before any code is written).

**Confidence:** HIGH -- verified via [Supabase Apple provider docs](https://supabase.com/docs/guides/auth/social-login/auth-apple).

---

### Pitfall 10: Sign-Out Message and Flow Assumes Phone OTP

**What goes wrong:** Multiple places in the codebase reference phone-based authentication in user-facing text and navigation:

- `app/(tabs)/profile.tsx` line 76: `"You'll need to verify your phone number again to sign back in."`
- `app/_layout.tsx` line 39: `router.replace("/(auth)/phone")` -- redirects unauthenticated users to the phone screen
- `app/join/[code].tsx` line 254: `router.replace("/(auth)/phone")` -- "sign in" CTA routes to phone screen

After switching to Apple Sign-In, these need to point to the Apple Sign-In screen, and the sign-out message needs updating.

**Why it happens:** These were written when phone OTP was the only auth method.

**Consequences:**
- User signs out, sees the old phone number entry screen instead of Apple Sign-In
- Confusing messaging ("verify your phone number" when they signed in with Apple)
- Join-by-link flow routes to wrong auth screen

**Prevention:**
1. Search all files for `/(auth)/phone` references and update navigation
2. Update the sign-out confirmation message to be auth-method-agnostic: "You'll need to sign in again."
3. Create a new auth entry screen (e.g., `/(auth)/apple-signin`) and update all routes
4. Consider whether to keep phone auth as a fallback or remove it entirely

**Phase:** Auth UI rewrite phase.

**Confidence:** HIGH -- directly verified by reading `profile.tsx`, `_layout.tsx`, and `join/[code].tsx`.

---

### Pitfall 11: Apple App Store Requires "Sign in with Apple" Button Guidelines Compliance

**What goes wrong:** Apple has strict Human Interface Guidelines for the Sign in with Apple button. Using a custom-styled button (wrong colors, wrong text, wrong size, custom icons) will cause App Store rejection. The `expo-apple-authentication` library provides an `AppleAuthenticationButton` component that follows guidelines, but developers often skip it in favor of matching their app's design system.

**Why it happens:** Developers want visual consistency with their app's existing button styles.

**Consequences:**
- App Store rejection during review
- Delay in release while redesigning the button

**Prevention:**
1. Use `AppleAuthentication.AppleAuthenticationButton` from `expo-apple-authentication` -- it renders Apple's official button
2. Only customize via allowed props: `buttonStyle` (white, black, whiteOutline) and `cornerRadius`
3. Do NOT set `backgroundColor` or `borderRadius` via React Native styles
4. Ensure the button is a minimum 44pt tall and full-width or at least 140pt wide
5. The button text is localized automatically -- do not override it

**Phase:** Auth UI implementation phase.

**Confidence:** HIGH -- verified via [Expo AppleAuthentication docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple).

---

### Pitfall 12: Testing Impossibility on iOS Simulator

**What goes wrong:** `AppleAuthentication.signInAsync()` always throws an error on the iOS Simulator. Developers who rely on simulator testing during development cannot test the Apple Sign-In flow at all. This pushes critical testing to real devices only, which slows development iteration.

**Why it happens:** Apple does not support Apple Sign-In on the simulator (the auth sheet never appears or immediately errors).

**Consequences:**
- Cannot iterate on the sign-in flow using simulator
- Bugs only discoverable on real devices
- Slower development cycle

**Prevention:**
1. Plan for real-device testing from day one -- ensure a development device is set up with an EAS development build
2. Build a "dev bypass" for local development: check `__DEV__` and provide a mock sign-in that calls `signInWithIdToken` with test credentials, or skip directly to the authenticated state
3. Use EAS Build with `"development"` profile and `"distribution": "internal"` (already configured in `eas.json`) to deploy to real devices quickly
4. Consider using Expo Go for all non-auth testing and a development build only for auth testing

**Phase:** Infrastructure/setup phase (development workflow).

**Confidence:** HIGH -- verified via [Expo AppleAuthentication docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/): "This method must be tested on a real device."

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable quickly.

---

### Pitfall 13: `user.phone` References in AuthContext and Database Types Need Updating

**What goes wrong:** The `AuthContext` and `database.types.ts` currently type `phone_number` as `string` (non-nullable in the TypeScript type). After making the column nullable, the TypeScript types will be out of sync with the database schema. This causes type errors when building, or worse, runtime errors when code assumes `phone_number` is always a string.

**Prevention:**
1. Regenerate database types after the migration: `npx supabase gen types typescript --local > lib/database.types.ts`
2. Update the `UserProfile` interface in `profile.tsx` to have `phone_number: string | null`
3. Add null checks wherever `phone_number` is accessed

**Phase:** Database migration phase (immediately after altering the column).

**Confidence:** HIGH -- verified by reading `database.types.ts` and `profile.tsx`.

---

### Pitfall 14: Apple Developer Account Team Setup for EAS Build

**What goes wrong:** EAS Build needs access to the Apple Developer account to manage provisioning profiles and capabilities. If the Apple Developer account is not properly linked (or the account is on the free tier which does not support capabilities like Sign in with Apple), the build will fail or the capability won't be enabled.

**Prevention:**
1. Ensure you have a PAID Apple Developer Program membership ($99/year) -- the free tier does NOT support Sign in with Apple capability
2. Run `eas credentials` to verify Apple account is linked
3. The account holder must have Admin or App Manager role for capability management
4. Apple Developer Team ID must match what's configured in EAS

**Phase:** Infrastructure/setup phase (prerequisites check).

**Confidence:** HIGH -- verified via [Expo Apple Developer Program docs](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/).

---

### Pitfall 15: Phone Number Collection UX After Apple Sign-In is Non-Obvious

**What goes wrong:** After Apple Sign-In, the user needs to provide their phone number for the invite matching system to work. But there's no clear UX pattern for "you signed in, now please also give us your phone number." If this step is skippable, many users will skip it, and invites will never match. If it's mandatory, users may feel frustrated ("I already signed in, why do you need my phone?").

**Prevention:**
1. Integrate phone collection into the existing profile setup flow (which already requires display_name)
2. Explain WHY the phone number is needed: "Your friends add you to groups by phone number. Enter yours so they can find you."
3. Make it required for the first version (can make optional later if invite-by-link becomes primary)
4. Use the same Philippine phone number format validation already in `isValidPHPhone()`
5. After the user enters their phone, immediately run the pending member claim to link any existing invites

**Phase:** Post-auth flow design phase.

**Confidence:** MEDIUM -- this is a UX design decision, not a technical constraint.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Infrastructure setup | EAS Build disables Sign-in with Apple (#5) | Add config plugin to `app.json` first, test with debug build |
| Infrastructure setup | Apple Developer account not properly configured (#14) | Verify paid membership, link account via `eas credentials` |
| Infrastructure setup | Supabase Apple provider not enabled (#9) | Enable in dashboard, leave OAuth fields empty for native flow |
| Database migration | `phone_number NOT NULL` constraint blocks Apple users (#1) | `ALTER COLUMN phone_number DROP NOT NULL` |
| Database migration | Empty string vs NULL breaks unique constraint (#2) | Use NULL, never empty string |
| Database migration | TypeScript types out of sync (#13) | Regenerate types after migration |
| Trigger rewrite | Auto-link trigger fails silently for Apple users (#6) | New claim function called after phone collection |
| Auth UI | Profile setup hardcodes `user.phone` (#3) | Pass NULL, add phone input field |
| Auth UI | Name capture fails on subsequent sign-ins (#4) | Capture from credential response on FIRST sign-in |
| Auth UI | Sign-out text references phone OTP (#10) | Search and update all phone-specific text |
| Auth UI | Apple button styling causes rejection (#11) | Use official `AppleAuthenticationButton` component |
| Auth UI | Nonce generation incorrect (#8) | Follow Supabase quickstart pattern exactly |
| Testing | Cannot test on simulator (#12) | Plan for real-device testing, consider dev bypass |
| Post-auth flow | Phone collection UX unclear (#15) | Add to profile setup, explain rationale to user |
| Post-auth flow | Relay email shown in UI (#7) | Never display email, show display_name + phone |

---

## Blast Radius Summary

Files and database objects that MUST change for the auth swap:

### Database (Supabase Migrations)
| Object | Change Required | Risk |
|--------|----------------|------|
| `public.users.phone_number` | `DROP NOT NULL` | Pitfall #1, #2 |
| `handle_pending_member_claim()` trigger | Rewrite for NULL phone | Pitfall #1, #6 |
| `add_pending_member()` RPC | Review phone matching logic | Pitfall #6 |
| New: `claim_pending_by_phone()` RPC | Create for post-auth claim | Pitfall #6 |

### Client Code (React Native / Expo)
| File | Change Required | Risk |
|------|----------------|------|
| `app.json` | Add `expo-apple-authentication` plugin, `usesAppleSignIn` | Pitfall #5 |
| `app/(auth)/phone.tsx` | Replace or remove | Pitfall #10 |
| `app/(auth)/otp.tsx` | Replace or remove | Pitfall #10 |
| `app/(auth)/profile-setup.tsx` | Handle NULL phone, add phone input | Pitfall #3, #15 |
| `app/_layout.tsx` | Update auth redirect routes | Pitfall #10 |
| `app/join/[code].tsx` | Update "sign in" CTA route | Pitfall #10 |
| `app/(tabs)/profile.tsx` | Handle NULL phone, update sign-out text | Pitfall #10 |
| `lib/auth-context.tsx` | Handle Apple session (no phone) | Pitfall #3 |
| `lib/supabase.ts` | No changes needed (client init is auth-agnostic) | -- |
| `lib/database.types.ts` | Regenerate after migration | Pitfall #13 |
| `lib/group-members.ts` | No changes needed (uses phone from pending_members, not auth) | -- |

### Infrastructure
| Item | Change Required | Risk |
|------|----------------|------|
| Supabase Dashboard | Enable Apple provider | Pitfall #9 |
| Apple Developer Console | Add Sign in with Apple capability | Pitfall #14 |
| EAS Build config | Ensure plugin syncs capability | Pitfall #5 |
| `package.json` | Add `expo-apple-authentication` dependency | -- |

---

## Sources

- [Supabase Apple Sign-In Documentation](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Supabase Expo Social Auth Quickstart](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth)
- [Expo AppleAuthentication SDK](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Expo iOS Capabilities](https://docs.expo.dev/build-reference/ios-capabilities/)
- [EAS CLI Sign-in with Apple Issue #804](https://github.com/expo/eas-cli/issues/804)
- [EAS CLI Sign-in with Apple Issue #2599](https://github.com/expo/eas-cli/issues/2599)
- [Supabase Auth Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Apple Token Revocation Issue #1308](https://github.com/supabase/auth/issues/1308)
- [Apple Hide My Email](https://support.apple.com/en-us/105078)
- [Apple Developer Program Roles (Expo)](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/)
- [Supabase signInWithIdToken Reference](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken)
- Project codebase: all migrations `00001` through `00023`, auth context, profile setup, and layout files
