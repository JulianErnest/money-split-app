---
phase: 05-balances
plan: 03
subsystem: ui, navigation
tags: [react-native, balance-summary, drill-down, supabase-rpc, expo-router]

# Dependency graph
requires:
  - phase: 05-02
    provides: get_my_group_balances and get_group_balances RPCs, balance-utils helpers
  - phase: 04-expenses
    provides: expense and expense_splits tables with data
  - phase: 04.1-pending-members
    provides: pending_member_id support in expense_splits
provides:
  - Per-group net balance summary on group cards in groups list
  - Balance drill-down screen showing contributing expenses per settlement
  - Navigation from group detail settlement cards to drill-down
affects: [06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFocusEffect for balance refresh on groups list"
    - "Supabase query builder with !inner join and .or() for debtor/creditor expense lookup"

key-files:
  created:
    - app/group/[id]/balance/[memberId].tsx
  modified:
    - app/(tabs)/index.tsx
    - app/group/[id].tsx

key-decisions:
  - "Balance fetch on groups list uses useFocusEffect (separate from initial groups fetch) to avoid blocking group list rendering"
  - "Settlement drill-down only navigates when current user is involved in the settlement (debtor or creditor)"

patterns-established:
  - "Balance drill-down query: expenses WHERE paid_by=creditor AND expense_splits WHERE user_id=debtor OR pending_member_id=debtor"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 5 Plan 3: Balance Summary and Drill-Down Summary

**Per-group balance badges on groups list and balance drill-down screen showing contributing expenses per settlement**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T09:42:51Z
- **Completed:** 2026-02-18T09:45:08Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- Groups list now shows "You owe PX" (red) or "You are owed PX" (green) on each group card via get_my_group_balances RPC
- Balance drill-down screen queries expenses where the creditor paid and the debtor has a split
- Each contributing expense shows description, date, total amount, and the debtor's share
- Settlement cards in group detail are now pressable, navigating to the drill-down with correct direction/member params
- Pending members fully supported via pending_member_id in expense_splits query

## Task Commits

Each task was committed atomically:

1. **Task 1: Add net balance summary to groups list** - `960c3a6` (feat)
2. **Task 2: Create balance drill-down screen with navigation** - `94314d6` (feat)

## Files Created/Modified
- `app/group/[id]/balance/[memberId].tsx` - New balance drill-down screen (contributing expenses list)
- `app/(tabs)/index.tsx` - Added get_my_group_balances RPC call and balance display on group cards
- `app/group/[id].tsx` - Made settlement cards pressable with drill-down navigation

## Decisions Made
- Balance fetch on groups list uses useFocusEffect separately from initial groups fetch -- avoids blocking group card rendering
- Settlement drill-down only navigates when current user is involved in the settlement (debtor or creditor) -- third-party settlements between other members are view-only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Balances) is now complete: all three requirements met (BLNC-01 algorithm, BLNC-02 group card balances, BLNC-03 drill-down)
- Ready for Phase 6 (Polish)

## Self-Check: PASSED

---
*Phase: 05-balances*
*Completed: 2026-02-18*
