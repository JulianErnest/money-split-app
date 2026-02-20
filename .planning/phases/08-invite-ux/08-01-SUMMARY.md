---
phase: 08-invite-ux
plan: 01
subsystem: database
tags: [supabase, rpc, rls, plpgsql, invite, security-definer]

# Dependency graph
requires:
  - phase: 07-invite-infrastructure
    provides: "pending_members.user_id column, invite_status column, consent-aware add_pending_member RPC"
provides:
  - "get_my_pending_invites RPC for invite inbox queries"
  - "accept_invite RPC for atomic group join + split transfer"
  - "decline_invite RPC for hard-delete invite rejection"
  - "RLS policy for invited users to SELECT own pending_members rows"
affects: [08-02 invite UI, future notification features]

# Tech tracking
tech-stack:
  added: []
  patterns: ["security definer RPCs with auth.uid() ownership validation", "hard delete for re-invite support"]

key-files:
  created:
    - supabase/migrations/00020_invite_accept_decline.sql
  modified:
    - lib/database.types.ts

key-decisions:
  - "Hard delete on decline (not soft delete) to allow re-invite by creator"
  - "Security definer RPC for inbox query to bypass groups table RLS"

patterns-established:
  - "Invite ownership validation: fetch row, check user_id = auth.uid(), check invite_status = pending"
  - "Idempotent group join via ON CONFLICT DO NOTHING (handles invite link + phone invite race)"

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 8 Plan 1: Invite Accept/Decline RPCs Summary

**Three security definer RPCs (get_my_pending_invites, accept_invite, decline_invite) with RLS policy for invite inbox SELECT on pending_members**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T06:45:30Z
- **Completed:** 2026-02-20T06:48:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created migration 00020 with three security definer RPCs and one RLS policy
- accept_invite atomically adds user to group, transfers expense splits, and deletes pending row
- decline_invite hard-deletes expense splits and pending_members row for re-invite support
- get_my_pending_invites returns denormalized invite data (group name, inviter name) bypassing groups RLS
- Updated database.types.ts with matching TypeScript function signatures
- App compiles cleanly with all new types

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00020 with invite RPCs and RLS policy** - `a7a20d4` (feat)
2. **Task 2: Add new RPC type signatures to database.types.ts** - `c2e4b9e` (feat)

## Files Created/Modified
- `supabase/migrations/00020_invite_accept_decline.sql` - Three RPCs and one RLS policy for invite accept/decline flows
- `lib/database.types.ts` - Added accept_invite, decline_invite, get_my_pending_invites function type signatures

## Decisions Made
- Hard delete on decline (not soft delete) to allow group creator to re-invite the same phone number later without duplicate check blocking
- Security definer RPC for inbox query rather than additional RLS policies on groups table, matching existing codebase pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three RPCs ready for Plan 08-02 (invite UI) to consume
- RLS policy enables direct pending_members queries as fallback
- TypeScript types in place for type-safe RPC calls from React Native

## Self-Check: PASSED

---
*Phase: 08-invite-ux*
*Completed: 2026-02-20*
