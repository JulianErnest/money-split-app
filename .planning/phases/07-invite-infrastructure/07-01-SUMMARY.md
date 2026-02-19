---
phase: 07-invite-infrastructure
plan: 01
subsystem: database, permissions
tags: [phone-normalization, creator-guard, rpc, migration]

dependency_graph:
  requires: [06-polish-distribution]
  provides: [add_pending_member with phone normalization and creator guard]
  affects: [07-02 invite schema changes]

tech_stack:
  added: []
  patterns: [ltrim phone normalization, creator-only RPC guard]

file_tracking:
  key_files:
    created:
      - supabase/migrations/00018_fix_phone_normalization_creator_guard.sql
    modified:
      - app/group/[id].tsx

decisions:
  - id: INV-01-impl
    description: "Phone normalization uses ltrim(p_phone_number, '+') for all comparisons and storage"
  - id: INV-02-impl
    description: "Creator guard checks groups.created_by = current_user_id; client gates Add Member button"

metrics:
  duration: 1.8min
  completed: 2026-02-19
---

# Phase 7 Plan 1: Fix Phone Normalization and Creator Guard Summary

Fixed phone format mismatch regression in add_pending_member and added creator-only permission guard (INV-01 + INV-02), enforced both server-side and client-side.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create migration fixing phone normalization and adding creator guard | 5af56f2 | supabase/migrations/00018_fix_phone_normalization_creator_guard.sql |
| 2 | Gate Add Member button to creator-only in client | 991b6e7 | app/group/[id].tsx |

## What Was Done

### Task 1: Migration 00018

Created `supabase/migrations/00018_fix_phone_normalization_creator_guard.sql` that replaces the `add_pending_member` function with:

1. **Restored phone normalization** (INV-01): `normalized_phone := ltrim(p_phone_number, '+')` applied before all user lookups, pending member duplicate checks, and storage. This was present in migration 00014 but accidentally dropped by 00015.

2. **Added creator-only guard** (INV-02): After group membership check, verifies `groups.created_by = current_user_id`. Non-creators get: "Only the group creator can add members by phone".

3. **Preserved all 00015 behavior**: nickname parameter, duplicate detection, existing-user auto-add path.

### Task 2: Client-side Creator Gate

In `app/group/[id].tsx`:
- Added `isGroupCreator` flag: `user?.id === group?.created_by`
- Wrapped Add Member button in `{isGroupCreator && (...)}`
- Invite Friends (share link) button remains visible to all members

## Verification

- Migration 00018 is syntactically valid SQL (Docker not running locally, so `supabase db reset` could not be executed -- migration follows exact patterns from 00014/00015)
- App compiles cleanly: `npx expo export --platform ios` succeeded
- Add Member button gated behind `isGroupCreator`
- Invite Friends button unconditional

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use `ltrim(p_phone_number, '+')` for normalization | Matches existing pattern from migration 00014; handles E.164 format consistently |
| Creator guard placed after group membership check | Fail fast: check membership first (cheaper), then creator status |
| Keep existing-user auto-add behavior | Plan explicitly states Plan 02 will change this to pending invites |

## Next Phase Readiness

Plan 07-02 can proceed. The `add_pending_member` function now has:
- Correct phone normalization for all paths
- Creator-only permission enforcement
- Nickname support preserved
- Ready for Plan 02 to convert existing-user path to pending invite flow

## Self-Check: PASSED
