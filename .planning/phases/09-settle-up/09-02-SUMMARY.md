---
phase: 09-settle-up
plan: 02
subsystem: ui
tags: [react-native, bottom-sheet, settlements, haptics, toast, supabase-rpc]

# Dependency graph
requires:
  - phase: 09-settle-up/01
    provides: settlements table, record_settlement RPC, delete_settlement RPC, updated balance RPCs
  - phase: 04-balances
    provides: balance-utils.ts (Settlement type, simplifyDebts, formatPeso)
provides:
  - SettleConfirmSheet bottom sheet component for confirming settlements
  - Settle button on balance rows (current user only, real members only)
  - Settlement history section in group detail with long-press delete
  - Complete settle-up UI wiring to backend RPCs
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SettleConfirmSheet follows forwardRef+AppBottomSheet pattern from AddMemberSheet"
    - "Settlement history via parallel Supabase query with joined user names"
    - "Long-press delete with Alert confirmation and RPC call"

key-files:
  created:
    - components/settlements/SettleConfirmSheet.tsx
  modified:
    - app/group/[id].tsx

key-decisions:
  - "Settlement history placed between Balances and Expenses sections for natural flow"
  - "Long-press to delete settlement (creator only), no swipe gesture"
  - "Settle button positioned at far right of balance card row"

patterns-established:
  - "Settlement confirmation bottom sheet pattern with non-editable amount"
  - "Parallel data fetch pattern extended to include settlement history query"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 9 Plan 2: Settle Up UI Summary

**SettleConfirmSheet bottom sheet with settle buttons on balance rows, settlement history section with long-press delete, wired to record_settlement and delete_settlement RPCs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T15:20:19Z
- **Completed:** 2026-02-20T15:24:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created SettleConfirmSheet component with forwardRef+AppBottomSheet pattern, non-editable peso amount display, confirm button calling record_settlement RPC with centavos-to-pesos conversion, success haptic + toast, error handling
- Added "Settle" button to balance rows in group detail (only shows when current user is debtor or creditor AND both parties are real members, not pending)
- Added settlement history section between Balances and Expenses with count badge, empty state, and date-formatted entries showing "payer paid receiver" with amount
- Added long-press delete handler for settlement history entries (creator-only guard) with Alert confirmation calling delete_settlement RPC
- Extended fetchData to include parallel settlement history query with joined user display names
- Wired SettleConfirmSheet to bottom sheet ref with fetchData callback for immediate refresh after settling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SettleConfirmSheet component** - `e3d932d` (feat)
2. **Task 2: Add settle buttons, settlement history, and delete to group detail** - `0e0b678` (feat)

## Files Created/Modified
- `components/settlements/SettleConfirmSheet.tsx` - Bottom sheet confirmation component with non-editable amount, confirm button, cancel link, haptic feedback, toast notifications
- `app/group/[id].tsx` - Settle button on balance rows, settlement history section, delete settlement handler, SettleConfirmSheet rendering, extended fetchData with settlement history query

## Decisions Made
- Settlement history section placed between Balances and Expenses for natural reading flow (see what's owed -> what's been settled -> full expense history)
- Long-press gesture for delete (rather than swipe) to match simple interaction pattern and avoid conflicts with scroll
- Settle button at far right of balance card row keeps existing debtor/amount/creditor layout intact
- Creator-only delete guard (sh.created_by !== currentUserId early return) prevents non-creators from seeing delete alert

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Settle-up feature is fully complete: backend (09-01) + UI (09-02) wired together
- Pre-existing TypeScript error in `app/(tabs)/index.tsx` (SectionList type mismatch from phase 08-02) remains unrelated
- All 28 plans across 9 phases are now complete

## Self-Check: PASSED

---
*Phase: 09-settle-up*
*Completed: 2026-02-20*
