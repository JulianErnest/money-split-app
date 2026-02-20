# Phase 8: Invite UX - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users who have been invited to a group by phone can see, accept, or decline those invites from within the app. The invite infrastructure (schema, RPCs, auto-link trigger) was built in Phase 7. This phase adds the user-facing experience only.

</domain>

<decisions>
## Implementation Decisions

### Accept flow
- Single tap accept — no confirmation dialog, no friction
- After accepting, navigate directly to the group detail screen
- Show a brief success toast ("You joined [Group Name]!") as the group opens
- All existing expense splits from when they were a pending member are visible immediately — no special onboarding or welcome screen

### Decline flow & warning
- Show a warning before declining — user must confirm the action
- Warning tone is straightforward English (e.g., "Declining will remove you from all expense splits in this group.")
- After confirming decline, the invite disappears silently — no additional toast
- Decline deletes all expense splits tied to the pending member record so balances recalculate

### Invite placement & display
- Dedicated "Pending Invites" section at the top of the home screen groups list
- Section is always visible — shows empty state message when no invites pending
- Each invite card shows: group name + who invited them (e.g., "Friday Dinners — invited by Juan")
- Accept and decline buttons on each invite card

### Claude's Discretion
- Re-invite policy after decline (whether creator can re-send to same phone number)
- Invite card layout direction (horizontal scroll vs vertical stack) for multiple invites
- Empty state copy when no invites are pending
- Loading states and error handling for accept/decline actions

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-invite-ux*
*Context gathered: 2026-02-20*
