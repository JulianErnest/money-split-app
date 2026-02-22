# Feature Research: Apple Sign-In Authentication Flow

**Domain:** Mobile authentication (Apple Sign-In replacing Phone OTP) for expense-splitting app
**Researched:** 2026-02-22
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that are non-negotiable for a working Apple Sign-In implementation.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Native Apple Sign-In button | Apple HIG mandates using `AppleAuthenticationButton` -- custom buttons violate App Store guidelines and will cause rejection | LOW | Use `expo-apple-authentication` component with `buttonType` (SIGN_IN, CONTINUE, SIGN_UP) and `buttonStyle` (BLACK, WHITE, WHITE_OUTLINE). Cannot set `backgroundColor` or `borderRadius` via style prop -- use `buttonStyle` and `cornerRadius` props instead. |
| One-tap authentication flow | Users expect Apple Sign-In to be a single tap (Face ID/Touch ID) then done. No extra steps in the auth itself. | LOW | `AppleAuthentication.signInAsync()` presents native iOS modal. User authenticates with biometrics. Returns credential with `identityToken`. |
| Supabase session via `signInWithIdToken` | Must exchange Apple's `identityToken` for a Supabase session. This is the standard native flow -- do NOT use OAuth web redirect. | LOW | `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })`. No client secret or 6-month key rotation needed for native flow (that is OAuth-only). |
| New user detection (profile-gating) | After Apple Sign-In, app must detect whether user has completed profile setup (display_name + phone_number). Existing `isNewUser` pattern in auth-context already does this by checking `users` table for `display_name`. | LOW | Current `checkIsNewUser()` queries `users.display_name`. Extend to also check `phone_number` presence. If either missing, route to profile-setup. |
| Profile setup: display name (required) | Users need a display name for group interactions. Already exists in current profile-setup screen. | LOW | Already built. Keep existing display name input with 2-character minimum. |
| Profile setup: phone number (required, unverified) | Phone number is required for the invite/pending_member system. Must be collected before user can access the app. Users who previously used phone OTP had this automatically; Apple Sign-In users do not. | MEDIUM | Add phone number input to profile-setup screen. Use same +63 prefix pattern from current phone.tsx. Validate format (10 digits starting with 9) but do NOT verify via OTP. Store in `users.phone_number`. |
| Phone number format validation | PH phone numbers must be +63 followed by 10 digits starting with 9. Invalid numbers break the invite system. | LOW | Reuse existing validation logic from `phone.tsx`: strip non-digits, ensure 10 chars, prepend +63 for storage. Normalize to E.164 without leading `+` to match existing `ltrim(phone_number, '+')` patterns in SQL functions. |
| Phone number uniqueness enforcement | `users.phone_number` has a `UNIQUE NOT NULL` constraint in the database. Two Apple Sign-In users cannot register the same phone number. | MEDIUM | Must handle unique constraint violation gracefully in the UI. Show error like "This phone number is already associated with another account." Consider: what if the same person previously used phone OTP and now signs in with Apple? See migration concerns below. |
| Capture Apple-provided name on first sign-in | Apple provides `fullName` (givenName, familyName) ONLY on the very first authorization. All subsequent sign-ins return `null`. Must capture it immediately or it is lost forever. | MEDIUM | After `signInAsync`, if `credential.fullName?.givenName` exists, either (a) pre-fill the display name field on profile-setup, or (b) call `supabase.auth.updateUser({ data: { full_name, given_name, family_name } })` to store in user metadata. Recommend pre-filling profile-setup -- user can edit before saving. |
| Error handling: user cancellation | User can dismiss the Apple Sign-In modal. App must handle `ERR_REQUEST_CANCELED` gracefully without showing an error. | LOW | Catch the specific error code and silently return to login screen. Do not show error toast/alert for cancellations. |
| Error handling: Apple Sign-In unavailable | Device may not support Apple Sign-In (old iOS, restricted). Must check before showing button. | LOW | Call `AppleAuthentication.isAvailableAsync()` on mount. If false, show fallback message. In practice, all iOS 13+ devices support it, and this app targets iOS via Expo. |
| Remove phone OTP flow entirely | Old screens (phone.tsx, otp.tsx) must be removed. Auth layout must route to Apple Sign-In screen instead. | LOW | Delete `app/(auth)/phone.tsx` and `app/(auth)/otp.tsx`. Update `_layout.tsx` in auth group. Update root `_layout.tsx` redirect: `router.replace("/(auth)/apple-signin")` instead of `"/(auth)/phone"`. |
| Account deletion capability | Apple requires apps using Sign in with Apple to offer in-app account deletion. Must revoke Apple tokens and delete Supabase user. | MEDIUM | Add "Delete Account" option in profile screen. Call `supabase.auth.admin.deleteUser()` or use a Supabase Edge Function. Must also revoke Apple credentials via Apple's token revocation endpoint. Required for App Store compliance. |
| `isAvailableAsync` gate before rendering button | Must programmatically check Apple auth availability before rendering the button | LOW | `AppleAuthentication.isAvailableAsync()` returns Promise<boolean>. Gate the button render on this. |

### Differentiators (Competitive Advantage)

Features that improve UX beyond the minimum but are not strictly required.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pre-fill display name from Apple credential | Reduces friction by auto-populating the display name from Apple's `fullName` data, so users only need to add phone number | LOW | On first sign-in, `credential.fullName.givenName` is available. Pre-fill the display name input. User can edit. If `fullName` is null (returning user), leave field empty for manual entry. |
| Credential state monitoring | Detect when user revokes Apple Sign-In from iOS Settings and proactively sign them out | LOW | Use `AppleAuthentication.addRevokeListener()` to subscribe to revocation events. On revoke, call `supabase.auth.signOut()` and redirect to login. |
| Existing user migration path | Users who previously signed in with phone OTP now need to sign in with Apple. Their phone number already exists in `users` table. Supabase creates a new auth.users row for Apple Sign-In with a different ID -- need a strategy for this. | HIGH | This is the hardest problem. Options: (1) Let users create new Apple accounts and manually enter their old phone number -- the unique constraint will match them to pending invites. (2) Build a manual account linking flow. Recommend option (1) for simplicity -- if unique constraint fails, it means an account with that phone already exists, and user may need to contact support. See PITFALLS.md for detailed analysis. |
| `realUserStatus` anti-fraud signal | Apple provides a `realUserStatus` field (LIKELY_REAL, UNKNOWN, UNSUPPORTED) that indicates confidence the user is a real person, not a bot | LOW | Available only on native iOS. Log this value for analytics/fraud monitoring. Do not block users based on it -- UNKNOWN does not mean bot. Only available on first sign-in. |
| Smooth animated transition from sign-in to profile setup | Current phone.tsx has a nice background carousel. Replicate similar visual polish for the Apple Sign-In screen. | LOW | Keep the background carousel from current phone.tsx. Place the Apple Sign-In button prominently below the app name/tagline. One-screen auth: tap button, biometric, done. |
| Hide My Email awareness | Users can choose to hide their email via Apple's Private Relay. The email address will be an `@privaterelay.appleid.com` address. App should not depend on real email. | LOW | This app does not use email for anything (invites are phone-based). No action needed, but do not display the relay email to users or use it for communication. If email is displayed in profile, note it may be a relay address. |

### Anti-Features (Deliberately NOT Building)

Features that seem useful but create problems for this specific project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Phone number OTP verification during onboarding | Verifying the phone number prevents typos and ensures ownership | Adds massive friction to onboarding (defeats the purpose of replacing OTP). Requires SMS provider costs. Users already authenticated via Apple -- adding another auth step is hostile UX. | Accept unverified phone number. Format validation catches typos. If wrong number entered, user can update in profile. The invite system tolerates wrong numbers (invite just won't match). |
| Multiple auth providers (Apple + Google + Email) | Broader user coverage | Scope creep. Apple Sign-In is sufficient for iOS-only app distributed via TestFlight. Adding more providers means more edge cases, more testing, more maintenance. Solo developer constraint. | Apple Sign-In only. If Android support needed later, add Google Sign-In then. |
| OAuth web redirect flow for Apple | Some tutorials show this approach | Requires generating a client secret from Apple's .p8 key every 6 months. Secret rotation is an operational burden. Native `signInWithIdToken` does NOT require this -- it uses Apple's native Authentication Services directly. | Use native flow: `expo-apple-authentication` + `signInWithIdToken`. Zero key rotation needed. |
| Automatic account linking (phone OTP account to Apple account) | Seamless migration for existing users | Supabase does not natively support linking two different auth identities to the same user row when they use different providers. Building this requires custom server-side logic, is error-prone, and risks data integrity. | Treat Apple Sign-In users as new accounts. Existing pending_member invites still match by phone number (entered during profile setup). Old phone OTP accounts become orphaned -- acceptable for a 5-10 person test group. |
| Custom Apple Sign-In button | Match the app's design language with a custom-styled button | Violates Apple HIG and App Store Review Guidelines. Apps must use the official `AppleAuthenticationButton` component. Custom buttons will cause App Store rejection. | Use `AppleAuthenticationButton` with `buttonStyle: BLACK` (matches dark-first theme) and `cornerRadius` to match app's radius tokens. |
| Email-based features (notifications, password reset) | Email from Apple could enable notifications | Apple's Private Relay means email may be a disposable relay address. This app has no email infrastructure. Phone-based invites are the core interaction model. | Continue using phone numbers for invites. If notifications needed later, use push notifications (already in out-of-scope for v1). |
| Phone number change flow | Users might want to update their phone number | Changing phone number after initial setup has cascading effects on pending_members, invite matching, and phone uniqueness. Complex to build safely. | Defer to later. For v1.3 testing with 5-10 friends, phone numbers are stable. If truly needed, add as a profile edit feature in a future milestone. |

## Feature Dependencies

```
[Apple Sign-In Button]
    |
    v
[signInWithIdToken -> Supabase Session]
    |
    v
[New User Detection (check users table)]
    |
    +---(new user)---> [Profile Setup Screen]
    |                       |
    |                       +---> [Display Name Input] (pre-filled from Apple fullName if available)
    |                       |
    |                       +---> [Phone Number Input] (required, unverified, +63 format)
    |                       |
    |                       +---> [Avatar Picker] (existing feature, keep as-is)
    |                       |
    |                       v
    |                  [Upsert to users table]
    |                       |
    |                       v
    |                  [Auto-link trigger fires: links phone to pending_members]
    |                       |
    +---(returning user)--->+
                            |
                            v
                       [App (tabs)]

[Remove Phone OTP Screens] --conflicts--> [Apple Sign-In] (must be done atomically)

[Account Deletion] --requires--> [Apple Token Revocation] --requires--> [Supabase User Deletion]
```

### Dependency Notes

- **Apple Sign-In requires Supabase session:** The `signInWithIdToken` call must succeed to create a session. Requires Apple provider to be enabled in Supabase dashboard.
- **Profile setup requires new user detection:** The `isNewUser` check must now verify both `display_name` AND `phone_number` exist. Currently only checks `display_name`.
- **Auto-link trigger depends on phone number in users table:** When user saves phone number during profile setup, the existing `handle_pending_member_claim` trigger on `auth.users` will NOT fire (it fires on INSERT, not UPDATE). A separate mechanism is needed to link pending_members when phone number is added during profile setup. This is a critical dependency -- see PITFALLS.md.
- **Phone OTP removal conflicts with Apple Sign-In addition:** Must be done in the same deployment. Cannot have a state where neither auth method works.
- **Account deletion requires token revocation:** Apple mandates that when users delete their account, the app must also revoke the Apple credential. This requires calling Apple's revocation endpoint.

## MVP Definition

### Launch With (v1.3)

Minimum viable for the Apple Sign-In migration:

- [x] Apple Sign-In button screen (replacing phone.tsx)
- [x] `signInWithIdToken` integration with Supabase
- [x] Profile setup with display name + required phone number
- [x] Pre-fill display name from Apple credential (first sign-in only)
- [x] New user detection extended to check phone_number
- [x] Phone format validation (+63, 10 digits starting with 9)
- [x] Phone uniqueness error handling
- [x] Remove phone.tsx and otp.tsx screens
- [x] Update auth routing in root layout
- [x] Credential revocation listener
- [x] app.json: add `usesAppleSignIn: true` and `expo-apple-authentication` plugin

### Add After Validation (v1.3.x)

Features to add once core Apple Sign-In is working:

- [ ] Account deletion flow -- needed for App Store submission, not for TestFlight
- [ ] Phone number edit in profile screen -- if testers report typos
- [ ] Existing user migration documentation -- if testers had phone OTP accounts

### Future Consideration (v2+)

Features to defer until product-market fit is established:

- [ ] Google Sign-In for Android support
- [ ] Account linking (merge Apple + phone OTP identities)
- [ ] Phone number verification (OTP for phone field)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Apple Sign-In button + Supabase integration | HIGH | LOW | P1 |
| Profile setup with phone number field | HIGH | MEDIUM | P1 |
| Remove phone OTP screens | HIGH | LOW | P1 |
| Pre-fill display name from Apple credential | MEDIUM | LOW | P1 |
| New user detection (extended) | HIGH | LOW | P1 |
| Phone format validation | HIGH | LOW | P1 |
| Phone uniqueness error handling | HIGH | LOW | P1 |
| Auth routing updates | HIGH | LOW | P1 |
| Credential revocation listener | MEDIUM | LOW | P1 |
| app.json config updates | HIGH | LOW | P1 |
| Auto-link pending_members on phone save | HIGH | MEDIUM | P1 |
| Account deletion flow | MEDIUM | MEDIUM | P2 |
| Phone number edit in profile | LOW | LOW | P3 |
| `realUserStatus` logging | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch (v1.3)
- P2: Should have, add when possible (before App Store submission)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Splitwise | Settle Up | Our Approach (KKB) |
|---------|-----------|-----------|---------------------|
| Auth methods | Email, Google, Apple, Facebook | Google, Email | Apple Sign-In only (iOS-focused) |
| Phone collection | Not required for core features | Not used | Required for invite system (unverified) |
| Onboarding steps | Sign in -> immediate app access | Sign in -> immediate app access | Sign in -> profile setup (name + phone) -> app |
| Account deletion | Available in settings | Available in settings | Must add (P2 for App Store compliance) |
| Auth migration | N/A (always had multiple providers) | N/A | Phone OTP -> Apple Sign-In (one-time migration) |

**Note:** KKB's onboarding has one extra step (phone number collection) compared to competitors. This is a conscious tradeoff: the invite system requires phone numbers, but Apple Sign-In doesn't provide them. Keep the profile setup screen fast and focused to minimize friction.

## Critical Implementation Details

### Apple Credential Behavior

1. **First sign-in:** Apple provides `fullName` (givenName, familyName), `email`, `identityToken`, `authorizationCode`, `realUserStatus`
2. **Subsequent sign-ins:** Apple provides ONLY `identityToken`, `authorizationCode`, `user` (stable identifier). `fullName` and `email` are `null`.
3. **After revoke + re-authorize:** Apple treats it as first sign-in again and provides `fullName` and `email`.

**Implication:** Capture `fullName` immediately on first sign-in. If the app crashes or user force-quits before saving, the name is lost until they revoke and re-authorize in iOS Settings.

### Database Schema Impact

The `users` table currently has `phone_number text unique not null`. With Apple Sign-In:
- The auto-link trigger (`handle_pending_member_claim`) fires on `auth.users` INSERT, which happens during `signInWithIdToken`. At that point, `new.phone` is `null` (Apple doesn't provide phone). The trigger inserts a `users` row with empty phone_number, which will violate the `NOT NULL` constraint.
- **Schema change needed:** Either (a) make `phone_number` nullable (and enforce non-null at app level after profile setup), or (b) modify the trigger to skip the users row insert when phone is null, letting profile-setup handle it.
- **Recommendation:** Make `phone_number` nullable. The `isNewUser` check gates app access until phone is provided. This is the least disruptive change.

### Pending Member Auto-Linking

Current auto-link trigger fires on `auth.users INSERT`. With Apple Sign-In, phone number is not available at INSERT time -- it comes later during profile setup (UPDATE to `users` table). Need a new mechanism:
- Option A: Add an UPDATE trigger on `users` table that links pending_members when `phone_number` changes from null to a value.
- Option B: Call a server function from profile-setup after saving phone number that explicitly links pending_members.
- **Recommendation:** Option A (UPDATE trigger). More reliable, works automatically, follows existing pattern.

### Expo Configuration Required

```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true
    },
    "plugins": [
      "expo-apple-authentication"
    ]
  }
}
```

Must also enable "Sign in with Apple" capability in Apple Developer portal for the bundle ID `com.kkbsplit.app`.

### Supabase Dashboard Configuration

Enable Apple provider in Supabase Auth settings. For native iOS flow, only the "Apple" toggle needs to be enabled -- no client secret or service ID required (those are only for OAuth web flow).

## Sources

- [Expo AppleAuthentication Documentation](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) -- HIGH confidence (official docs)
- [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) -- HIGH confidence (official docs)
- [Supabase: Build a Social Auth App with Expo React Native](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth) -- HIGH confidence (official docs)
- [Supabase: Native Mobile Auth Support](https://supabase.com/blog/native-mobile-auth) -- HIGH confidence (official blog)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) -- HIGH confidence (official)
- [Apple: Offering Account Deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) -- HIGH confidence (official)
- [Apple: Handling Account Deletions and Revoking Tokens (TN3194)](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple) -- HIGH confidence (official)
- [Apple: Communicating Using the Private Email Relay Service](https://developer.apple.com/documentation/signinwithapple/communicating-using-the-private-email-relay-service) -- HIGH confidence (official)

---
*Feature research for: Apple Sign-In authentication flow (KKB v1.3)*
*Researched: 2026-02-22*
