# Roadmap: HatianApp (Filipino Splitwise)

## Milestones

- v1.0 MVP - Phases 1-6 (shipped 2026-02-19)
- v1.1 Invites & Settle Up - Phases 7-9 (shipped 2026-02-20)
- v1.2 Home Screen Dashboard - Phases 10-12 (shipped 2026-02-21)
- v1.3 Apple Sign-In - Phases 13-15 (in progress)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-19</summary>

### Phase 1: Foundation & Design System

**Goal**: The project skeleton exists with a working Supabase backend and a reusable dark-first design system, so all subsequent phases build on solid infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, UX-05
**Plans**: 2 plans

Plans:

- [x] 01-01-PLAN.md — Expo project scaffolding, Supabase CLI + migration with full schema and RLS, typed client, Expo Router tabs
- [x] 01-02-PLAN.md — Design system tokens (colors, typography, spacing), reusable UI components (Text, Button, Card, Input, Avatar), custom tab bar with center FAB

### Phase 2: Authentication

**Goal**: Users can sign in with their phone number and have a profile, establishing identity for all group and expense operations
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Plans**: 2 plans

Plans:

- [x] 02-01-PLAN.md — Phone OTP auth flow (AuthProvider, phone input with +63 prefix, OTP verification with 6 digit boxes)
- [x] 02-02-PLAN.md — Profile setup screen for new users, profile tab with sign-out

### Phase 3: Groups

**Goal**: Users can create groups, invite friends via shareable links, and see their groups and members
**Depends on**: Phase 2
**Requirements**: GRPS-01, GRPS-02, GRPS-03, GRPS-04, GRPS-05, GRPS-06
**Plans**: 3 plans

Plans:

- [x] 03-01-PLAN.md — Supabase RPC functions (create_group, join_group_by_invite), groups list screen, create group flow
- [x] 03-02-PLAN.md — Invite link sharing via share sheet, deep link handling (+native-intent), join flow screen, group detail shell
- [x] 03-03-PLAN.md — Group detail member list, groups list member counts and avatar polish

### Phase 4: Expenses

**Goal**: Users can add shared expenses to a group with equal or custom splits, and browse the expense history
**Depends on**: Phase 3
**Requirements**: EXPN-01, EXPN-02, EXPN-03, EXPN-04, INFR-03
**Plans**: 3 plans

Plans:

- [x] 04-01-PLAN.md — TDD expense utils (split math, peso formatting) + create_expense RPC migration
- [x] 04-02-PLAN.md — Add expense wizard with numpad, payer selection, equal/custom splits, and RPC submit
- [x] 04-03-PLAN.md — Expense list in group detail, expense detail view with split breakdown

### Phase 4.1: Pending Members by Phone (INSERTED)

**Goal**: Users can add friends to a group by phone number before they install the app, include them in expense splits, and have their accounts auto-link when they sign up
**Depends on**: Phase 4
**Plans**: 3 plans

Plans:

- [x] 04.1-01-PLAN.md — Database migrations: pending_members table, expense_splits alterations, auto-link trigger, RPCs
- [x] 04.1-02-PLAN.md — Add member by phone modal, unified member type, pending member display in group detail
- [x] 04.1-03-PLAN.md — Expense wizard and detail screen updates for pending member splits

### Phase 5: Balances

**Goal**: Users can see simplified "who owes who" balances that minimize the number of transactions needed
**Depends on**: Phase 4
**Requirements**: BLNC-01, BLNC-02, BLNC-03
**Plans**: 3 plans

Plans:

- [x] 05-01-PLAN.md — TDD greedy debt simplification algorithm (simplifyDebts pure function)
- [x] 05-02-PLAN.md — Balance RPCs (get_group_balances, get_my_group_balances) and group detail balances section
- [x] 05-03-PLAN.md — Per-group net balance summary on groups list and balance drill-down screen

### Phase 6: Polish & Distribution

**Goal**: The app feels polished with offline support and micro-interactions, and is distributed to testers via EAS
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-06, UX-07, UX-08, INFR-02
**Plans**: 6 plans

Plans:

- [x] 06-01-PLAN.md — Install deps, network context, offline queue, cached data layer, wire providers into root layout
- [x] 06-02-PLAN.md — Skeleton loaders, pull-to-refresh, cached data wiring, haptic feedback on key actions
- [x] 06-03-PLAN.md — Bottom sheets replacing modals, empty states with Taglish microcopy
- [x] 06-04-PLAN.md — EAS Build configuration for internal distribution
- [x] 06-05-PLAN.md — Offline behavioral wiring: sync-on-reconnect, error toast with Retry, optimistic enqueue in screens
- [x] 06-06-PLAN.md — Gap closure: fix offline banner false positive and pull-to-refresh on short-content screens

</details>

<details>
<summary>v1.1 Invites & Settle Up (Phases 7-9) - SHIPPED 2026-02-20</summary>

- [x] Phase 7: Invite Infrastructure (2/2 plans) — completed 2026-02-19
- [x] Phase 8: Invite UX (2/2 plans) — completed 2026-02-20
- [x] Phase 9: Settle Up (2/2 plans) — completed 2026-02-20

</details>

<details>
<summary>v1.2 Home Screen Dashboard (Phases 10-12) - SHIPPED 2026-02-21</summary>

- [x] Phase 10: Balance Summary & Dashboard Layout (1/1 plans) — completed 2026-02-21
- [x] Phase 11: Activity Feed (2/2 plans) — completed 2026-02-21
- [x] Phase 12: Group Cards & Visual Polish (2/2 plans) — completed 2026-02-21

</details>

### v1.3 Apple Sign-In (In Progress)

**Milestone Goal:** Replace phone number OTP authentication with Apple Sign-In while still requiring phone number collection for the invite system.

#### Phase 13: Database & Infrastructure Prep

**Goal**: The database and Supabase configuration can safely handle Apple Sign-In users without breaking existing phone OTP users
**Depends on**: Phase 12 (existing auth system, users table, pending_members trigger)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05
**Success Criteria** (what must be TRUE):
  1. A user row can exist with NULL phone_number (column is nullable, existing rows with values are unaffected)
  2. The auth trigger creates a users row for Apple Sign-In users without crashing on NULL phone
  3. An RPC exists that links pending member invites when a phone number is provided after authentication
  4. Apple Sign-In provider is enabled in Supabase dashboard with the correct bundle ID
  5. app.json is configured with expo-apple-authentication plugin and usesAppleSignIn capability flag
**Plans**: 2 plans

Plans:
- [x] 13-01-PLAN.md — Database migration: nullable phone_number, trigger rewrite with NULLIF guard, link_phone_to_pending_invites RPC, type regeneration
- [x] 13-02-PLAN.md — Install expo-apple-authentication, configure app.json, enable Supabase Apple provider

#### Phase 14: Core Auth Replacement

**Goal**: Users can sign in with Apple and the phone OTP flow is completely removed
**Depends on**: Phase 13 (database handles NULL phone, Apple provider enabled)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. User sees an Apple Sign-In button and can authenticate via native iOS dialog (Face ID / Touch ID)
  2. Successful Apple authentication creates a valid Supabase session that persists across app restarts
  3. User cancelling the Apple dialog returns to the sign-in screen without any error shown
  4. Phone OTP screens (phone.tsx, otp.tsx) no longer exist in the app
  5. All navigation routes point to the Apple Sign-In screen with no dead references to phone auth
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

#### Phase 15: Profile Setup & Invite Linking

**Goal**: New users complete profile setup with phone number and the invite system works end-to-end with Apple Sign-In
**Depends on**: Phase 14 (Apple Sign-In working, users can authenticate)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. Profile setup requires phone number input and validates PH format (+63 9XX) before allowing save
  2. Apple-provided display name is pre-filled on first sign-in so user does not have to retype their name
  3. After saving phone in profile setup, any pending invites for that phone number are automatically linked
  4. User cannot complete onboarding without both display name and phone number being present
  5. No phone OTP language appears anywhere in the UI (sign-out message shows auth-agnostic text, Apple relay email is never displayed)
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Design System | v1.0 | 2/2 | Complete | 2026-02-18 |
| 2. Authentication | v1.0 | 2/2 | Complete | 2026-02-18 |
| 3. Groups | v1.0 | 3/3 | Complete | 2026-02-18 |
| 4. Expenses | v1.0 | 3/3 | Complete | 2026-02-18 |
| 4.1 Pending Members (INSERTED) | v1.0 | 3/3 | Complete | 2026-02-18 |
| 5. Balances | v1.0 | 3/3 | Complete | 2026-02-18 |
| 6. Polish & Distribution | v1.0 | 6/6 | Complete | 2026-02-19 |
| 7. Invite Infrastructure | v1.1 | 2/2 | Complete | 2026-02-19 |
| 8. Invite UX | v1.1 | 2/2 | Complete | 2026-02-20 |
| 9. Settle Up | v1.1 | 2/2 | Complete | 2026-02-20 |
| 10. Balance Summary & Dashboard Layout | v1.2 | 1/1 | Complete | 2026-02-21 |
| 11. Activity Feed | v1.2 | 2/2 | Complete | 2026-02-21 |
| 12. Group Cards & Visual Polish | v1.2 | 2/2 | Complete | 2026-02-21 |
| 13. Database & Infrastructure Prep | v1.3 | 2/2 | Complete | 2026-02-22 |
| 14. Core Auth Replacement | v1.3 | 0/TBD | Not started | - |
| 15. Profile Setup & Invite Linking | v1.3 | 0/TBD | Not started | - |
