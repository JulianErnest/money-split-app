# Phase 17: Partial Settlement Amount Entry - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Modify the existing SettleConfirmSheet to accept user-entered settlement amounts instead of always settling the full balance. Users can pay any amount from minimum up to the full balance. Purely UI work — no backend/database changes. The NumPad component and useAmountInput hook already exist. The record_settlement RPC already accepts any positive amount.

</domain>

<decisions>
## Implementation Decisions

### Amount entry interaction
- Full balance amount pre-filled when sheet opens
- User taps the amount to activate NumPad (not immediately editable)
- Tapping clears the amount to ₱0.00 — user types desired amount from scratch
- "Full amount" button available to quickly reset back to the full balance
- Full balance visible somewhere while editing (Claude's discretion on placement — e.g., subtitle or inside the reset button)

### Validation feedback
- Disabled confirm button only — no inline error messages
- Minimum settlement amount: ₱1.00
- If remaining balance after payment would be less than ₱1.00, force a full settlement (no dust balances)
- NumPad prevents typing digits that would exceed the balance — additional digits ignored at the cap

### Partial vs full visual distinction
- Confirm button shows dynamic text: "Settle ₱X.XX" with the exact amount
- Whether to differentiate full settle text (e.g., "Settle ₱1,250.00 (Full)") — Claude's discretion
- Whether to show "Partial payment" label or remaining balance preview — Claude's discretion
- Sheet title/header behavior when editing — Claude's discretion

### Post-settlement confirmation
- Success toast + sheet closes, balance view refreshes automatically
- Toast messages differentiate: partial = "Settled ₱750.00 to Juan" / full = "Fully settled with Juan"
- No highlight animation on updated balance row — just update the number
- Activity feed entries for partial settlements show "(partial)" label to distinguish from full settlements

### Claude's Discretion
- Full balance display placement while editing (subtitle vs button label)
- Whether confirm button differentiates full settle visually
- Whether to show "Partial payment" label or remaining balance preview on the sheet
- Sheet title/header changes during editing
- Loading and error state handling
- Exact NumPad integration approach with useAmountInput hook

</decisions>

<specifics>
## Specific Ideas

- Clear-and-retype model (not cursor-based editing) keeps it simple — matches how mobile payment apps work
- "Full amount" quick-reset button prevents frustration if user changes their mind
- Preventing over-typing (rather than allowing then disabling) feels more polished — user never sees an invalid state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-partial-settlement-amount-entry*
*Context gathered: 2026-02-27*
