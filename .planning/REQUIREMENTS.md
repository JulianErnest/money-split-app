# Requirements: KKB v1.3 Apple Sign-In

**Defined:** 2026-02-22
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1.3 Requirements

### Database & Infrastructure

- [ ] **DB-01**: `users.phone_number` column is nullable (allows Apple Sign-In users without phone at auth time)
- [ ] **DB-02**: Auth trigger handles NULL phone gracefully (NULLIF guard, skip pending_member linking when no phone)
- [ ] **DB-03**: New RPC `link_phone_to_pending_invites` links pending members when phone is saved during profile setup
- [ ] **DB-04**: Apple provider enabled in Supabase dashboard with bundle ID
- [ ] **DB-05**: `app.json` configured with `usesAppleSignIn: true` and `expo-apple-authentication` plugin

### Authentication

- [ ] **AUTH-01**: User can sign in with Apple via native iOS dialog (Face ID / Touch ID)
- [ ] **AUTH-02**: Apple identity token exchanged for Supabase session via `signInWithIdToken`
- [ ] **AUTH-03**: User cancellation of Apple dialog handled gracefully (no error shown)
- [ ] **AUTH-04**: Apple credential availability checked before rendering sign-in button
- [ ] **AUTH-05**: Phone OTP auth screens removed (phone.tsx, otp.tsx deleted)
- [ ] **AUTH-06**: All auth routing updated to point to Apple Sign-In screen (root layout, join flow, auth layout)

### Profile Setup

- [ ] **PROF-01**: Profile setup requires phone number input (PH format, +63 prefix, unverified)
- [ ] **PROF-02**: Phone number format validated (10 digits starting with 9)
- [ ] **PROF-03**: Phone uniqueness constraint violation handled with clear error message
- [ ] **PROF-04**: Apple-provided display name pre-filled on first sign-in (captured from credential.fullName)
- [ ] **PROF-05**: `isNewUser` check gates on both `display_name` AND `phone_number` presence
- [ ] **PROF-06**: After phone saved, pending member invites auto-linked via `link_phone_to_pending_invites` RPC

### Cleanup & Polish

- [ ] **CLEAN-01**: Profile screen sign-out message updated (no phone OTP reference)
- [ ] **CLEAN-02**: Apple relay email never displayed in UI (show display_name + phone only)

## Future Requirements

### Account Management (before App Store submission)

- **ACCT-01**: User can delete account from profile screen (Apple + Supabase deletion)
- **ACCT-02**: Apple token revocation on account deletion

### Auth Expansion

- **AUTHX-01**: Google Sign-In for Android support
- **AUTHX-02**: Account linking (merge Apple + phone OTP identities)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Phone OTP verification for collected number | Defeats purpose of replacing OTP; format validation sufficient |
| Multiple auth providers simultaneously | Scope creep for solo dev; Apple-only for iOS TestFlight |
| OAuth web redirect flow | Native `signInWithIdToken` is strictly better (no key rotation) |
| Custom Apple Sign-In button styling | Violates Apple HIG; must use official `AppleAuthenticationButton` |
| Phone number change flow | Complex cascading effects on invite system; defer to later |
| Automatic account linking | Supabase doesn't natively support cross-provider linking |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 13 | Pending |
| DB-02 | Phase 13 | Pending |
| DB-03 | Phase 13 | Pending |
| DB-04 | Phase 13 | Pending |
| DB-05 | Phase 13 | Pending |
| AUTH-01 | Phase 14 | Pending |
| AUTH-02 | Phase 14 | Pending |
| AUTH-03 | Phase 14 | Pending |
| AUTH-04 | Phase 14 | Pending |
| AUTH-05 | Phase 14 | Pending |
| AUTH-06 | Phase 14 | Pending |
| PROF-01 | Phase 15 | Pending |
| PROF-02 | Phase 15 | Pending |
| PROF-03 | Phase 15 | Pending |
| PROF-04 | Phase 15 | Pending |
| PROF-05 | Phase 15 | Pending |
| PROF-06 | Phase 15 | Pending |
| CLEAN-01 | Phase 15 | Pending |
| CLEAN-02 | Phase 15 | Pending |

**Coverage:**
- v1.3 requirements: 19 total
- Mapped to phases: 19/19
- Unmapped: 0

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation*
