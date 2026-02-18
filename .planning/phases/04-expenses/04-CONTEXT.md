# Phase 4: Expenses - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add shared expenses to a group with equal or custom splits, and browse expense history. Users can enter an expense amount, description, select who paid, choose split type, and pick which members are involved. Expense list displays in the group detail screen. Expenses are immutable in Stage 1.

</domain>

<decisions>
## Implementation Decisions

### Add expense flow
- Multi-step wizard: swipe between steps (amount & description → payer → split type & members)
- Swipe navigation between steps with dots indicator
- Large display + numpad for amount input (GCash/PayMaya style — big peso amount at top, tap digits below)
- Free text only for description (no categories in Stage 1)

### Split selection
- Live remaining counter for custom splits — shows "Remaining: ₱X" that updates in real-time, can't submit until ₱0
- Equal split: user selects/deselects members from the group

### Payer selection
- Default payer is the current user (pre-selected)
- Single payer only (no multi-payer support)
- Member list with radio buttons to select payer
- Payer is included in the split by default (payer splits too)

### Expense list display
- Rich cards in group detail screen
- Essential info per card: description, total amount, who paid, date
- Each card shows personal balance impact: "You owe ₱X" or "You paid"
- Tap to see full split breakdown — Claude's discretion on detail view approach

### Claude's Discretion
- Split type toggle UX (segmented control, tabs, or separate step)
- Default member selection for equal splits (all selected vs none)
- Custom split amount entry method (inline fields vs tap-to-edit)
- Expense detail view approach (bottom sheet, full screen, or expandable card)
- Exact wizard step count and transitions
- Loading and error states
- Exact spacing, typography, and card styling within design system

</decisions>

<specifics>
## Specific Ideas

- Amount input should feel like a payment app (GCash/PayMaya) — large centered amount with numpad below
- Expense amounts capped at ₱999,999 with clear validation feedback
- Currency is always Philippine Peso (₱)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-expenses*
*Context gathered: 2026-02-18*
