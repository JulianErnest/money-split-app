---
phase: 05-balances
plan: 02
subsystem: database, ui
tags: [supabase-rpc, plpgsql, react-native, debt-simplification, balances]

# Dependency graph
requires:
  - phase: 05-01
    provides: simplifyDebts algorithm and netBalancesToCentavos converter
  - phase: 04-expenses
    provides: expense and expense_splits tables with data
  - phase: 04.1-pending-members
    provides: pending_members table and COALESCE pattern for splits
provides:
  - get_group_balances RPC function (per-member net balance within a group)
  - get_my_group_balances RPC function (per-group net balance for current user)
  - Balances section in group detail screen with simplified settlements
  - formatBalanceColor and formatBalanceSummary display helpers
affects: [05-03, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC-to-client-algorithm pipeline: server aggregates, client simplifies"
    - "COALESCE(user_id, pending_member_id) for unified member identity in SQL"

key-files:
  created:
    - supabase/migrations/00009_balance_rpcs.sql
  modified:
    - lib/database.types.ts
    - lib/balance-utils.ts
    - app/group/[id].tsx

key-decisions:
  - "Left join paid on owed (not full outer join) since pending members cannot be payers"
  - "Balance member flags tracked separately from member list for accurate pending detection"

patterns-established:
  - "Settlement card layout: debtor avatar | owes P{amount} | creditor avatar"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 5 Plan 2: Balance RPCs and Group Balances UI Summary

**Two Supabase RPCs for balance aggregation with simplified debt settlements displayed in group detail screen**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T09:37:47Z
- **Completed:** 2026-02-18T09:40:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created get_group_balances RPC that aggregates paid vs owed amounts per member including pending members
- Created get_my_group_balances RPC for cross-group balance summary (used in groups list)
- Added Balances section to group detail screen showing simplified settlement transactions
- Settlement cards show debtor/creditor with avatars, pending member # indicators, and formatted peso amounts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create balance RPC migration and regenerate types** - `876f496` (feat)
2. **Task 2: Add balances section to group detail screen** - `9230576` (feat)

## Files Created/Modified
- `supabase/migrations/00009_balance_rpcs.sql` - Two RPC functions for balance calculation
- `lib/database.types.ts` - Added type signatures for both balance RPCs
- `lib/balance-utils.ts` - Added formatBalanceColor and formatBalanceSummary helpers
- `app/group/[id].tsx` - Added Balances section with settlement cards above expenses

## Decisions Made
- Left join paid on owed (not full outer join) -- pending members cannot be payers, so they only appear in the owed CTE
- Balance member flags tracked in a separate Map from the member list -- the RPC returns is_pending per member_id which is more accurate than re-deriving from the member list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Balance RPCs and UI ready for Plan 03 (balance drill-down and settlement details)
- get_my_group_balances RPC available for groups list integration in Phase 6

## Self-Check: PASSED

---
*Phase: 05-balances*
*Completed: 2026-02-18*
