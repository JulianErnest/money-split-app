# HatianApp (Filipino Splitwise)

## What This Is

A mobile expense-splitting app built for Filipino users — peso-first, designed around how barkadas actually split costs. Stage 1 is a private test build distributed to 5-10 friends via EAS internal distribution / TestFlight to validate the core expense-splitting loop before a public release.

## Core Value

A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Phone number OTP authentication via Supabase Auth
- [ ] Simple profile setup (display name, optional avatar) on first sign-in
- [ ] Create groups with names, generate shareable invite links
- [ ] Join groups via deep link (Expo deep linking)
- [ ] View group members and list of groups
- [ ] Add expenses: description, amount (₱), who paid, split type (equal/custom)
- [ ] Select which group members are involved in each expense
- [ ] View simplified balances within a group (debt simplification algorithm)
- [ ] View running list of expenses in a group, sorted by most recent
- [ ] Optimistic offline UI with simple sync queue (queue actions offline, try once when back online, toast on failure)
- [ ] Dark-first design with soft green accent color
- [ ] Bottom sheet patterns, haptic feedback, skeleton loaders, smooth transitions
- [ ] Expenses immutable once added (no edit/delete in Stage 1)
- [ ] Sensible max expense amount (~₱999,999)
- [ ] No leaving groups in Stage 1

### Out of Scope

- Settle up / mark as paid — Stage 2
- GCash / Maya integration — Stage 2
- Receipt scanning — Stage 2
- Push notifications / reminders — Stage 2
- Percentage-based splits — Stage 2
- Recurring expenses — Stage 2
- Group chat / comments on expenses — Stage 2
- Expense categories or tags — Stage 2
- Data export — Stage 2
- Multi-currency support — Stage 2
- Search by phone number / contacts integration — Stage 2
- OAuth / email login — phone only
- Edit/delete expenses — keep data immutable for Stage 1
- Leaving groups — simplifies balance integrity for Stage 1
- Realtime subscriptions — pull-to-refresh is acceptable for Stage 1

## Context

- Solo developer project, optimizing for speed of iteration
- Developer has 5+ years React Native / Expo experience
- Target testers: close friend group (5-10 people) using the app for real scenarios (trips, shared meals, house bills)
- Distribution via Messenger / Viber invite links — these must work smoothly
- Philippine internet can be unreliable — optimistic offline UI with simple queue is needed
- Supabase RLS policies required from day one — users must only see their own groups/expenses

**Data Model (Supabase / PostgreSQL):**
- `users` — id, phone_number (unique), display_name, avatar_url, created_at
- `groups` — id, name, invite_code (unique), created_by, created_at
- `group_members` — id, group_id, user_id, joined_at; unique(group_id, user_id)
- `expenses` — id, group_id, description, amount (numeric, PHP), paid_by, split_type ("equal"/"custom"), created_by, created_at
- `expense_splits` — id, expense_id, user_id, amount (numeric, PHP); unique(expense_id, user_id)

**Key Screens:**
- Auth Screen — Phone input → OTP → Profile setup (first time)
- Home / Groups List — Groups the user belongs to, "Create Group" button
- Group Detail — Members, balance summary, expense list
- Add Expense — Form with split configuration (bottom sheet)
- Balances View — Simplified "who owes who" breakdown
- Invite Flow — Share invite link via system share sheet

**Design Direction:**
- Dark-first (near-black, not pure #000), soft green accent
- Inspired by Telegram, Raycast, Vercel dashboard
- Clean sans-serif typography (Inter / SF Pro / Plus Jakarta Sans)
- Geometric default avatars with initials
- Subtle borders/dividers, no heavy cards/shadows
- Monochromatic + one accent, generous spacing
- Micro-interactions via Reanimated / Moti
- Skeleton loaders, pull-to-refresh, haptic feedback
- Friendly/casual tone, Taglish where natural (e.g., "Walang utang!" for settled balances)

## Constraints

- **Tech Stack**: React Native + Expo (managed workflow), TypeScript, Expo Router, Supabase — non-negotiable
- **Auth**: Phone number OTP only via Supabase Auth — no email, no OAuth
- **Currency**: Philippine Peso (₱) only — no multi-currency
- **Distribution**: EAS Build + internal distribution / TestFlight — not app store
- **Data Integrity**: Expenses are immutable once created (Stage 1)
- **Amount Limit**: Max ₱999,999 per expense
- **Security**: Supabase RLS from day one

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phone OTP only (no email/OAuth) | Filipino users primarily use phone numbers; simplest auth for barkada distribution | — Pending |
| Expenses immutable in Stage 1 | Simplifies data integrity and balance calculations; edit/delete adds complexity | — Pending |
| No leaving groups in Stage 1 | Prevents balance inconsistencies when members leave with outstanding debts | — Pending |
| Optimistic offline with simple queue | PH internet can be unreliable; queue once, toast on failure — balanced complexity | — Pending |
| Dark-first with soft green accent | Modern fintech aesthetic; green is money-adjacent and calming | — Pending |
| Pull-to-refresh over Realtime | Acceptable UX for Stage 1; avoids Supabase Realtime complexity | — Pending |
| Debt simplification algorithm | Core differentiator — minimizes transactions needed between group members | — Pending |

---
*Last updated: 2026-02-18 after initialization*
