---
phase: 04-expenses
plan: 02
subsystem: expense-wizard
tags: [wizard, pager-view, numpad, split, form, supabase-rpc]

requires:
  - phase: 04-expenses
    plan: 01
    provides: expense-utils, create_expense RPC, database types
provides:
  - Multi-step add-expense wizard screen
  - 7 reusable expense UI components
  - GCash-style numpad amount entry
affects: [04-03 expense list/detail, 05-balances]

tech-stack:
  added: [react-native-pager-view]
  patterns: [swipeable wizard, custom numpad, lifted form state above PagerView]

key-files:
  created:
    - app/group/[id]/add-expense.tsx
    - components/expenses/NumPad.tsx
    - components/expenses/AmountDisplay.tsx
    - components/expenses/PayerSelector.tsx
    - components/expenses/MemberSelector.tsx
    - components/expenses/SplitTypeToggle.tsx
    - components/expenses/CustomSplitRow.tsx
    - components/expenses/DotIndicator.tsx
  modified:
    - package.json

key-decisions:
  - "useAmountInput hook for numpad state -- keeps raw display string, derives centavos"
  - "All members selected by default for equal split -- reduces taps for common case"
  - "Inline TextInput for custom split amounts (not custom numpad) -- simpler UX per research recommendation"

duration: 6min
completed: 2026-02-18
---

# Phase 4 Plan 2: Add-Expense Wizard Summary

**3-step swipeable expense wizard with GCash-style numpad, payer/split selection, and atomic RPC submission via react-native-pager-view.**

## Performance
- **Duration:** 6min
- **Started:** 2026-02-18T06:36:20Z
- **Completed:** 2026-02-18T06:42:05Z
- **Tasks:** 2/2
- **Files created:** 8

## Accomplishments
- Installed react-native-pager-view for native swipe navigation
- Built 7 reusable expense components following design system (colors, spacing, radius, Text, Avatar)
- Assembled 3-step wizard: amount+description, payer selection, split configuration
- useAmountInput hook enforces 999,999 peso cap, 2 decimal places, proper backspace/decimal handling
- Payer defaults to current user via auth context
- Equal split: checkbox member selection with per-person amount display
- Custom split: inline amount inputs with live remaining counter (red when non-zero, green when zero)
- Atomic submit via create_expense RPC with double-submit prevention
- Validation: amount > 0, description non-empty, splits valid before submit enabled
- TypeScript compiles clean

## Task Commits
1. **Task 1: Install pager-view and build expense components** - `270b010` (feat)
2. **Task 2: Assemble add-expense wizard with submit logic** - `3371257` (feat)

## Files Created
- `app/group/[id]/add-expense.tsx` - Multi-step wizard screen (518 lines)
- `components/expenses/NumPad.tsx` - 4x3 grid numpad with digit/decimal/backspace
- `components/expenses/AmountDisplay.tsx` - Large peso amount display using moneyLarge variant
- `components/expenses/PayerSelector.tsx` - Radio button member list for payer
- `components/expenses/MemberSelector.tsx` - Checkbox member list for equal split
- `components/expenses/SplitTypeToggle.tsx` - Segmented control for equal/custom
- `components/expenses/CustomSplitRow.tsx` - Inline peso amount input per member
- `components/expenses/DotIndicator.tsx` - Step progress dots (8px, accent/surface colors)

## Decisions Made
1. **useAmountInput hook pattern**: Keeps raw display string (e.g. "123.45") and derives centavos via parseFloat * 100. Parent manages the string, not formatted values.
2. **All members selected by default**: For equal splits, all group members start selected. Deselecting is rarer than splitting with everyone.
3. **Inline TextInput for custom amounts**: Uses system numeric keyboard (not custom numpad) for per-member amount entry. Simpler and allows standard text editing gestures.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Wizard screen accessible at /group/{id}/add-expense route
- All expense components are reusable for potential future expense editing
- Expense list (04-03) can link to this wizard from group detail screen
- create_expense RPC integration complete and ready for end-to-end testing

## Self-Check: PASSED
