# Milestones: HatianApp

## Completed

### v1.0 — Core Expense Splitting (2026-02-18 → 2026-02-19)

**Goal:** Ship a testable private build with the core expense-splitting loop — groups, expenses, balances, offline support.

**Phases:** 7 (1 through 6, plus 4.1 inserted)
**Plans:** 22 total, ~1.4 hours execution
**Requirements:** 27/27 complete

**What shipped:**
- Phone OTP authentication with profile setup
- Groups with invite links (Expo deep linking)
- Expenses with equal/custom splits
- Pending members by phone (pre-register before install)
- Debt simplification algorithm with balance views
- Offline queue with sync-on-reconnect
- Dark-first UI with skeleton loaders, haptics, bottom sheets
- EAS internal distribution build

**Key decisions:**
- Phone OTP only (Filipino market)
- Expenses immutable in Stage 1
- Greedy two-pointer debt simplification
- expo-sqlite for Supabase session persistence
- security definer function pattern for RLS

**Last phase number:** 6
