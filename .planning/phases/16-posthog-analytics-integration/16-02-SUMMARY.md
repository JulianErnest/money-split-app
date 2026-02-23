---
phase: 16-posthog-analytics-integration
plan: 02
subsystem: analytics
tags: [posthog, event-tracking, react-native, supabase-rpc]

# Dependency graph
requires:
  - phase: 16-01
    provides: "PostHog client, typed event helpers (trackSignIn, trackGroupCreated, etc.)"
  - phase: 02-auth
    provides: "Apple sign-in flow, profile setup screen"
  - phase: 03-groups
    provides: "Group creation, invite accept/decline, join via link flows"
  - phase: 04-expenses
    provides: "Add expense screen and create_expense RPC"
  - phase: 05-settlements
    provides: "SettleConfirmSheet and record_settlement RPC"
provides:
  - "All 9 core product events instrumented in PostHog"
  - "Full product loop tracking: sign in -> profile -> group -> expense -> settle -> invite"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Analytics event capture at RPC success boundary (after error guard, before UI cleanup)"

key-files:
  created: []
  modified:
    - "app/(auth)/sign-in.tsx"
    - "app/(auth)/profile-setup.tsx"
    - "app/(tabs)/index.tsx"
    - "app/group/[id].tsx"
    - "app/group/[id]/add-expense.tsx"
    - "app/join/[code].tsx"
    - "components/settlements/SettleConfirmSheet.tsx"

key-decisions:
  - "Events fire only after RPC success, never on error paths"
  - "trackInviteShared fires on Share.share() intent, not delivery (cannot detect if user completed native share)"

patterns-established:
  - "Analytics insertion point: after error guard return, before navigation/cleanup"
  - "Event properties use snake_case matching PostHog convention (group_id, split_type, member_count)"

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 16 Plan 02: Event Instrumentation Summary

**9 typed PostHog event calls wired into 7 screen files at RPC success boundaries covering the full product loop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T19:11:10Z
- **Completed:** 2026-02-23T19:14:55Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- sign_in event captured with method:'apple' after successful Apple sign-in
- profile_completed event captured with has_avatar boolean after profile save
- group_created event captured with group_id after create_group RPC
- expense_added event captured with group_id, amount, split_type, member_count after create_expense RPC
- settle_up event captured with group_id and amount after record_settlement RPC
- invite_accepted and invite_declined events captured with group_id after respective RPCs
- group_joined_via_link event captured with group_id after join_group_by_invite RPC
- invite_shared event captured with group_id after Share.share() call

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire sign_in and profile_completed in auth screens** - `2899501` (feat)
2. **Task 2: Wire group_created, invite_accepted, invite_declined in home screen** - `077304c` (feat)
3. **Task 3: Wire expense_added, settle_up, group_joined_via_link, invite_shared** - `4b1c171` (feat)

## Files Created/Modified
- `app/(auth)/sign-in.tsx` - Added trackSignIn('apple') after signInWithIdToken succeeds
- `app/(auth)/profile-setup.tsx` - Added trackProfileCompleted(hasAvatar) after refreshProfile
- `app/(tabs)/index.tsx` - Added trackGroupCreated, trackInviteAccepted, trackInviteDeclined at respective RPC success points
- `app/group/[id]/add-expense.tsx` - Added trackExpenseAdded with group_id/amount/split_type/member_count
- `components/settlements/SettleConfirmSheet.tsx` - Added trackSettleUp with group_id/amount
- `app/join/[code].tsx` - Added trackGroupJoinedViaLink with group_id
- `app/group/[id].tsx` - Added trackInviteShared with group_id after Share.share()

## Decisions Made
- Events fire only after RPC success, never on error paths -- consistent insertion point pattern
- trackInviteShared fires on Share.share() intent (after await), not delivery -- native share sheet does not reliably report completion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. PostHog API key was configured in Plan 01.

## Next Phase Readiness
- All 17 analytics requirements from v1.4 milestone are now complete (TRACK-01 through TRACK-04, EVENT-01 through EVENT-09, IDENT-01 through IDENT-04)
- Phase 16 is complete, ready for milestone completion

## Self-Check: PASSED

---
*Phase: 16-posthog-analytics-integration*
*Completed: 2026-02-24*
