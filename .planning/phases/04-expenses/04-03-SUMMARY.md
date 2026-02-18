---
phase: 04-expenses
plan: 03
subsystem: expense-display
tags: [expense-list, expense-detail, balance-impact, supabase-query, expo-router]

requires:
  - phase: 04-expenses
    provides: expense-utils (formatPeso, centavo math), create_expense RPC
  - phase: 04-expenses
    provides: add-expense wizard screen
provides:
  - Expense list with rich cards in group detail screen
  - Expense detail screen with full split breakdown
  - Balance impact display (You owe / You lent / Not involved)
affects: [05-balances]

tech-stack:
  added: []
  patterns: [useFocusEffect for data refresh, DB pesos to centavos conversion for formatPeso]

key-files:
  created:
    - components/expenses/ExpenseCard.tsx
    - app/group/[id]/expense/[expenseId].tsx
  modified:
    - app/group/[id].tsx

key-decisions:
  - id: useFocusEffect-refresh
    decision: useFocusEffect from @react-navigation/native for expense list refresh
    reason: Re-fetches data when returning from add-expense wizard without manual callback plumbing

metrics:
  duration: 3min
  completed: 2026-02-18
---

# Phase 4 Plan 3: Expense List and Detail Summary

Expense cards with balance impact in group detail, plus tappable detail screen showing full split breakdown per member.

## What Was Built

### ExpenseCard Component
Rich card component showing expense description, total peso amount, payer avatar and name, date (formatted as "Today" or "Feb 18"), and personal balance impact. Balance impact logic handles four cases: "You lent X" (accent green, when user is payer), "You owe X" (red, when user owes), "You paid X" (secondary, when payer is only split member), and "Not involved" (secondary).

### Expense Detail Screen
Full-page screen at `/group/[id]/expense/[expenseId]` showing description, total amount, payer with avatar, split type badge (Equal/Custom), formatted date, and a split breakdown list. Each split member shows their avatar, name, amount, and a "(paid)" badge if they are the payer.

### Group Detail Integration
Modified group detail screen to fetch expenses alongside existing group and members queries. Added "Add Expense" button below the invite button, expenses section with count badge above the members section, and empty state text. Uses `useFocusEffect` to re-fetch all data when the screen regains focus, ensuring the expense list updates after adding a new expense.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ExpenseCard component and expense detail screen | 45c0171 | components/expenses/ExpenseCard.tsx, app/group/[id]/expense/[expenseId].tsx |
| 2 | Integrate expenses into group detail screen | 7940e45 | app/group/[id].tsx |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **useFocusEffect for refresh** -- Used `useFocusEffect` from `@react-navigation/native` (available in expo-router) to re-fetch group data on every screen focus. This replaces the original `useEffect` and naturally handles refreshing after returning from the add-expense wizard.

## Verification

- TypeScript compiles clean (`npx tsc --noEmit` passes)
- Group detail fetches expenses with `from("expenses").select(...)` query
- ExpenseCard shows description, amount, payer, date, balance impact
- Expense cards navigate to detail screen on tap
- "Add Expense" button navigates to wizard route
- Expenses ordered most recent first (`created_at desc`)
- Empty state shown when no expenses
- Screen refreshes on focus via useFocusEffect

## Self-Check: PASSED
