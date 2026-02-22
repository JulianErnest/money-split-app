---
phase: 14-core-auth-replacement
plan: 02
subsystem: auth
tags: [apple-sign-in, routing-cleanup, phone-otp-removal, expo-router, profile-setup, null-phone]

# Dependency graph
requires:
  - phase: 14-01
    provides: Apple Sign-In screen (app/(auth)/sign-in.tsx)
  - phase: 13-01
    provides: nullable phone_number database schema with NULLIF trigger
provides:
  - Clean auth flow with no phone OTP references
  - All routing pointing to Apple Sign-In screen
  - Null phone_number on profile upsert (prevents UNIQUE constraint violation)
  - Auth-aware sign-out messaging
affects: [15-profile-phone-collection, future-auth-changes]

# Tech tracking
tech-stack:
  added: []
  patterns: [null-over-empty-string for nullable unique columns]

key-files:
  created: []
  modified: [app/(auth)/_layout.tsx, app/_layout.tsx, app/join/[code].tsx, app/(auth)/profile-setup.tsx, app/(tabs)/profile.tsx]

key-decisions:
  - "phone_number sends null instead of empty string to prevent UNIQUE constraint violation for multiple Apple auth users"
  - "Sign-out message references Apple Sign-In specifically rather than generic auth language"

patterns-established:
  - "Nullable unique columns: always use null (not empty string) to avoid constraint violations"

# Metrics
duration: ~1min
completed: 2026-02-22
---

# Phase 14 Plan 02: Phone OTP Cleanup and Routing Update Summary

**Deleted phone/OTP screens, updated all 3 route references to Apple Sign-In, fixed phone_number empty-string UNIQUE constraint bug, and updated sign-out messaging**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-22T14:48:38Z
- **Completed:** 2026-02-22T14:50:01Z
- **Tasks:** 2
- **Files modified:** 7 (2 deleted, 1 created/updated, 4 modified)

## Accomplishments
- Deleted phone.tsx and otp.tsx, removing 554 lines of dead phone OTP auth code
- Updated auth layout to register sign-in screen instead of phone/otp screens
- Updated root layout routing from `/(auth)/phone` to `/(auth)/sign-in` for unauthenticated users
- Updated join flow routing from `/(auth)/phone` to `/(auth)/sign-in` for unauthenticated invite links
- Fixed critical phone_number empty-string bug: now sends null instead of "" preventing UNIQUE constraint violations when multiple Apple users complete profile setup
- Updated sign-out alert message to reference Apple Sign-In instead of phone verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete phone OTP screens and update auth layout** - `b918ade` (feat)
2. **Task 2: Update all routing references and fix profile bugs** - `26c72c8` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `app/(auth)/phone.tsx` - DELETED: phone number entry screen (291 lines)
- `app/(auth)/otp.tsx` - DELETED: OTP verification screen (263 lines)
- `app/(auth)/_layout.tsx` - Updated Stack.Screen entries: removed phone/otp, added sign-in
- `app/_layout.tsx` - Updated unauthenticated redirect from /(auth)/phone to /(auth)/sign-in
- `app/join/[code].tsx` - Updated unauthenticated join redirect from /(auth)/phone to /(auth)/sign-in
- `app/(auth)/profile-setup.tsx` - Fixed phone_number: user.phone ?? null (was "")
- `app/(tabs)/profile.tsx` - Updated sign-out message to reference Apple Sign-In

## Decisions Made

- **phone_number null vs empty string:** Changed `user.phone ?? ""` to `user.phone ?? null` because PostgreSQL allows multiple NULL values in a UNIQUE column but not multiple empty strings. This prevents the second Apple user from hitting a UNIQUE constraint violation during profile setup.
- **Sign-out message specificity:** Used "sign in with Apple" rather than generic "sign in again" to set clear expectations about the re-authentication method.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None -- all edits applied cleanly, TypeScript compilation showed only pre-existing errors (tuple index in _layout.tsx, documented in Known Issues).

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

**Phase 14 (Core Auth Replacement) is COMPLETE.**

**What was delivered:**
- Plan 14-01: Apple Sign-In screen with nonce-based auth flow
- Plan 14-02: Phone OTP cleanup, routing updates, profile bug fix

**Ready for Phase 15** (Profile Phone Collection Enhancement):
- Auth flow is fully switched to Apple Sign-In
- Phone number is nullable at both database and app levels
- Profile setup works correctly for Apple auth users (null phone)
- No dead phone OTP references remain

**Verification summary:**
- Zero references to `/(auth)/phone` in codebase
- Zero references to `/(auth)/otp` in codebase
- Zero references to `signInWithOtp` in codebase
- TypeScript compiles cleanly (only pre-existing errors)
- Auth directory contains exactly: _layout.tsx, sign-in.tsx, profile-setup.tsx

---
*Phase: 14-core-auth-replacement*
*Completed: 2026-02-22*

## Self-Check: PASSED
