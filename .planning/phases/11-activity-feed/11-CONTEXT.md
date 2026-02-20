# Phase 11: Activity Feed - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Display recent activities (expenses and settlements) across all groups on the home screen dashboard. User can see what happened recently without navigating into each group. 5 most recent items on dashboard, with a "See all" screen for full history. Tapping items navigates to detail.

</domain>

<decisions>
## Implementation Decisions

### Activity item design
- Claude's discretion: icon/color differentiation between expenses vs settlements
- Claude's discretion: info hierarchy (description, amount, payer, group ordering)
- Claude's discretion: whether to include payer avatars or keep text-only
- Claude's discretion: navigation target on tap (expense detail vs group)

### Section presentation
- Claude's discretion: dashboard section ordering (balance, activity, invites, groups) — user noted that pending invites currently push groups lower; optimize the ordering
- Relative timestamps ("2h ago", "Yesterday") — not absolute dates
- Flat chronological list on dashboard — no day headers for the 5-item preview
- Claude's discretion: section header style ("Recent Activity" + "See all" placement)

### Empty & edge states
- Claude's discretion: empty state approach when no activity exists
- Claude's discretion: what counts as "activity" (user's own actions vs all group activity)
- Skeleton row loading — shimmer placeholders while data loads, matching existing app patterns
- Time-limited: only show items from the last 30 days; if nothing recent, show empty state

### "See all" experience
- Separate screen — dedicated Activity History screen with back navigation
- No filtering — just a chronological list, no group or type filters
- Infinite scroll for loading more items
- Day headers on the full history screen ("Today", "Yesterday", "Feb 20") — helps scan longer lists

### Claude's Discretion
- Activity item visual design (icons, colors, avatars, info hierarchy)
- Dashboard section ordering optimization
- Section header design
- Empty state design
- What qualifies as "activity" (scope of items shown)
- Navigation target on item tap

</decisions>

<specifics>
## Specific Ideas

- User wants groups to feel more prominent on the dashboard — pending invites currently push the groups section lower even when there are no pending invites. Consider optimizing section ordering or compressing invites.
- Dashboard preview is flat list (5 items, no day headers), but full history screen uses day headers — intentionally different density levels.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-activity-feed*
*Context gathered: 2026-02-21*
