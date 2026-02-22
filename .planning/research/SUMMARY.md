# Project Research Summary

**Project:** KKB (HatianApp) -- Apple Sign-In replacing Phone OTP
**Domain:** Mobile authentication (iOS expense-splitting app)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

KKB is migrating from Supabase phone OTP authentication to Apple Sign-In to streamline the iOS user experience. The existing architecture (Expo SDK 54, Supabase Auth, expo-router) is well-suited for this change -- the core auth infrastructure remains unchanged, requiring only surgical additions rather than architectural overhaul. The critical insight is that Supabase's `signInWithIdToken()` natively supports Apple's native flow, eliminating the need for OAuth browser redirects and 6-month secret key rotation that plague web-based Apple auth.

The main technical challenge is the phone number dependency. The current system uses phone numbers for both authentication AND invite matching. Apple Sign-In provides email (often a privacy relay) but NOT phone numbers. This requires extending the profile setup flow to collect phone numbers post-authentication, and creating a new mechanism to link pending invites when phone numbers are provided (the existing auto-link trigger fires at signup time, before phone is known). The database migration to make `phone_number` nullable is critical and must happen before any Apple Sign-In users authenticate.

The recommended approach is a 3-phase implementation: (1) database migrations and Supabase config (backward-compatible prep work), (2) core auth replacement (new sign-in screen, remove OTP screens, install expo-apple-authentication), and (3) profile setup enhancement (phone collection UI and invite linking). This ordering ensures existing phone OTP users continue working during deployment, and the migration is reversible until the final step. Key risks include the one-time-only nature of Apple's name data, the trigger's silent failure mode when phone is NULL, and EAS Build's capability sync pitfalls.

## Key Findings

### Recommended Stack

The existing stack requires minimal changes. The core dependencies (`expo ~54.0.33`, `@supabase/supabase-js ^2.96.0`, `expo-router ~6.0.23`) already support Apple Sign-In natively. Only two new packages are needed:

**New dependencies:**
- `expo-apple-authentication ~8.0.8` (required) -- provides native iOS Sign-In with Apple dialog via `ASAuthorizationController`, includes Apple HIG-compliant button component, handles credential management
- `expo-crypto ~15.0.8` (recommended) -- generates cryptographic nonces for replay attack prevention via SHA-256 hashing (optional but adds defense-in-depth)

**No changes needed:**
- `@supabase/supabase-js` already includes `signInWithIdToken()` since v2.21.0 (currently on v2.96.0)
- `expo-sqlite` session persistence works identically for any auth provider
- `expo-router` auth-gated routing is provider-agnostic

**Critical configuration:**
- `app.json` must add `ios.usesAppleSignIn: true` and `expo-apple-authentication` to plugins array (EAS Build uses this to enable the capability on Apple's servers)
- Supabase dashboard: enable Apple provider, add iOS bundle ID (`com.kkbsplit.app`) to Client IDs field -- NO client secret or Services ID needed for native flow (those are OAuth-only)

The native `signInWithIdToken` approach is strictly superior to OAuth for iOS: no browser popup, no 6-month key rotation, better UX with Face ID/Touch ID, and required by Apple for native apps anyway.

### Expected Features

**Must have (table stakes for v1.3):**
- Native Apple Sign-In button following Apple HIG (use `AppleAuthenticationButton` component with `buttonType` and `buttonStyle` props)
- One-tap authentication via `AppleAuthentication.signInAsync()` -> Supabase `signInWithIdToken()` flow
- Profile setup extension to collect required phone number (unverified, +63 format, 10 digits starting with 9)
- New user detection extended to check BOTH `display_name` AND `phone_number` (currently only checks display_name)
- Capture Apple-provided `fullName` on first sign-in (only available once, lost forever if not captured)
- Phone format validation (reuse existing logic from phone.tsx)
- Phone uniqueness error handling (UNIQUE constraint violation)
- Remove phone.tsx and otp.tsx screens entirely
- Update auth routing in root and auth layouts
- Credential revocation listener (`addRevokeListener`)

**Should have (before App Store submission):**
- Account deletion flow (Apple mandates in-app deletion for apps using Sign in with Apple) -- includes revoking Apple credentials and deleting Supabase user
- Profile screen phone edit capability (if testers report typos during unverified collection)

**Defer to future:**
- Google Sign-In for Android support (not needed for TestFlight iOS-only distribution)
- Automatic account linking (merge Apple + phone OTP identities -- complex, unnecessary for 5-10 person test group)
- Phone number OTP verification during profile setup (defeats the purpose of removing OTP flow)

**Anti-features (explicitly avoiding):**
- Multiple auth providers at launch (scope creep, solo developer constraint)
- OAuth web redirect flow for Apple (inferior UX, requires 6-month key rotation)
- Custom Apple Sign-In button styling (violates HIG, causes App Store rejection)
- Email-based features (Apple's Private Relay means email is unreliable)

### Architecture Approach

The auth method swap is surgical, not architectural. The existing auth context, Supabase client, and navigation logic remain structurally unchanged. The data flow shifts from a two-screen process (phone.tsx -> otp.tsx) to a single-screen native dialog (sign-in.tsx with Apple button), with phone collection moved from auth time to profile setup time.

**Component changes:**
- DELETE: `app/(auth)/phone.tsx` and `app/(auth)/otp.tsx`
- NEW: `app/(auth)/sign-in.tsx` (Apple button + `signInWithIdToken` integration)
- MODIFY: `app/(auth)/profile-setup.tsx` (add phone input field, call new RPC)
- MODIFY: `lib/auth-context.tsx` (extend `checkIsNewUser` to verify phone_number presence)
- MODIFY: navigation redirects (root layout, auth layout, join-by-link flow)

**Database changes (backward-compatible prep):**
- Alter `users.phone_number` from `NOT NULL` to nullable (allows Apple users to exist before phone collection)
- Rewrite `handle_pending_member_claim` trigger to handle NULL phone gracefully (use `NULLIF` to convert empty string to NULL)
- NEW RPC: `link_phone_to_pending_invites(p_phone_number text)` called after profile setup saves phone -- replicates the auto-link behavior that normally happens at signup time

**Data flow:**
```
User taps Apple button -> signInAsync() -> Apple native sheet -> credential (identityToken, fullName)
-> signInWithIdToken({ provider: 'apple', token }) -> Supabase creates auth.users
-> trigger fires: creates users row with phone_number = NULL (skips invite linking)
-> AuthProvider detects session, checkIsNewUser finds no phone -> routes to profile-setup
-> User enters display name + phone + avatar -> upsert users row -> call link_phone_to_pending_invites RPC
-> RPC links pending_members by phone -> isNewUser = false -> routes to (tabs)
```

**Critical pattern: first-sign-in name capture**
Apple provides `credential.fullName` (givenName, familyName) ONLY on the very first authorization. Subsequent sign-ins return NULL. Must capture immediately after `signInAsync` and store via `supabase.auth.updateUser({ data: { full_name, given_name, family_name } })` or the name is permanently lost.

### Critical Pitfalls

**Pitfall #1: Trigger crashes on NULL phone (CRITICAL, database migration phase)**
The `handle_pending_member_claim` trigger attempts to insert `new.phone` (NULL for Apple users) into `users.phone_number` which has a `NOT NULL` constraint. Trigger silently fails, no `public.users` row is created, user sees blank app. Prevention: ALTER TABLE to make `phone_number` nullable BEFORE enabling Apple Sign-In, rewrite trigger to use `NULLIF(new.phone, '')` and skip invite matching when phone is NULL.

**Pitfall #2: Profile setup hardcodes `user.phone` from auth (CRITICAL, UI implementation phase)**
The existing profile-setup.tsx does `phone_number: user.phone ?? ""` which stores empty string for Apple users. This violates UNIQUE constraint on second Apple user. Prevention: pass `user.phone || null` (NULL not empty string), add phone input field to profile setup, make it required.

**Pitfall #3: Name data lost forever if not captured on first sign-in (HIGH, auth implementation phase)**
Apple provides `fullName` only on first authorization. If not captured before the response object is discarded, it's gone forever (user must revoke app in iOS Settings and re-authorize to get it again). Prevention: immediately extract `credential.fullName` after `signInAsync`, call `updateUser` to persist in metadata, pre-fill profile setup field.

**Pitfall #4: Pending member invite flow breaks (HIGH, database migration phase)**
Current auto-link trigger fires at signup time when `auth.users` INSERT happens. Apple users have no phone at that point, so matching fails. Phone is collected later during profile setup (UPDATE to `users` table). Need a new mechanism to link invites when phone is provided. Prevention: create `link_phone_to_pending_invites` RPC, call it from profile-setup after phone save.

**Pitfall #5: EAS Build disables Sign-in with Apple capability (HIGH, infrastructure setup phase)**
If `expo-apple-authentication` plugin is not in `app.json` before the first EAS build, EAS Build's automatic capability sync disables the Sign-in with Apple capability in Apple Developer Portal. Auth fails at runtime with no obvious error. Prevention: add `expo-apple-authentication` to plugins array AND set `ios.usesAppleSignIn: true` BEFORE building with EAS.

**Pitfall #6: Phone OTP references throughout codebase (MEDIUM, navigation phase)**
Multiple files reference `/(auth)/phone` for routing (root layout, join-by-link, profile sign-out). Sign-out confirmation text says "verify your phone number again" which is wrong for Apple users. Prevention: search all files for `/(auth)/phone` and update routes to `/(auth)/sign-in`, update sign-out messaging to be auth-agnostic.

## Implications for Roadmap

Based on research, the Apple Sign-In migration should be structured as 3 sequential phases to minimize risk and ensure backward compatibility during deployment.

### Phase 1: Database & Infrastructure Prep (backward-compatible foundation)
**Rationale:** Schema changes must happen before any Apple users sign up, and Supabase config has no downtime. This phase is fully backward-compatible with existing phone OTP users.

**Delivers:**
- Nullable `phone_number` column in users table
- Updated `handle_pending_member_claim` trigger that handles NULL phone gracefully
- New `link_phone_to_pending_invites` RPC for post-auth phone linking
- TypeScript database types regenerated
- Supabase dashboard: Apple provider enabled with bundle ID
- Apple Developer Console: Sign-in with Apple capability enabled

**Addresses:**
- Pitfall #1 (trigger crash on NULL phone)
- Pitfall #2 (UNIQUE constraint on empty string)
- Pitfall #4 (invite flow breaks)

**Avoids:** Breaking existing phone OTP users (nullable column is backward-compatible, existing rows have values)

**Research flags:** This phase uses standard PostgreSQL migration patterns (ALTER COLUMN, CREATE FUNCTION). No additional research needed.

---

### Phase 2: Core Auth Replacement (new binary required)
**Rationale:** Once the database can handle Apple users, implement the actual sign-in flow. This phase requires a new binary build because of the native module dependency.

**Delivers:**
- Install `expo-apple-authentication` and `expo-crypto` packages
- Update `app.json` (add plugin, set `usesAppleSignIn: true`)
- New `app/(auth)/sign-in.tsx` with Apple Sign-In button and `signInWithIdToken` flow
- Remove `app/(auth)/phone.tsx` and `app/(auth)/otp.tsx` entirely
- Update navigation (root layout redirect, auth layout Stack.Screen entries)
- Capture Apple `fullName` on first sign-in and store in user metadata

**Uses:**
- `expo-apple-authentication` SDK (AppleAuthenticationButton component, signInAsync method)
- Supabase `signInWithIdToken({ provider: 'apple', token: identityToken })`

**Addresses:**
- Pitfall #3 (name data capture)
- Pitfall #5 (EAS Build capability sync)
- Pitfall #6 (phone OTP routing references)

**Avoids:** OAuth browser flow (inferior UX, 6-month key rotation burden)

**Research flags:** Standard Expo + Supabase integration pattern (well-documented in official quickstarts). No additional research needed. MUST test on real device (simulator does not support Apple Sign-In).

---

### Phase 3: Profile Setup Enhancement (phone collection & invite linking)
**Rationale:** With Apple auth working, extend profile setup to collect the phone number required for invite matching. This phase closes the gap created by Apple not providing phone numbers.

**Delivers:**
- Add phone number input field to `profile-setup.tsx` (required, PH format +63 9XX XXX XXXX)
- Reuse existing phone validation logic from phone.tsx (`isValidPHPhone`)
- Update users table upsert to pass collected phone (not `user.phone` from auth)
- Call `link_phone_to_pending_invites` RPC after phone save
- Update `checkIsNewUser` in auth-context to verify BOTH display_name AND phone_number
- Handle phone uniqueness constraint violation with clear error message
- Update profile screen to handle NULL phone (display empty state before collection)

**Implements:**
- Post-auth phone collection UI pattern
- Deferred invite linking (at profile setup time instead of signup time)

**Addresses:**
- Pitfall #2 (profile setup phone source)
- Pitfall #4 (invite linking mechanism)

**Avoids:** Phone OTP verification during onboarding (defeats purpose of removing OTP flow)

**Research flags:** This is app-specific UI/UX work. Phone format validation logic already exists in codebase. No additional research needed.

---

### Phase Ordering Rationale

**Why this order:**
- Phase 1 must come first to prevent trigger crashes when first Apple user signs up
- Phase 2 depends on Phase 1 (database ready to accept NULL phone)
- Phase 3 depends on Phase 2 (Apple Sign-In working to test phone collection flow)

**Dependency chain:**
```
Phase 1 (DB migration) -> Phase 2 (auth replacement) -> Phase 3 (profile enhancement)
```

**Why this grouping:**
- Phase 1 is pure backend (migrations, config) -- can be tested/deployed independently
- Phase 2 is pure auth flow (native module, UI, routing) -- distinct concern
- Phase 3 is profile UX (form fields, validation, RPC calls) -- can be iterated post-launch

**Avoiding pitfalls:**
- Sequential phases prevent race conditions (e.g., Apple user signing up before database is ready)
- Backward compatibility at each phase (existing phone OTP users continue working until Phase 2 deploys)
- Reversibility until final step (can disable Apple provider in Supabase dashboard without breaking existing users)

### Research Flags

**Phases with standard patterns (skip additional research):**
- Phase 1: Standard PostgreSQL migration patterns (ALTER COLUMN, CREATE FUNCTION, UPDATE trigger)
- Phase 2: Official Expo + Supabase integration pattern (well-documented in quickstarts, high confidence)
- Phase 3: App-specific UI work reusing existing phone validation logic

**No phases require `/gsd:research-phase` during planning.** All critical information has been gathered. The implementation is surgical (defined components, known dependencies, clear migration path).

**Development workflow note:** Phase 2 MUST be tested on a real iOS device. Apple Sign-In does not work on iOS Simulator (always throws error). Ensure EAS development build is configured and a test device is provisioned before starting Phase 2.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified package versions via npm registry and Expo SDK 54 branch. Supabase `signInWithIdToken` support confirmed in official docs. No version conflicts. |
| Features | HIGH | Table stakes and anti-features derived from Apple HIG (official), Supabase auth docs (official), and App Store review guidelines (official). MVP scope aligned with TestFlight distribution model. |
| Architecture | HIGH | Surgical changes verified by reading existing codebase (auth-context, profile-setup, trigger code). Data flow pattern confirmed in Supabase quickstart. Component boundaries well-defined. |
| Pitfalls | HIGH | Critical pitfalls (#1-5) verified by reading actual migration/trigger code in repo and cross-referenced with official docs. Blast radius analysis covers all affected files. |

**Overall confidence:** HIGH

### Gaps to Address

**Gap #1: Exact value of `auth.users.phone` for Apple Sign-In users**
Research indicates it's likely an empty string `''` (not NULL) based on typical Supabase social provider behavior, but this should be verified with a test Apple Sign-In. The migration uses `NULLIF(new.phone, '')` as a defensive guard to handle both cases safely. Validate during Phase 2 testing.

**Gap #2: Supabase dashboard UI for native-only Apple config**
The exact dashboard fields required for native `signInWithIdToken` flow (vs OAuth web flow) vary across Supabase dashboard versions. Research indicates only the "Enable" toggle and bundle ID are needed, but this should be verified when configuring. The Supabase docs are clear that client secret and Services ID are OAuth-only, but the dashboard UI may be confusing. Validate during Phase 1 setup.

**Gap #3: Existing user migration strategy**
For users who previously signed up with phone OTP and now want to use Apple Sign-In, Supabase will create a separate `auth.users` row with a different ID. There's no automated account linking. Research recommends letting users create new Apple accounts and manually enter their old phone number (pending invites will still match by phone). This is acceptable for a 5-10 person TestFlight test group. If production use reveals this is problematic, a manual account linking flow would need to be designed (out of scope for v1.3).

**Gap #4: Token expiry/refresh behavior for Apple Sign-In sessions**
Research does not deeply cover how Apple's `identityToken` expiry interacts with Supabase's refresh token mechanism. Supabase handles token refresh internally, and Apple's native flow should work transparently, but this should be validated during longer-term testing (e.g., user leaves app for several days, returns, session should auto-refresh). Not a blocker for launch -- standard Supabase behavior should apply.

**No gaps block implementation.** All gaps are validation items during testing, not missing design decisions.

## Sources

### Primary (HIGH confidence)
- [Expo AppleAuthentication SDK Docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) -- API reference, config plugin, platform support, button component
- [Expo Crypto SDK Docs](https://docs.expo.dev/versions/latest/sdk/crypto/) -- nonce generation APIs
- [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) -- native vs OAuth, dashboard config, signInWithIdToken examples
- [Supabase: signInWithIdToken Reference](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) -- method signature, parameters
- [Supabase: Native Mobile Auth Announcement](https://supabase.com/blog/native-mobile-auth) -- native ID token flow rationale
- [Supabase: Build a Social Auth App with Expo React Native](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth) -- end-to-end quickstart
- [Expo iOS Capabilities](https://docs.expo.dev/build-reference/ios-capabilities/) -- EAS Build entitlement handling
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) -- Sign in with Apple requirements
- [Apple: Offering Account Deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) -- mandatory deletion flow
- [Apple HIG: Sign in with Apple](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple) -- button styling requirements
- [Apple: Hide My Email](https://support.apple.com/en-us/105078) -- private relay behavior
- Codebase analysis: all migrations (00001-00023), auth-context.tsx, profile-setup.tsx, trigger definitions, database types

### Secondary (MEDIUM confidence)
- [Expo SDK 54 Branch: expo-apple-authentication](https://github.com/expo/expo/tree/sdk-54/packages/expo-apple-authentication) -- source code verification
- [expo-apple-authentication on npm](https://www.npmjs.com/package/expo-apple-authentication) -- version history
- [EAS CLI Issue #804: Sign-in with Apple capability sync](https://github.com/expo/eas-cli/issues/804) -- capability disable pitfall
- [EAS CLI Issue #2599: Sign-in with Apple capability sync](https://github.com/expo/eas-cli/issues/2599) -- capability disable pitfall
- [Supabase GitHub Issue #26747: signInWithIdToken nonce](https://github.com/supabase/supabase/issues/26747) -- nonce handling
- [Supabase Auth Issue #1308: Apple token revocation](https://github.com/supabase/auth/issues/1308) -- account deletion

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
