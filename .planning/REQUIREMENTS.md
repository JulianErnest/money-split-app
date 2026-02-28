# Requirements: v1.5 Partial Settlements

**Defined:** 2026-02-27
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1.5 Requirements

### Settlement UX

- [x] **SETL-01**: Settle-up sheet displays an editable amount field with the NumPad component instead of a fixed amount display
- [x] **SETL-02**: Amount field pre-filled with the full simplified balance between the two users
- [x] **SETL-03**: Amount cannot exceed the current balance between the two users (UI-enforced cap)
- [x] **SETL-04**: Minimum settlement amount is ₱0.01 (confirm button disabled when amount is zero or empty)
- [x] **SETL-05**: After confirming a partial settlement, the group balances refresh and show the remaining debt
- [x] **SETL-06**: Confirming without changing the pre-filled amount records a full settlement (backwards-compatible behavior)

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
| SETL-01 | Phase 17 | Complete |
| SETL-02 | Phase 17 | Complete |
| SETL-03 | Phase 17 | Complete |
| SETL-04 | Phase 17 | Complete |
| SETL-05 | Phase 17 | Complete |
| SETL-06 | Phase 17 | Complete |

**Coverage:**
- v1.5 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
