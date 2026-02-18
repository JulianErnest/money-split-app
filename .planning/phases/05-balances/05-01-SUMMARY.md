---
phase: 05-balances
plan: 01
subsystem: algorithm
tags: [debt-simplification, greedy-algorithm, typescript, jest, tdd, centavos]

# Dependency graph
requires:
  - phase: 04-expenses
    provides: centavo-integer currency pattern, expense-utils code style
provides:
  - simplifyDebts pure function for minimal settlement transactions
  - Settlement type for balance UI components
  - netBalancesToCentavos converter for RPC response processing
affects: [05-02 (RPC integration), 05-03 (balance UI)]

# Tech tracking
tech-stack:
  added: []
  patterns: [greedy two-pointer debt simplification, centavos-only algorithm]

key-files:
  created:
    - lib/balance-utils.ts
    - lib/__tests__/balance-utils.test.ts
  modified: []

key-decisions:
  - "Greedy two-pointer algorithm for debt simplification (O(n log n), optimal for small groups)"
  - "Skip zero-balance entries in netBalancesToCentavos to avoid unnecessary map entries"

patterns-established:
  - "Pure function pattern: algorithm functions take typed inputs, return typed outputs, no side effects"
  - "TDD for algorithm code: RED (failing tests) -> GREEN (implementation) -> commit per phase"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 5 Plan 1: Greedy Debt Simplification Algorithm Summary

**TDD-driven greedy debt simplification algorithm with 13 tests covering conservation, zero-balance, multi-party, and floating-point edge cases**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T09:33:35Z
- **Completed:** 2026-02-18T09:35:01Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 2

## Accomplishments
- simplifyDebts greedy algorithm minimizes settlement transactions for any group size
- Conservation property verified: net flows always match original balances
- netBalancesToCentavos safely converts RPC decimal pesos to integer centavos
- 13 tests covering all edge cases: empty, zero-balance, 2/3/4-person, floating-point

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for simplifyDebts and netBalancesToCentavos** - `2993013` (test)
2. **GREEN: Implement debt simplification algorithm** - `988d4f9` (feat)

_TDD plan: RED (test) -> GREEN (feat). No refactor needed -- implementation is already clean._

## Files Created/Modified
- `lib/balance-utils.ts` - simplifyDebts greedy algorithm, netBalancesToCentavos converter, Settlement type
- `lib/__tests__/balance-utils.test.ts` - 13 TDD tests covering all edge cases

## Decisions Made
- Greedy two-pointer algorithm: sort debtors/creditors descending, transfer min of pair, advance pointer when zeroed. O(n log n) for sort, O(n) for matching.
- Zero-balance entries skipped in netBalancesToCentavos to keep map clean for simplifyDebts
- All amounts in centavos (integers) throughout -- no floating-point in algorithm

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- simplifyDebts and Settlement type ready for import in balance UI (05-03)
- netBalancesToCentavos ready for RPC response processing (05-02)
- Code style matches existing expense-utils.ts patterns

## Self-Check: PASSED

---
*Phase: 05-balances*
*Completed: 2026-02-18*
