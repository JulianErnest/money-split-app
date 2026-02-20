---
phase: 09-settle-up
plan: 01
subsystem: database
tags: [postgres, rpc, settlements, balance, rls, plpgsql]

# Dependency graph
requires:
  - phase: 04-balances
    provides: get_group_balances and get_my_group_balances RPCs (base balance computation)
  - phase: 06-polish-distribution
    provides: pending_members support in get_group_balances (all_members CTE anchor)
provides:
  - settlements table with RLS and indexes
  - record_settlement RPC (validates auth, ownership, membership, positive amount)
  - delete_settlement RPC (creator-only guard)
  - Updated get_group_balances with settlement math
  - Updated get_my_group_balances with settlement math
  - TypeScript types for settlements table and RPCs
affects: [09-02 settle-up UI, future settlement history display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settlement CTEs in balance RPCs: settled_out/settled_in with +/- math"
    - "Separate settlements table (not expense-based) for clean separation of concerns"

key-files:
  created:
    - supabase/migrations/00021_settlements_table.sql
  modified:
    - lib/database.types.ts

key-decisions:
  - "No amount validation against current balance in record_settlement (race condition tolerance)"
  - "No time window restriction on delete_settlement (trust creator guard for small user base)"
  - "Settlement math: paid_by net goes UP (+settled_out), paid_to net goes DOWN (-settled_in)"

patterns-established:
  - "Settlement CTE pattern: settled_out (paid_by grouped) and settled_in (paid_to grouped) joined only for non-pending members"

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 9 Plan 1: Settle Up Backend Summary

**Settlements table with record/delete RPCs and balance RPC updates incorporating settled_out/settled_in CTEs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T15:13:45Z
- **Completed:** 2026-02-20T15:16:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created settlements table with 6 columns, RLS policy, 3 indexes, and check constraint
- record_settlement RPC with 4 validations (auth, ownership, membership, positive amount)
- delete_settlement RPC with creator-only guard (no time window)
- Updated get_group_balances to incorporate settlement amounts via settled_out/settled_in CTEs
- Updated get_my_group_balances with same settlement math for home screen balance
- Added TypeScript types for settlements table (Row/Insert/Update/Relationships) and both RPCs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create settlements migration with table, RPCs, and balance updates** - `0012fa8` (feat)
2. **Task 2: Update database types with settlement RPCs** - `9553e7f` (feat)

## Files Created/Modified
- `supabase/migrations/00021_settlements_table.sql` - Settlements table, record_settlement RPC, delete_settlement RPC, updated get_group_balances, updated get_my_group_balances
- `lib/database.types.ts` - Added settlements table type and record_settlement/delete_settlement function types

## Decisions Made
- No amount validation against current balance in record_settlement -- race condition tolerance per research recommendation. The whole-balance constraint is a UI concern, not a data integrity concern.
- No time window restriction on delete_settlement -- trust creator guard (`created_by = auth.uid()`) for small user base. Can be added later if abuse observed.
- Settlement math direction: `paid_by` (debtor) gets `+settled_out` (net increases as debt is paid off), `paid_to` (creditor) gets `-settled_in` (net decreases as credit is satisfied).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend is complete for settle-up feature: table, RPCs, and balance updates all in place
- Migration 00021 is local-only (not yet pushed to remote Supabase)
- Ready for 09-02 (settle-up UI) which will wire up the RPCs with confirmation bottom sheet and settlement history display
- Pre-existing TypeScript error in `app/(tabs)/index.tsx` (SectionList type mismatch from phase 08-02) is unrelated to this plan

## Self-Check: PASSED

---
*Phase: 09-settle-up*
*Completed: 2026-02-20*
