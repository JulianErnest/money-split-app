---
phase: 15
plan: 01
subsystem: auth-profile
tags: [profile-setup, phone-input, apple-sign-in, invite-linking, validation]

dependency_graph:
  requires: [phase-13, phase-14]
  provides: [complete-profile-setup-with-phone, invite-linking-on-signup, apple-name-prefill]
  affects: []

tech_stack:
  added: []
  patterns: [phone-input-with-prefix, dual-field-onboarding-gate, two-step-save-upsert-rpc]

key_files:
  created: []
  modified:
    - lib/auth-context.tsx
    - app/(auth)/profile-setup.tsx
    - app/(tabs)/profile.tsx

decisions:
  - id: PROF-GATE
    decision: "Gate isNewUser on both display_name AND phone_number presence"
    rationale: "Users must provide phone to complete onboarding; phone is required for invite matching system"
  - id: PROF-PHONE-FORMAT
    decision: "Store phone as +63XXXXXXXXXX (E.164) in users table"
    rationale: "Consistent with pending_members format; link_phone_to_pending_invites RPC handles normalization via ltrim"
  - id: PROF-LINK-NONFATAL
    decision: "link_phone_to_pending_invites RPC failure is non-fatal (warn only)"
    rationale: "Profile save succeeded; invite linking can fail without blocking user onboarding"

metrics:
  duration: ~2min
  completed: 2026-02-22
---

# Phase 15 Plan 01: Profile Setup with Phone Input, Apple Name Pre-fill, and Invite Linking Summary

Phone input with +63 prefix and PH validation on profile setup, Apple name pre-fill from user_metadata, invite linking via RPC after save, dual-field isNewUser gate, and profile screen cleanup removing user.phone fallback.

## What Was Done

### Task 1: Add phone input to profile setup with Apple name pre-fill and invite linking
**Commit:** `9a0c8c9`
**Files modified:** `lib/auth-context.tsx`, `app/(auth)/profile-setup.tsx`

- Updated `checkIsNewUser` to select and check both `display_name` AND `phone_number` (PROF-05)
- Added phone input with `+63` prefix using the same pattern as AddMemberModal (PROF-01)
- Validates phone with `isValidPHPhone` from `lib/group-members.ts` -- 10 digits starting with 9 (PROF-02)
- Pre-fills display name from `user.user_metadata.full_name` captured during Apple Sign-In (PROF-04)
- Handles phone uniqueness constraint violation (PostgreSQL 23505) with user-friendly error message (PROF-03)
- Calls `link_phone_to_pending_invites` RPC after successful upsert to auto-link pending invites (PROF-06)
- Both display name (2+ chars) and valid phone number are required before save button enables

### Task 2: Clean up profile screen and verify no OTP vestiges remain
**Commit:** `cd59c7f`
**Files modified:** `app/(tabs)/profile.tsx`

- Removed `user?.phone` fallback from `phoneNumber` computation (CLEAN-02)
- Phone number now sourced exclusively from `profile.phone_number`
- Verified no OTP language, Apple relay email references, or `user.phone`/`user.email` remain in UI

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 | `9a0c8c9` | feat | Add phone input to profile setup with Apple name pre-fill and invite linking |
| 2 | `cd59c7f` | fix | Remove user.phone fallback from profile screen |

## Decisions Made

1. **Dual-field onboarding gate (PROF-GATE):** `isNewUser` now requires both `display_name` AND `phone_number` to be non-null. Users who authenticated via Apple but haven't provided a phone number are routed back to profile-setup.

2. **E.164 phone storage (PROF-PHONE-FORMAT):** Phone stored as `+639XXXXXXXXX` in the users table. The `link_phone_to_pending_invites` RPC handles format normalization with `ltrim` when matching against pending_members.

3. **Non-fatal invite linking (PROF-LINK-NONFATAL):** If the `link_phone_to_pending_invites` RPC fails, a console warning is logged but the profile save flow completes normally. The user can still be linked later.

## Deviations from Plan

None -- plan executed exactly as written.

## Requirements Fulfilled

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PROF-01 | Done | Phone input with +63 prefix in profile-setup.tsx |
| PROF-02 | Done | `isValidPHPhone` validation requiring 10 digits starting with 9 |
| PROF-03 | Done | PostgreSQL 23505 error code check with friendly message |
| PROF-04 | Done | `user?.user_metadata?.full_name` pre-fills display name |
| PROF-05 | Done | `checkIsNewUser` selects and checks both fields |
| PROF-06 | Done | `link_phone_to_pending_invites` RPC called after upsert |
| CLEAN-01 | Done | Verified in Phase 14; no OTP language in UI |
| CLEAN-02 | Done | Removed `user?.phone` fallback from profile.tsx |

## Verification Results

- TypeScript compilation: PASSED (only pre-existing _layout.tsx error)
- All grep checks for PROF-01 through PROF-06 and CLEAN-01/CLEAN-02: PASSED
- No OTP, relay email, or user.phone references found in app UI

## Next Phase Readiness

This is the final plan of the final phase (Phase 15). The v1.3 Apple Sign-In milestone is now code-complete.

**Remaining before shipping:**
- Test on real iOS device (Apple Sign-In does not work on Simulator)
- Verify invite linking end-to-end: create pending invite for a phone -> sign up with Apple -> enter that phone in profile setup -> verify invite appears

## Self-Check: PASSED
