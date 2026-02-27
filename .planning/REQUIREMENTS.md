# Requirements: v1.5 Partial Settlements

**Defined:** 2026-02-27
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1.5 Requirements

### Settlement UX

- [ ] **SETL-01**: Settle-up sheet displays an editable amount field with the NumPad component instead of a fixed amount display
- [ ] **SETL-02**: Amount field pre-filled with the full simplified balance between the two users
- [ ] **SETL-03**: Amount cannot exceed the current balance between the two users (UI-enforced cap)
- [ ] **SETL-04**: Minimum settlement amount is ₱0.01 (confirm button disabled when amount is zero or empty)
- [ ] **SETL-05**: After confirming a partial settlement, the group balances refresh and show the remaining debt
- [ ] **SETL-06**: Confirming without changing the pre-filled amount records a full settlement (backwards-compatible behavior)

## Future Requirements (v1.6+)

- Overpayment support (settle more than owed, flipping debt direction)
- Settlement notes/description field
- Settlement receipt or screenshot attachment

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side amount validation against balance | Race condition tolerance; UI enforces cap (consistent with existing decision) |
| Overpayment beyond current balance | Adds complexity with negative balance flips; cap at balance for simplicity |
| Settlement categories or labels | Not needed for core partial settlement flow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETL-01 | — | Pending |
| SETL-02 | — | Pending |
| SETL-03 | — | Pending |
| SETL-04 | — | Pending |
| SETL-05 | — | Pending |
| SETL-06 | — | Pending |

**Coverage:**
- v1.5 requirements: 6 total
- Mapped to phases: 0
- Unmapped: 6 ⚠️

---
*Requirements defined: 2026-02-27*
