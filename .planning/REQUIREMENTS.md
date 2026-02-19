# Requirements: HatianApp (Filipino Splitwise)

**Defined:** 2026-02-18
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign in with phone number via OTP (Supabase Auth)
- [x] **AUTH-02**: First-time user completes profile setup (display name + optional avatar)
- [x] **AUTH-03**: User can sign out from the app

### Groups

- [x] **GRPS-01**: User can create a group with a name
- [x] **GRPS-02**: User can generate a shareable invite link for a group
- [x] **GRPS-03**: User can join a group via deep link (Expo deep linking)
- [x] **GRPS-04**: User can view list of groups they belong to
- [x] **GRPS-05**: User can view members of a group
- [x] **GRPS-06**: Groups display auto-generated avatars

### Expenses

- [x] **EXPN-01**: User can add an expense with description, amount (₱), who paid, and split type
- [x] **EXPN-02**: User can split an expense equally among selected members
- [x] **EXPN-03**: User can split an expense with custom amounts per member
- [x] **EXPN-04**: User can view a running list of expenses in a group, sorted by most recent

### Balances

- [x] **BLNC-01**: User can view simplified balances within a group (debt simplification algorithm)
- [x] **BLNC-02**: User can see a quick net balance summary per group
- [x] **BLNC-03**: User can tap a balance to see which expenses contribute to it

### UX & Polish

- [x] **UX-01**: App queues actions when offline and syncs when back online (toast on failure)
- [x] **UX-02**: Lists display skeleton loaders instead of spinners
- [x] **UX-03**: Key actions trigger haptic feedback
- [x] **UX-04**: Lists support pull-to-refresh with smooth animation
- [x] **UX-05**: Dark-first UI with soft green accent, modern design (Telegram/Raycast/Vercel inspired)
- [x] **UX-06**: Bottom sheet patterns for actions (add expense, invite)
- [x] **UX-07**: Friendly empty states with helpful microcopy
- [x] **UX-08**: Peso sign (₱) used throughout, casual/Taglish tone where natural

### Infrastructure

- [x] **INFR-01**: Supabase database with RLS policies — users only see their own groups/expenses
- [x] **INFR-02**: EAS Build configured for internal distribution (iOS TestFlight + Android)
- [x] **INFR-03**: Expense amounts capped at ₱999,999

## v2 Requirements

### Payments

- **PAY-01**: User can mark a balance as settled ("settle up")
- **PAY-02**: User can generate GCash payment link for a balance
- **PAY-03**: User can generate Maya payment link for a balance

### Notifications

- **NOTF-01**: User receives push notification when added to an expense
- **NOTF-02**: User receives reminder for outstanding balances

### Advanced Splits

- **SPLT-01**: User can split expenses by percentage
- **SPLT-02**: User can create recurring expenses

### Social

- **SOCL-01**: User can comment on expenses
- **SOCL-02**: User can search contacts by phone number to invite

### Content

- **CONT-01**: User can scan receipts to auto-fill expense details
- **CONT-02**: User can categorize/tag expenses
- **CONT-03**: User can export expense data

### Groups (v2)

- **GRPS-07**: User can leave a group (if balance is zero)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email / OAuth login | Phone-first for Filipino market; simplest auth for barkada distribution |
| Multi-currency | PHP only — all users are in the Philippines |
| Edit/delete expenses | Immutable data simplifies balance integrity for Stage 1 |
| Leaving groups | Prevents balance inconsistencies with outstanding debts |
| Realtime subscriptions | Pull-to-refresh acceptable for Stage 1; avoids complexity |
| Session persistence | Supabase handles token refresh automatically; not a separate feature |
| Group chat | High complexity, not core to expense splitting |
| Mobile app store release | Stage 1 is internal distribution only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| GRPS-01 | Phase 3 | Complete |
| GRPS-02 | Phase 3 | Complete |
| GRPS-03 | Phase 3 | Complete |
| GRPS-04 | Phase 3 | Complete |
| GRPS-05 | Phase 3 | Complete |
| GRPS-06 | Phase 3 | Complete |
| EXPN-01 | Phase 4 | Complete |
| EXPN-02 | Phase 4 | Complete |
| EXPN-03 | Phase 4 | Complete |
| EXPN-04 | Phase 4 | Complete |
| BLNC-01 | Phase 5 | Complete |
| BLNC-02 | Phase 5 | Complete |
| BLNC-03 | Phase 5 | Complete |
| UX-01 | Phase 6 | Complete |
| UX-02 | Phase 6 | Complete |
| UX-03 | Phase 6 | Complete |
| UX-04 | Phase 6 | Complete |
| UX-05 | Phase 1 | Complete |
| UX-06 | Phase 6 | Complete |
| UX-07 | Phase 6 | Complete |
| UX-08 | Phase 6 | Complete |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 6 | Complete |
| INFR-03 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
