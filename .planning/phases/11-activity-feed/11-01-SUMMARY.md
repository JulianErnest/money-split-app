---
phase: 11-activity-feed
plan: 01
subsystem: database
tags: [supabase, rpc, postgres, union, activity-feed, typescript, timestamps]

# Dependency graph
requires:
  - phase: 09-settlements
    provides: settlements table and RPCs (00021 migration)
provides:
  - get_recent_activity RPC merging expenses and settlements chronologically
  - ActivityItem TypeScript type matching RPC return shape
  - fetchRecentActivity function with limit/offset pagination
  - formatRelativeTime and getDayLabel timestamp utilities
affects: [11-02 (dashboard activity section and history screen UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UNION ALL RPC for cross-table chronological feed"
    - "Relative timestamp formatting without external dependencies"
    - "Calendar-day-based grouping labels (Today/Yesterday/date)"

key-files:
  created:
    - supabase/migrations/00022_activity_feed_rpc.sql
    - lib/activity.ts
  modified:
    - lib/database.types.ts

key-decisions:
  - "RPC returns pesos as-is; UI layer handles peso-to-centavo conversion"
  - "Offset-based pagination (not cursor) for simplicity; acceptable given read-only feed"

patterns-established:
  - "UNION ALL RPC pattern: merge multiple tables into unified feed with denormalized names"
  - "Timestamp utility pattern: formatRelativeTime for compact display, getDayLabel for section headers"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 11 Plan 01: Activity Feed Data Layer Summary

**Supabase RPC merging expenses and settlements via UNION ALL with TypeScript fetch functions and relative timestamp formatters**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T17:51:09Z
- **Completed:** 2026-02-20T17:52:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `get_recent_activity` RPC that UNIONs expenses and settlements with denormalized group and payer names, 30-day default filter, and offset pagination
- `ActivityItem` TypeScript interface matching the RPC return shape with all required fields
- `fetchRecentActivity` function calling the RPC with configurable limit/offset
- `formatRelativeTime` utility producing "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", "Feb 20" strings
- `getDayLabel` utility producing "Today", "Yesterday", or "Feb 20" calendar-day labels for section headers
- Database types updated with `get_recent_activity` function signature

## Task Commits

Each task was committed atomically:

1. **Task 1: Create get_recent_activity RPC migration** - `c1dada4` (feat)
2. **Task 2: Create activity lib module and update database types** - `32bed46` (feat)

## Files Created/Modified
- `supabase/migrations/00022_activity_feed_rpc.sql` - PostgreSQL function merging expenses and settlements via UNION ALL with group/payer name JOINs
- `lib/activity.ts` - ActivityItem type, fetchRecentActivity, formatRelativeTime, getDayLabel exports
- `lib/database.types.ts` - Added get_recent_activity to Functions section

## Decisions Made
- RPC returns amounts in pesos (matching DB storage); the UI layer converts to centavos for `formatPeso()` -- consistent with existing expense display patterns
- Used offset-based pagination rather than cursor-based -- simpler implementation, acceptable for a read-only historical feed that rarely changes mid-scroll

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Activity data layer complete: RPC, types, fetch function, and formatting utilities all ready
- Plan 02 can build the dashboard activity section and history screen using `fetchRecentActivity`, `formatRelativeTime`, and `getDayLabel` directly
- No blockers or concerns

## Self-Check: PASSED

---
*Phase: 11-activity-feed*
*Completed: 2026-02-21*
