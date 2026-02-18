# Roadmap: HatianApp (Filipino Splitwise)

## Overview

HatianApp goes from zero to a testable private build in 6 phases, following the natural dependency chain: foundation and design system first, then authentication, groups, expenses, balance computation, and finally UX polish with distribution. Each phase delivers a complete, verifiable capability that unblocks the next, culminating in a build that 5-10 friends can install and use to split real expenses.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Design System** - Expo project, Supabase schema with RLS, and dark-first design tokens
- [x] **Phase 2: Authentication** - Phone OTP sign-in with profile setup
- [x] **Phase 3: Groups** - Create, join, and browse groups with invite links
- [x] **Phase 4: Expenses** - Add and view expenses with equal and custom splits
- [x] **Phase 4.1: Pending Members by Phone** - Pre-register group members by phone number before they install the app (INSERTED)
- [ ] **Phase 5: Balances** - Debt simplification algorithm and balance views
- [ ] **Phase 6: Polish & Distribution** - Offline support, micro-interactions, and EAS build for testers

## Phase Details

### Phase 1: Foundation & Design System

**Goal**: The project skeleton exists with a working Supabase backend and a reusable dark-first design system, so all subsequent phases build on solid infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, UX-05
**Success Criteria** (what must be TRUE):

1. Expo app launches on a device/simulator and renders a screen using the dark-first theme with soft green accent
2. Supabase database tables (users, groups, group_members, expenses, expense_splits) exist with RLS policies that restrict access to owned data
3. Design tokens (colors, typography, spacing) are defined and applied consistently from a single source of truth
4. Expo Router navigation shell is in place with bottom tabs or stack navigator ready for screens
   **Plans**: 2 plans

Plans:

- [x] 01-01-PLAN.md — Expo project scaffolding, Supabase CLI + migration with full schema and RLS, typed client, Expo Router tabs
- [x] 01-02-PLAN.md — Design system tokens (colors, typography, spacing), reusable UI components (Text, Button, Card, Input, Avatar), custom tab bar with center FAB

### Phase 2: Authentication

**Goal**: Users can sign in with their phone number and have a profile, establishing identity for all group and expense operations
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):

1. User can enter a Philippine phone number, receive an OTP, and sign in successfully
2. First-time user is prompted to set a display name and optional avatar before reaching the home screen
3. User can sign out and is returned to the auth screen
4. Returning user is automatically signed in without re-entering OTP (Supabase session persistence)
   **Plans**: 2 plans

Plans:

- [x] 02-01-PLAN.md — Phone OTP auth flow (AuthProvider, phone input with +63 prefix, OTP verification with 6 digit boxes)
- [x] 02-02-PLAN.md — Profile setup screen for new users, profile tab with sign-out

### Phase 3: Groups

**Goal**: Users can create groups, invite friends via shareable links, and see their groups and members
**Depends on**: Phase 2
**Requirements**: GRPS-01, GRPS-02, GRPS-03, GRPS-04, GRPS-05, GRPS-06
**Success Criteria** (what must be TRUE):

1. User can create a new group by entering a name and sees it appear in their groups list
2. User can generate a shareable invite link and send it via the system share sheet
3. Another user can tap the invite link and join the group via Expo deep linking
4. User can view all groups they belong to on the home screen, each with an auto-generated avatar
5. User can tap into a group and see its list of members
   **Plans**: 3 plans

Plans:

- [x] 03-01-PLAN.md — Supabase RPC functions (create_group, join_group_by_invite), groups list screen, create group flow
- [x] 03-02-PLAN.md — Invite link sharing via share sheet, deep link handling (+native-intent), join flow screen, group detail shell
- [x] 03-03-PLAN.md — Group detail member list, groups list member counts and avatar polish

### Phase 4: Expenses

**Goal**: Users can add shared expenses to a group with equal or custom splits, and browse the expense history
**Depends on**: Phase 3
**Requirements**: EXPN-01, EXPN-02, EXPN-03, EXPN-04, INFR-03
**Success Criteria** (what must be TRUE):

1. User can add an expense with description, amount in pesos, who paid, and split type (equal or custom)
2. User can select which group members are involved in an equal split, and the app divides the amount evenly
3. User can assign custom amounts per member, and the app validates they sum to the total
4. User can view a chronological list of expenses in a group, most recent first
5. Expense amounts are capped at 999,999 pesos with clear validation feedback
   **Plans**: 3 plans

Plans:

- [x] 04-01-PLAN.md — TDD expense utils (split math, peso formatting) + create_expense RPC migration
- [x] 04-02-PLAN.md — Add expense wizard with numpad, payer selection, equal/custom splits, and RPC submit
- [x] 04-03-PLAN.md — Expense list in group detail, expense detail view with split breakdown

### Phase 4.1: Pending Members by Phone (INSERTED)
**Goal**: Users can add friends to a group by phone number before they install the app, include them in expense splits, and have their accounts auto-link when they sign up
**Depends on**: Phase 4
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User can add a group member by entering a +63 phone number, even if that person hasn't signed up
  2. Pending members appear in the group member list with a "pending" indicator
  3. Pending members can be selected in expense splits (equal and custom)
  4. When a pending member signs up with their phone number, their account auto-links and they see existing debts
  5. Existing expense splits referencing the pending member transfer to the real account
**Plans**: 3 plans

Plans:
- [x] 04.1-01-PLAN.md — Database migrations: pending_members table, expense_splits alterations, auto-link trigger, RPCs
- [x] 04.1-02-PLAN.md — Add member by phone modal, unified member type, pending member display in group detail
- [x] 04.1-03-PLAN.md — Expense wizard and detail screen updates for pending member splits

### Phase 5: Balances

**Goal**: Users can see simplified "who owes who" balances that minimize the number of transactions needed
**Depends on**: Phase 4
**Requirements**: BLNC-01, BLNC-02, BLNC-03
**Success Criteria** (what must be TRUE):

1. User can view simplified balances within a group showing the minimum set of transactions to settle all debts
2. Each group in the groups list shows a quick net balance summary (e.g., "You owe 350" or "You are owed 200")
3. User can tap a balance entry to see which expenses contribute to that debt
   **Plans**: 3 plans

Plans:

- [ ] 05-01-PLAN.md — TDD greedy debt simplification algorithm (simplifyDebts pure function)
- [ ] 05-02-PLAN.md — Balance RPCs (get_group_balances, get_my_group_balances) and group detail balances section
- [ ] 05-03-PLAN.md — Per-group net balance summary on groups list and balance drill-down screen

### Phase 6: Polish & Distribution

**Goal**: The app feels polished with offline support and micro-interactions, and is distributed to testers via EAS
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-06, UX-07, UX-08, INFR-02
**Success Criteria** (what must be TRUE):

1. User can perform actions (add expense, create group) while offline; actions queue and sync when connectivity returns, with a toast on failure
2. Lists show skeleton loaders during initial load and support pull-to-refresh with smooth animation
3. Key actions (add expense, join group) trigger haptic feedback; forms and actions use bottom sheet patterns
4. Empty states display friendly microcopy with helpful guidance; peso sign and casual Taglish tone are used throughout
5. Testers can install the app via EAS internal distribution (TestFlight for iOS, APK/AAB for Android)
   **Plans**: TBD

Plans:

- [ ] 06-01: Offline queue with optimistic UI and sync logic
- [ ] 06-02: Skeleton loaders, pull-to-refresh, haptics, and bottom sheets
- [ ] 06-03: Empty states, Taglish microcopy, and EAS build configuration

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 4.1 -> 5 -> 6

| Phase                              | Plans Complete | Status      | Completed  |
| ---------------------------------- | -------------- | ----------- | ---------- |
| 1. Foundation & Design System      | 2/2            | Complete    | 2026-02-18 |
| 2. Authentication                  | 2/2            | Complete    | 2026-02-18 |
| 3. Groups                          | 3/3            | Complete    | 2026-02-18 |
| 4. Expenses                        | 3/3            | Complete    | 2026-02-18 |
| 4.1 Pending Members (INSERTED)     | 3/3            | Complete    | 2026-02-18 |
| 5. Balances                        | 0/3            | Not started | -          |
| 6. Polish & Distribution           | 0/3            | Not started | -          |
