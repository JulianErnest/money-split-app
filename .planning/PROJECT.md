# HatianApp (Filipino Splitwise)

## What This Is

A mobile expense-splitting app built for Filipino users — peso-first, designed around how barkadas actually split costs. Stage 1 (core splitting loop) is complete and distributed to testers. Stage 2 focuses on fixing the invite system and adding settle-up flows.

## Core Value

A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## Current Milestone: v1.1 Invites & Settle Up

**Goal:** Fix the broken invite/pending member system with proper consent-based invites, and add manual settle-up so users can record payments.

**Target features:**
- Fix phone lookup bug (existing users showing as pending)
- Consent-based invite system (invite inbox with accept/decline)
- Only group creator can add members by phone
- Settle up: mark whole balance as settled between two people
- Declining an invite removes associated expense splits

## Requirements

### Validated

- ✓ Phone number OTP authentication via Supabase Auth — v1.0
- ✓ Simple profile setup (display name, optional avatar) on first sign-in — v1.0
- ✓ Create groups with names, generate shareable invite links — v1.0
- ✓ Join groups via deep link (Expo deep linking) — v1.0
- ✓ View group members and list of groups — v1.0
- ✓ Add expenses: description, amount (₱), who paid, split type (equal/custom) — v1.0
- ✓ Select which group members are involved in each expense — v1.0
- ✓ View simplified balances within a group (debt simplification algorithm) — v1.0
- ✓ View running list of expenses in a group, sorted by most recent — v1.0
- ✓ Optimistic offline UI with simple sync queue — v1.0
- ✓ Dark-first design with soft green accent color — v1.0
- ✓ Bottom sheet patterns, haptic feedback, skeleton loaders, smooth transitions — v1.0
- ✓ Expenses immutable once added — v1.0
- ✓ Sensible max expense amount (~₱999,999) — v1.0
- ✓ Supabase RLS policies — users only see their own groups/expenses — v1.0
- ✓ EAS Build for internal distribution — v1.0
- ✓ Pre-register group members by phone number — v1.0

### Active

- [ ] Fix phone lookup: existing users must not appear as pending members
- [ ] Only group creator can add members by phone number
- [ ] Phone-added members receive an invite (not auto-added to group)
- [ ] Invite inbox on home screen — accept or decline pending invites
- [ ] Declining an invite removes associated expense splits from the group
- [ ] Link invites (via share sheet) continue to auto-join — no change
- [ ] Settle up: mark whole balance as settled between two people
- [ ] Settlement recorded as manual payment (no GCash/Maya integration)

### Out of Scope

- GCash / Maya payment integration — Stage 3
- Receipt scanning — Stage 3
- Push notifications / reminders — Stage 3
- Percentage-based splits — Stage 3
- Recurring expenses — Stage 3
- Group chat / comments on expenses — Stage 3
- Expense categories or tags — Stage 3
- Data export — Stage 3
- Multi-currency support — Stage 3
- OAuth / email login — phone only
- Edit/delete expenses — keep data immutable
- Leaving groups — simplifies balance integrity
- Realtime subscriptions — pull-to-refresh is acceptable
- Admin/role system for groups — creator-only permission is sufficient for now
- Partial settlements — settle whole balance only for simplicity

## Context

- Solo developer project, optimizing for speed of iteration
- Target testers: close friend group (5-10 people) using the app for real scenarios
- Distribution via Messenger / Viber invite links
- Philippine internet can be unreliable — optimistic offline UI needed
- Supabase RLS policies required from day one
- **Known bug:** Phone format mismatch causes existing users to appear as pending members (Supabase Auth stores without `+`, app sends with `+`)
- **Security gap:** Currently any group member can add anyone by phone without consent

**Data Model (Supabase / PostgreSQL):**
- `users` — id, phone_number (unique), display_name, avatar_url, created_at
- `groups` — id, name, invite_code (unique), created_by, created_at
- `group_members` — id, group_id, user_id, joined_at; unique(group_id, user_id)
- `pending_members` — id, group_id, phone_number, added_by, nickname, created_at
- `expenses` — id, group_id, description, amount, paid_by, split_type, created_by, created_at
- `expense_splits` — id, expense_id, user_id (nullable), pending_member_id (nullable), amount

**Key Screens (new/modified for v1.1):**
- Home / Groups List — Add invite inbox / badge indicator
- Invite Inbox — Accept/decline pending group invites
- Group Detail — Settle up button on balance entries
- Settlement Flow — Confirm settling a balance

## Constraints

- **Tech Stack**: React Native + Expo (managed workflow), TypeScript, Expo Router, Supabase — non-negotiable
- **Auth**: Phone number OTP only via Supabase Auth — no email, no OAuth
- **Currency**: Philippine Peso (₱) only — no multi-currency
- **Distribution**: EAS Build + internal distribution / TestFlight — not app store
- **Data Integrity**: Expenses are immutable once created
- **Amount Limit**: Max ₱999,999 per expense
- **Security**: Supabase RLS from day one; invite consent required for phone-added members

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phone OTP only (no email/OAuth) | Filipino users primarily use phone numbers | ✓ Good |
| Expenses immutable | Simplifies data integrity and balance calculations | ✓ Good |
| No leaving groups | Prevents balance inconsistencies with outstanding debts | ✓ Good |
| Optimistic offline with simple queue | PH internet unreliable; balanced complexity | ✓ Good |
| Dark-first with soft green accent | Modern fintech aesthetic | ✓ Good |
| Pull-to-refresh over Realtime | Acceptable UX; avoids complexity | ✓ Good |
| Debt simplification algorithm | Core differentiator | ✓ Good |
| Invite inbox (not push notifications) | Simpler to build, no notification infra needed | — Pending |
| Creator-only phone invites | Security: prevents random members adding strangers | — Pending |
| Whole-balance settlement only | Partial settlements add complexity, defer to later | — Pending |
| Decline removes splits | Clean separation — if you're not in the group, your splits shouldn't exist | — Pending |

---
*Last updated: 2026-02-19 after milestone v1.1 initialization*
