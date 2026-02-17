---
phase: 03-groups
plan: 01
subsystem: groups
tags: [supabase, rpc, groups, flatlist, modal]
depends_on: [02-02]
provides: [group-rpc-functions, groups-list-screen, create-group-flow]
affects: [03-02, 03-03, 04-expenses]
tech-stack:
  added: []
  patterns: [supabase-rpc-atomic-operations, deterministic-emoji-avatars, modal-create-flow]
key-files:
  created:
    - supabase/migrations/00003_group_rpc_functions.sql
  modified:
    - lib/database.types.ts
    - app/(tabs)/index.tsx
decisions:
  - id: cross-platform-modal-for-group-creation
    description: "Use Modal with TextInput instead of Alert.prompt for cross-platform group name input"
  - id: type-cast-for-future-route
    description: "Cast /group/[id] route as any since route file created in Plan 03"
metrics:
  duration: 2min
  completed: 2026-02-17
---

# Phase 3 Plan 1: Group RPC Functions and Groups List Screen Summary

Database RPC functions for atomic group creation and invite-based joining, plus groups list home screen with create-group modal flow using deterministic emoji avatars.

## What Was Built

### Task 1: Supabase RPC Migration and TypeScript Types
- Created `supabase/migrations/00003_group_rpc_functions.sql` with two security definer functions:
  - `create_group(group_name text)`: atomically inserts into `groups` and `group_members` in one transaction, preventing orphan groups
  - `join_group_by_invite(invite text)`: looks up group by invite_code, inserts member with ON CONFLICT DO NOTHING for idempotency
- Updated `lib/database.types.ts` Functions section with typed definitions for `create_group`, `join_group_by_invite`, and `get_user_group_ids`

### Task 2: Groups List Screen and Create-Group Flow
- Replaced the design-system showcase in `app/(tabs)/index.tsx` with a real groups list screen
- Groups fetched via `group_members` join query with `groups` relation, ordered by `joined_at` descending
- FlatList with pull-to-refresh support
- Deterministic emoji avatars using `getGroupEmoji()` hash function with `EMOJI_LIST` from Avatar component
- Empty state: friendly "No groups yet" message
- Create group: Modal with TextInput (cross-platform), name validation (1-50 chars trimmed), loading state on Create button
- Group card press wired to `/group/[id]` route (created in Plan 03, cast as `any` for now)
- Auth context already exposes `user` -- no changes needed to `auth-context.tsx`

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create Supabase RPC migration and update TypeScript types | bed49f9 | supabase/migrations/00003_group_rpc_functions.sql, lib/database.types.ts |
| 2 | Build groups list screen and create-group flow | 4b7f1e3 | app/(tabs)/index.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript error on future route**
- **Found during:** Task 2
- **Issue:** `router.push('/group/${group.id}')` fails TypeScript because the `/group/[id]` route file doesn't exist yet (created in Plan 03)
- **Fix:** Added `as any` type assertion to the route string
- **Files modified:** app/(tabs)/index.tsx
- **Commit:** 4b7f1e3

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Cross-platform Modal for group creation | Alert.prompt is iOS-only; Modal with TextInput works on both platforms |
| Type cast for future route | Route /group/[id] created in Plan 03; `as any` allows wiring navigation now |
| No auth-context changes needed | `user` already exposed from auth context via `session?.user ?? null` |

## Verification Results

- TypeScript compiles with zero errors (`npx tsc --noEmit`)
- Migration file contains both `create_group` and `join_group_by_invite` functions
- Home screen renders groups list (not design showcase)
- Groups list fetches from Supabase with emoji avatars
- Create group flow validates input and calls RPC
- key_links verified: `rpc('create_group')` call and `group_members` + `groups` join query present

## Next Phase Readiness

Plan 03-02 (invite links and deep linking) can proceed -- `create_group` and `join_group_by_invite` RPC functions are in place. Plan 03-03 (group detail/members) can proceed -- groups list navigation to `/group/[id]` is wired.

## Self-Check: PASSED
