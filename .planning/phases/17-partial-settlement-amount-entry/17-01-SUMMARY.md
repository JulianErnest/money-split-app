---
phase: 17-partial-settlement-amount-entry
plan: 01
subsystem: ui
tags: [react-native, bottom-sheet, numpad, settlements, posthog]

# Dependency graph
requires:
  - phase: 06-settle-up
    provides: "SettleConfirmSheet, record_settlement RPC, trackSettleUp"
  - phase: 07-expense-amount-entry
    provides: "NumPad component, useAmountInput hook pattern"
provides:
  - "Two-state SettleConfirmSheet with partial settlement amount entry"
  - "useSettlementAmountInput hook with balance-capped input"
  - "Dust rule enforcement (remainder < P1.00 forces full settle)"
  - "Differentiated toast messages for partial vs full settlements"
  - "is_partial analytics flag on settle_up PostHog event"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSettlementAmountInput: adapted amount input hook with balance cap and reset/setFull methods"
    - "getEffectiveSettleAmount: dust rule helper preventing sub-peso remainders"
    - "Two-state bottom sheet: display mode (compact) vs edit mode (expanded with NumPad)"

key-files:
  created: []
  modified:
    - "components/settlements/SettleConfirmSheet.tsx"
    - "lib/analytics.ts"

key-decisions:
  - "Inline hook and helper in SettleConfirmSheet rather than extracting to separate files (single consumer, cohesive)"
  - "Dust rule threshold at P1.00 (100 centavos) -- remainder below this forces full settlement"
  - "Display mode uses 35% snap, edit mode uses 75% snap for NumPad space"

patterns-established:
  - "Settlement amount validation: P1.00 minimum, balance cap, dust rule"
  - "Dynamic snap points: useMemo-driven snap points based on editing state"

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 17 Plan 01: Partial Settlement Amount Entry Summary

**Two-state SettleConfirmSheet with NumPad input, balance-capped validation, dust rule, and differentiated settlement toasts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T05:22:52Z
- **Completed:** 2026-02-28T05:25:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote SettleConfirmSheet with display mode (tap-to-confirm full balance) and edit mode (NumPad partial entry)
- Added useSettlementAmountInput hook with balance cap, reset, and setFull methods
- Implemented dust rule: remainder < P1.00 forces full settlement to prevent sub-peso balances
- Dynamic confirm button shows exact settle amount with disabled state for invalid amounts
- Differentiated toast messages: "Fully settled with Name" vs "Settled PX.XX to Name"
- Added is_partial boolean to PostHog settle_up analytics event

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite SettleConfirmSheet with partial settlement support** - `83cc5c7` (feat)
2. **Task 2: Update trackSettleUp analytics with isPartial flag** - `7f9714b` (feat)

## Files Created/Modified
- `components/settlements/SettleConfirmSheet.tsx` - Two-state settle sheet with useSettlementAmountInput hook, NumPad integration, validation, and differentiated toasts
- `lib/analytics.ts` - Added isPartial parameter to trackSettleUp, emits is_partial in PostHog event

## Decisions Made
- Kept useSettlementAmountInput hook inline in SettleConfirmSheet.tsx since it has a single consumer
- Used getEffectiveSettleAmount as a pure function (not a hook) for testability
- Display mode confirm passes amountCentavos directly (bypasses hook state for backwards compatibility)
- Edit mode cancel resets both editing state and amount input

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 SETL requirements covered (editable amount, pre-filled balance, balance cap, P1.00 minimum, balance refresh, backwards-compatible full settle)
- Phase 17 is the only phase in v1.5 milestone -- milestone complete after this plan
- No blockers or concerns

## Self-Check: PASSED

---
*Phase: 17-partial-settlement-amount-entry*
*Completed: 2026-02-28*
