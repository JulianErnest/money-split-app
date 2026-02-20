# Requirements: HatianApp v1.1 — Invites & Settle Up

**Defined:** 2026-02-19
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1.1 Requirements

### Invite System

- [x] **INV-01**: Phone lookup correctly identifies existing users regardless of phone format (fix +/no-+ mismatch)
- [x] **INV-02**: Only the group creator can add members by phone number
- [x] **INV-03**: When a user is added by phone, they receive an invite (not auto-added to the group)
- [x] **INV-04**: User can see pending group invites on the home screen (invite inbox)
- [x] **INV-05**: User can accept a group invite and be added as a full member
- [x] **INV-06**: User can decline a group invite
- [x] **INV-07**: Declining an invite removes all associated expense splits for that pending member
- [x] **INV-08**: Invite link flow (share sheet → deep link) continues to auto-join without accept/decline

### Settle Up

- [x] **SETL-01**: User can mark the whole net balance as settled between themselves and another group member
- [x] **SETL-02**: Settlement is recorded with amount, payer, payee, and timestamp
- [x] **SETL-03**: User can view settlement history in a group (who paid who, when)
- [x] **SETL-04**: Settled amounts reduce the displayed balance between two people in balance views

## v2 Requirements

### Payments

- **PAY-01**: User can generate GCash payment link for a balance
- **PAY-02**: User can generate Maya payment link for a balance

### Notifications

- **NOTF-01**: User receives push notification when added to an expense
- **NOTF-02**: User receives push notification when invited to a group
- **NOTF-03**: User receives reminder for outstanding balances

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
| GCash / Maya integration | Requires payment API integration — Stage 3 |
| Push notifications | Needs notification infra (Expo Push, FCM) — Stage 3 |
| Partial settlements | "I'll pay you 300 of 500" adds complexity — whole balance only |
| Admin/role system | Creator-only permission is sufficient — no need for roles |
| Per-expense settlement | Settling individual splits is complex — whole balance approach is cleaner |
| Edit/delete expenses | Data immutability constraint continues |
| Leaving groups | Balance integrity constraint continues |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INV-01 | Phase 7 | Complete |
| INV-02 | Phase 7 | Complete |
| INV-03 | Phase 7 | Complete |
| INV-04 | Phase 8 | Complete |
| INV-05 | Phase 8 | Complete |
| INV-06 | Phase 8 | Complete |
| INV-07 | Phase 8 | Complete |
| INV-08 | Phase 7 | Complete |
| SETL-01 | Phase 9 | Complete |
| SETL-02 | Phase 9 | Complete |
| SETL-03 | Phase 9 | Complete |
| SETL-04 | Phase 9 | Complete |

**Coverage:**
- v1.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation*
