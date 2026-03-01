# HatianApp (Filipino Splitwise)

## What This Is

A mobile expense-splitting app built for Filipino users — peso-first, designed around how barkadas actually split costs. Supports group creation, shared expenses with equal/custom splits, simplified balance views, consent-based invites, and settle-up to record payments between members.

## Core Value

A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## Current State

**Latest shipped:** v1.5 Partial Settlements (2026-02-28)
**Total milestones:** 6 (v1.0 through v1.5)
**Total phases:** 17
**Total plans:** 42

## Requirements

### Validated

- ✓ Phone number OTP authentication via Supabase Auth — v1.0
- ✓ Simple profile setup (display name, optional avatar) on first sign-in — v1.0
- ✓ Create groups with names, generate shareable invite links — v1.0
- ✓ Join groups via deep link (Expo deep linking) — v1.0
- ✓ View group members and list of groups — v1.0
- ✓ Add expenses: description, amount, who paid, split type (equal/custom) — v1.0
- ✓ Select which group members are involved in each expense — v1.0
- ✓ View simplified balances within a group (debt simplification algorithm) — v1.0
- ✓ View running list of expenses in a group, sorted by most recent — v1.0
- ✓ Optimistic offline UI with simple sync queue — v1.0
- ✓ Dark-first design with soft green accent color — v1.0
- ✓ Bottom sheet patterns, haptic feedback, skeleton loaders, smooth transitions — v1.0
- ✓ Expenses immutable once added — v1.0
- ✓ Sensible max expense amount (~999,999) — v1.0
- ✓ Supabase RLS policies — users only see their own groups/expenses — v1.0
- ✓ EAS Build for internal distribution — v1.0
- ✓ Pre-register group members by phone number — v1.0
- ✓ Phone lookup fix: existing users identified regardless of phone format — v1.1
- ✓ Creator-only phone invites for security — v1.1
- ✓ Consent-based invites (phone-added members receive invite, not auto-added) — v1.1
- ✓ Invite inbox on home screen with accept/decline — v1.1
- ✓ Decline removes associated expense splits — v1.1
- ✓ Link invites continue to auto-join — v1.1
- ✓ Settle up: mark whole balance as settled — v1.1
- ✓ Settlement recorded with amount, payer, payee, timestamp — v1.1
- ✓ PostHog SDK integrated with provider wrapper — v1.4
- ✓ User identification synced with Supabase auth — v1.4
- ✓ Automatic screen view tracking — v1.4
- ✓ Key action event tracking across all core flows — v1.4
- ✓ User properties synced to PostHog — v1.4
- ✓ Editable settlement amount via numpad pre-filled with full balance — v1.5
- ✓ Settlement amount capped at current balance (no overpayment) — v1.5
- ✓ Partial settlement decreases balance by settled amount — v1.5
- ✓ Settlement history displays partial amounts correctly — v1.5
- ✓ Full settlement still works when user doesn't change the pre-filled amount — v1.5

### Active

(None — define requirements for next milestone with `/gsd:new-milestone`)

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
- Email login — Apple Sign-In only for now
- Edit/delete expenses — keep data immutable
- Leaving groups — simplifies balance integrity
- Realtime subscriptions — pull-to-refresh is acceptable
- Admin/role system for groups — creator-only permission is sufficient
- Overpayment beyond current balance — cap at balance amount for simplicity

## Context

- Solo developer project, optimizing for speed of iteration
- Target testers: close friend group (5-10 people) using the app for real scenarios
- Distribution via Messenger / Viber invite links
- Philippine internet can be unreliable — optimistic offline UI needed
- Supabase RLS policies required from day one
- Shipped v1.0 through v1.5 (Feb 18 → Feb 28) — ~10,400 LOC TypeScript
- 42 plans executed across 17 phases (including 1 inserted phase)

**Data Model (Supabase / PostgreSQL):**
- `users` — id, phone_number (unique), display_name, avatar_url, created_at
- `groups` — id, name, invite_code (unique), created_by, created_at
- `group_members` — id, group_id, user_id, joined_at; unique(group_id, user_id)
- `pending_members` — id, group_id, phone_number, added_by, nickname, invite_status, user_id, created_at
- `expenses` — id, group_id, description, amount, paid_by, split_type, created_by, created_at
- `expense_splits` — id, expense_id, user_id (nullable), pending_member_id (nullable), amount
- `settlements` — id, group_id, paid_by, paid_to, amount, created_by, created_at

## Constraints

- **Tech Stack**: React Native + Expo (managed workflow), TypeScript, Expo Router, Supabase — non-negotiable
- **Auth**: Apple Sign-In via Supabase Auth — phone number collected (unverified) for invites
- **Currency**: Philippine Peso only — no multi-currency
- **Distribution**: EAS Build + internal distribution / TestFlight — not app store
- **Data Integrity**: Expenses are immutable once created
- **Amount Limit**: Max 999,999 per expense
- **Security**: Supabase RLS from day one; invite consent required for phone-added members

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phone OTP only (no email/OAuth) | Filipino users primarily use phone numbers | ✓ Superseded by Apple Sign-In |
| Apple Sign-In replaces phone OTP | Simpler auth UX; phone still collected for invites | Pending |
| Expenses immutable | Simplifies data integrity and balance calculations | ✓ Good |
| No leaving groups | Prevents balance inconsistencies with outstanding debts | ✓ Good |
| Optimistic offline with simple queue | PH internet unreliable; balanced complexity | ✓ Good |
| Dark-first with soft green accent | Modern fintech aesthetic | ✓ Good |
| Pull-to-refresh over Realtime | Acceptable UX; avoids complexity | ✓ Good |
| Debt simplification algorithm | Core differentiator | ✓ Good |
| Invite inbox (not push notifications) | Simpler to build, no notification infra needed | ✓ Good |
| Creator-only phone invites | Security: prevents random members adding strangers | ✓ Good |
| Whole-balance settlement only | Partial settlements add complexity, defer to later | ✓ Resolved — v1.5 added partial settlements |
| Decline removes splits (hard delete) | Clean separation; allows re-invite by creator | ✓ Good |
| No server-side settlement amount validation | Race condition tolerance; UI enforces whole-balance | ✓ Good |
| Separate settlements table (not expense type) | Clean separation of concerns, no expense query pollution | ✓ Good |

---
*Last updated: 2026-03-01 after v1.5 milestone*
