# Requirements: HatianApp

**Defined:** 2026-02-20
**Core Value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.

## v1.2 Requirements

Requirements for Home Screen Dashboard milestone.

### Balance Summary

- [ ] **BAL-01**: User sees their net balance across all groups prominently at the top of the home screen
- [ ] **BAL-02**: Balance is color-coded — green when owed money, red when owing, neutral when settled
- [ ] **BAL-03**: Balance header has visual weight — large typography, distinct from the rest of the page

### Activity Feed

- [ ] **ACT-01**: Home screen shows the 5 most recent expenses across all user's groups
- [ ] **ACT-02**: Home screen shows the 5 most recent settlements across all user's groups, merged chronologically with expenses
- [ ] **ACT-03**: Each activity item shows description/type, amount, who paid, and which group
- [ ] **ACT-04**: Tapping an activity item navigates to the relevant expense detail or group
- [ ] **ACT-05**: A "See all" option is available when there's more activity beyond the 5 shown

### Visual Design

- [ ] **VIS-01**: Home screen uses a sectioned dashboard layout: balance → activity → groups with clear visual separation
- [ ] **VIS-02**: Typography hierarchy with varied sizes and weights guides the eye through sections
- [ ] **VIS-03**: Accent/brand touches — colored balance area, subtle card treatments, warm empty states
- [ ] **VIS-04**: Group cards show richer info: last activity date, member avatar stack, per-group balance

### Quick Actions

- [ ] **QAC-01**: FAB navigates to add expense with group picker (already built)

## Future Requirements

Deferred to later milestones.

### Group Detail Polish

- **GRP-01**: Redesigned group detail screen with similar dashboard treatment
- **GRP-02**: Expense list with richer cards and filtering

### Other Screens

- **SCR-01**: Profile screen polish and settings
- **SCR-02**: Add expense wizard visual refresh

## Out of Scope

| Feature | Reason |
|---------|--------|
| Push notifications for activity | Notification infra not in scope yet |
| Real-time activity updates | Pull-to-refresh is acceptable |
| Activity feed pagination / infinite scroll | 5 items + "see all" is sufficient for v1.2 |
| Per-person balance breakdown on home | Keep it simple — one net number |
| Dark/light theme toggle | Dark-first only for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BAL-01 | — | Pending |
| BAL-02 | — | Pending |
| BAL-03 | — | Pending |
| ACT-01 | — | Pending |
| ACT-02 | — | Pending |
| ACT-03 | — | Pending |
| ACT-04 | — | Pending |
| ACT-05 | — | Pending |
| VIS-01 | — | Pending |
| VIS-02 | — | Pending |
| VIS-03 | — | Pending |
| VIS-04 | — | Pending |
| QAC-01 | — | Pending |

**Coverage:**
- v1.2 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after initial definition*
