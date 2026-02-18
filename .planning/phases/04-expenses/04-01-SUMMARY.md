---
phase: 04-expenses
plan: 01
subsystem: expense-math
tags: [currency, centavos, split-calculation, rpc, supabase, jest, tdd]

requires:
  - phase: 01-foundation
    provides: database schema (expenses + expense_splits tables)
provides:
  - Pure expense split calculation and formatting functions
  - Atomic create_expense RPC migration
  - Test infrastructure (jest + ts-jest)
affects: [04-02 wizard UI, 04-03 expense list, 05-balances]

tech-stack:
  added: [jest, ts-jest, "@types/jest"]
  patterns: [centavo integer math, TDD red-green-refactor, Supabase RPC security definer]

key-files:
  created:
    - lib/expense-utils.ts
    - lib/__tests__/expense-utils.test.ts
    - supabase/migrations/00004_create_expense_rpc.sql
    - jest.config.js
  modified:
    - lib/database.types.ts
    - package.json

key-decisions:
  - "Jest with ts-jest over vitest -- expo ecosystem compatibility, no extra config needed"
  - "Object.values cast as number[] for strict TS compatibility in reduce operations"

duration: 6min
completed: 2026-02-18
---

# Phase 4 Plan 1: Expense Math Foundation Summary

**TDD-built centavo integer math utilities (19 tests) plus atomic create_expense RPC with membership and split validation.**

## Performance
- **Duration:** 6min
- **Started:** 2026-02-18T06:27:13Z
- **Completed:** 2026-02-18T06:33:14Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments
- Built complete expense utility library with pure functions for centavo math
- 19 tests covering all edge cases (remainder distribution, zero amounts, max cap)
- TDD approach: RED committed before GREEN, all tests passing
- Atomic create_expense RPC validates auth, group membership, payer membership, split type, and split sum
- Updated database types with create_expense function signature
- TypeScript compiles clean

## Task Commits
1. **Task 1 RED: Failing tests** - `06c2f09` (test)
2. **Task 1 GREEN: Implementation** - `11d7247` (feat)
3. **Task 2: RPC migration and types** - `56c5d0c` (feat)

## Files Created/Modified
- `lib/expense-utils.ts` - Pure functions: pesosToCentavos, centavosToPesos, formatPeso, calculateEqualSplit, customSplitRemaining, MAX_AMOUNT_CENTAVOS
- `lib/__tests__/expense-utils.test.ts` - 19 tests covering all expense math functions and edge cases
- `supabase/migrations/00004_create_expense_rpc.sql` - Atomic RPC: auth check, membership validation, split sum validation, expense+splits insert
- `jest.config.js` - Jest configuration with ts-jest preset and path aliases
- `lib/database.types.ts` - Added create_expense function to Functions interface
- `package.json` - Added jest, ts-jest, @types/jest devDependencies

## Decisions Made
1. **Jest with ts-jest** over vitest: expo ecosystem compatibility, ts-jest handles TypeScript compilation without additional babel config
2. **Cast Object.values as number[]**: Required for strict TypeScript mode when using reduce on Record<string, number> values

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Expense utilities ready for wizard UI (04-02): calculateEqualSplit, customSplitRemaining, formatPeso all tested
- create_expense RPC ready for form submission: accepts group_id, description, amount, paid_by, split_type, splits JSONB
- Test infrastructure (jest) available for future TDD plans

## Self-Check: PASSED
