---
phase: 03-groups
plan: 03
subsystem: groups-ui
tags: [member-list, group-detail, member-counts, avatar]
dependency-graph:
  requires: [03-01, 03-02]
  provides: [group-member-list, group-member-counts, polished-group-cards]
  affects: [04-expenses]
tech-stack:
  added: []
  patterns: [parallel-supabase-queries, batch-count-aggregation, relative-date-formatting]
key-files:
  created: []
  modified:
    - app/group/[id].tsx
    - app/(tabs)/index.tsx
decisions:
  - id: batch-member-count
    choice: "Single batch query for member counts instead of N+1"
    why: "Efficient -- one query fetches all group_members, client-side reduce counts per group"
  - id: scrollview-member-list
    choice: "ScrollView wrapping entire group detail instead of FlatList for members"
    why: "Member lists are small (typically <20), ScrollView simpler than nested FlatList"
metrics:
  duration: 2min
  completed: 2026-02-18
---

# Phase 03 Plan 03: Member List and Group Polish Summary

**One-liner:** Group detail shows full member list with avatars and creator badges; groups list displays member counts with batch-fetched data.

## What Was Done

### Task 1: Add member list to group detail screen
- Replaced placeholder "Members coming soon" with full member list
- Parallel fetch of group details and group_members (with joined users data)
- Each member row shows: emoji avatar (from `avatar_url`), display name, creator badge, relative joined date
- Section header displays "Members" with count badge
- Wrapped content in ScrollView for long member lists
- Handles null `display_name` with "Unknown" fallback
- `formatJoinedDate()` helper shows "Joined today", "Joined 3d ago", "Joined Jan 15" etc.

### Task 2: Enhance groups list with member counts and avatars
- Added batch member count query: fetches all `group_members` rows for user's groups in a single query
- Client-side `reduce()` aggregates counts per `group_id`
- Each group card now shows "{N} member(s)" with proper singular/plural
- Added chevron ">" indicator on right side for navigation affordance
- Avatar and layout were already correct from 03-01, verified and preserved

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add member list to group detail screen | 55847f7 | app/group/[id].tsx |
| 2 | Enhance groups list with member counts and avatars | 49393bf | app/(tabs)/index.tsx |

## Decisions Made

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Member count fetching | Batch query + client reduce | Avoids N+1; single query for all groups |
| Member list rendering | ScrollView (not FlatList) | Small lists (<20 members), simpler code |
| Joined date format | Relative time helper | More user-friendly than raw dates |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit --pretty` passes with zero errors
- Group detail screen renders member list with avatars, names, creator badges
- Groups list shows member counts and emoji avatars per card
- All screens follow dark-first design system with consistent theme tokens

## Next Phase Readiness

Phase 03 (Groups) is now complete. All three plans delivered:
- 03-01: Group RPC functions, groups list screen, create-group flow
- 03-02: Deep link handling, join flow, group detail with share button
- 03-03: Member list, member counts, polished group cards

Ready for Phase 04 (Expenses) -- group detail screen is the natural home for expense list.

## Self-Check: PASSED
