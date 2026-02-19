# Roadmap: HatianApp (Filipino Splitwise)

## Milestones

- v1.0 MVP - Phases 1-6 (shipped 2026-02-19)
- v1.1 Invites & Settle Up - Phases 7-9 (in progress)

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

### v1.1 Invites & Settle Up (In Progress)

**Milestone Goal:** Fix the broken invite/pending member system with proper consent-based invites, and add manual settle-up so users can record payments.

- [ ] **Phase 7: Invite Infrastructure** - Fix phone lookup, add invite schema, enforce creator-only permissions
- [ ] **Phase 8: Invite UX** - Invite inbox, accept/decline flows, decline cleanup
- [ ] **Phase 9: Settle Up** - Record settlements, update balances, view history

## Phase Details

### Phase 7: Invite Infrastructure

**Goal**: The database correctly handles phone lookups and models invites as a consent-based flow, with only group creators allowed to send phone invites
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: INV-01, INV-02, INV-03, INV-08
**Success Criteria** (what must be TRUE):
  1. Looking up a user by phone number succeeds regardless of whether the number includes a `+` prefix or not (the format mismatch bug is resolved)
  2. Only the group creator can add members by phone number; other members see the option disabled or hidden
  3. When the creator adds someone by phone, that person appears as a pending invite (not as a full group member) until they accept
  4. Joining a group via invite link (share sheet deep link) continues to work as an instant auto-join with no accept/decline step
**Plans**: TBD

Plans:
- [ ] 07-01: Phone format normalization fix and creator-only permission guard in RPC
- [ ] 07-02: Invite schema migration (pending_members gains invite status) and updated add-member flow

### Phase 8: Invite UX

**Goal**: Users who have been invited to a group by phone can see, accept, or decline those invites from within the app
**Depends on**: Phase 7
**Requirements**: INV-04, INV-05, INV-06, INV-07
**Success Criteria** (what must be TRUE):
  1. User sees a list of pending group invites on the home screen (or a visible inbox section) showing which group invited them and who sent the invite
  2. User can accept an invite and immediately becomes a full group member with access to the group's expenses and balances
  3. User can decline an invite, which removes the invite from their inbox
  4. When a user declines an invite, all expense splits that referenced their pending member record are deleted so balances recalculate correctly
**Plans**: TBD

Plans:
- [ ] 08-01: Invite inbox UI on home screen, accept invite RPC and flow
- [ ] 08-02: Decline invite RPC with cascading split cleanup, decline UI flow

### Phase 9: Settle Up

**Goal**: Users can record that a debt between two people has been settled, and the app reflects this in all balance views
**Depends on**: Phase 7 (needs working balances from v1.0; independent of Phase 8 invite UX)
**Requirements**: SETL-01, SETL-02, SETL-03, SETL-04
**Success Criteria** (what must be TRUE):
  1. User can tap "Settle up" on a balance entry and confirm settling the full net amount owed between themselves and another member
  2. The settlement is recorded with the amount, who paid, who received, and the timestamp
  3. After settling, the balance between those two people in the group updates to reflect the payment (reducing or zeroing the displayed debt)
  4. User can view a history of settlements within a group showing who paid who, how much, and when
**Plans**: TBD

Plans:
- [ ] 09-01: Settlements table, record_settlement RPC, balance RPC updates to incorporate settlements
- [ ] 09-02: Settle up UI flow from balance view, settlement history screen

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Design System | v1.0 | 2/2 | Complete | 2026-02-18 |
| 2. Authentication | v1.0 | 2/2 | Complete | 2026-02-18 |
| 3. Groups | v1.0 | 3/3 | Complete | 2026-02-18 |
| 4. Expenses | v1.0 | 3/3 | Complete | 2026-02-18 |
| 4.1 Pending Members (INSERTED) | v1.0 | 3/3 | Complete | 2026-02-18 |
| 5. Balances | v1.0 | 3/3 | Complete | 2026-02-18 |
| 6. Polish & Distribution | v1.0 | 6/6 | Complete | 2026-02-19 |
| 7. Invite Infrastructure | v1.1 | 0/2 | Not started | - |
| 8. Invite UX | v1.1 | 0/2 | Not started | - |
| 9. Settle Up | v1.1 | 0/2 | Not started | - |
