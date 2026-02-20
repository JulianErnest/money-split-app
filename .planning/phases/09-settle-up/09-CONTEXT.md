# Phase 9: Settle Up - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can record that a debt between two people has been settled (whole-balance only), and the app reflects this in all balance views. Includes settlement history within a group. Partial settlements, scheduled payments, and external payment integrations are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Settle up trigger & flow
- Only own debts — user can only settle balances where they are the payer or receiver
- Confirmation via bottom sheet — slide-up sheet showing the amount, payer, and receiver with a confirm button
- Amount is non-editable (whole-balance settlement) — displayed as a fixed amount, user just confirms
- No explanation text about the constraint — the fixed amount speaks for itself

### Post-settlement feedback
- Success toast + stay on current screen — show "Settled!" toast and remain with updated balances visible
- Zero-balance rows disappear — once a balance hits zero, the row is removed entirely from the balance section
- Success haptic feedback on confirm — satisfying haptic buzz consistent with other confirm actions in the app

### Settlement history
- Claude's discretion on placement — whether settlements appear mixed with expenses or in a separate section
- Claude's discretion on entry detail level — payer, receiver, amount, date at minimum; additional context if useful
- Claude's discretion on tap behavior — whether entries have a detail view or the list is sufficient
- Claude's discretion on undo/delete — whether settlements can be reversed if recorded by mistake

### Balance view integration
- Immediate server refresh after settling — refetch balances from server right after settle confirmation
- Existing balance display already distinguishes owe vs owed — just add the settle action to existing rows
- Settled members (zero balance) disappear from balance section — they remain group members but vanish from balances
- Claude's discretion on home screen balance update timing

### Claude's Discretion
- Settle trigger placement (balance row tap vs detail screen vs button)
- Settlement history location and detail level
- Settlement entry tap behavior (detail view vs list-only)
- Undo/delete capability for mistaken settlements
- All-settled empty state treatment for the balance section
- Home screen balance summary refresh timing after settling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: whole-balance settlement only (decided at project level).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-settle-up*
*Context gathered: 2026-02-20*
