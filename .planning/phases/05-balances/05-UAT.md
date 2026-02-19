---
status: complete
phase: 05-balances
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-02-18T09:50:00Z
updated: 2026-02-19T10:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Balances section in group detail
expected: Open a group that has expenses. Between the members list and expenses list, a "Balances" section shows simplified settlements (e.g., "Bob owes Alice P150") with debtor/creditor avatars and formatted peso amounts.
result: pass

### 2. Empty group shows "All settled up"
expected: Open a group with no expenses. The Balances section should show "All settled up" in gray/secondary text instead of any settlement rows.
result: pass

### 3. Pending members appear in balances
expected: In a group with a pending member (added by phone, hasn't signed up), if that pending member has expense splits, they should appear in the balances section with the # avatar and their phone number.
result: pass

### 4. Balances refresh after adding expense
expected: View a group's balances, then add a new expense. When you navigate back to the group detail, the balances section should update to reflect the new expense without manual refresh.
result: pass

### 5. Per-group balance summary on groups list
expected: On the home screen groups list, each group card shows your net balance: "You owe P350" in red if you owe money, or "You are owed P200" in green if others owe you. Groups with no expenses show no balance text.
result: pass

### 6. Balance drill-down shows contributing expenses
expected: Tap a settlement in the group detail balances section. A drill-down screen opens showing the header (e.g., "You owe Alice P150") and a list of contributing expenses, each with description, date, total amount, and your share from that expense.
result: pass

### 7. Back navigation from drill-down
expected: From the balance drill-down screen, pressing back returns you to the group detail screen with balances still visible.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
