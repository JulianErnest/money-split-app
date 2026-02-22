---
phase: 13-database-infrastructure-prep
plan: 01
subsystem: database
tags: [postgresql, supabase, migration, nullable, trigger, rpc, apple-sign-in]

# Dependency graph
requires:
  - phase: 08-invite-system
    provides: handle_pending_member_claim trigger, pending_members table, consent-aware flow
provides:
  - Nullable phone_number column for Apple Sign-In users
  - NULLIF-guarded auth trigger compatible with social providers
  - link_phone_to_pending_invites RPC for deferred invite linking
  - Regenerated TypeScript types with nullable phone_number
affects: [14-auth-implementation-swap, 15-profile-enhancement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NULLIF guard in triggers for social provider compatibility"
    - "Conditional phone-based logic in auth trigger"
    - "Deferred RPC for operations that cannot happen at auth time"

key-files:
  created:
    - supabase/migrations/00024_apple_auth_prep.sql
  modified:
    - lib/database.types.ts
    - app/(tabs)/profile.tsx

key-decisions:
  - "Single atomic migration for ALTER TABLE + trigger rewrite + new RPC (interdependent changes)"
  - "NULLIF(new.phone, '') converts empty strings to NULL at database level"
  - "UserProfile interface updated to accept nullable phone_number"

patterns-established:
  - "NULLIF guard: Use NULLIF(value, '') to convert empty strings to NULL for social provider compatibility"
  - "Conditional trigger logic: Wrap phone-dependent operations in IF NULLIF(...) IS NOT NULL for multi-provider auth"
  - "Deferred RPC: Create security-definer RPC when an operation cannot happen at auth time"

# Metrics
duration: 12min
completed: 2026-02-22
---

# Phase 13 Plan 01: Database Migration for Apple Sign-In Summary

**Nullable phone_number column, NULLIF-guarded auth trigger, and link_phone_to_pending_invites RPC in single atomic migration**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-22T13:12:13Z
- **Completed:** 2026-02-22T13:24:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Made users.phone_number nullable so Apple Sign-In users can exist without a phone number
- Rewrote handle_pending_member_claim trigger with NULLIF guard and conditional phone logic
- Created link_phone_to_pending_invites RPC for Phase 15 profile setup to link pending invites
- Regenerated TypeScript types reflecting all database changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00024_apple_auth_prep.sql** - `673e912` (feat)
2. **Task 2: Apply migration and regenerate TypeScript types** - `4eb629e` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `supabase/migrations/00024_apple_auth_prep.sql` - Atomic migration: DROP NOT NULL, trigger rewrite, new RPC
- `lib/database.types.ts` - Regenerated types with nullable phone_number and new RPC
- `app/(tabs)/profile.tsx` - Updated UserProfile interface for nullable phone_number

## Decisions Made
- Single migration file for all three changes (ALTER TABLE, trigger rewrite, RPC) since they are interdependent
- Used NULLIF(new.phone, '') instead of CASE WHEN for conciseness (established PostgreSQL pattern)
- Fixed UserProfile interface inline rather than deferring to Phase 15

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed UserProfile interface phone_number type mismatch**
- **Found during:** Task 2 (TypeScript type verification)
- **Issue:** UserProfile interface in profile.tsx had `phone_number: string` but database now returns `string | null`, causing TypeScript compilation error
- **Fix:** Changed `phone_number: string` to `phone_number: string | null` in UserProfile interface
- **Files modified:** app/(tabs)/profile.tsx
- **Verification:** `npx tsc --noEmit` passes with only pre-existing _layout.tsx error
- **Committed in:** 4eb629e (Task 2 commit)

**2. [Rule 3 - Blocking] Removed Supabase CLI diagnostic line from generated types**
- **Found during:** Task 2 (TypeScript type verification)
- **Issue:** `npx supabase gen types typescript --local` wrote "Connecting to db 5432" as first line of types file, causing TS1434 parse error
- **Fix:** Removed the diagnostic line from lib/database.types.ts
- **Files modified:** lib/database.types.ts
- **Verification:** `npx tsc --noEmit` compiles without new errors
- **Committed in:** 4eb629e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Docker was not running; started Docker Desktop and waited for daemon readiness before proceeding
- Supabase services were not started; ran `npx supabase start` which pulled fresh images (~3 minutes)
- Supabase CLI wrote diagnostic output to stdout during type generation, corrupting the types file

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database schema is ready for Apple Sign-In users (nullable phone_number)
- Auth trigger handles both phone OTP and social provider users
- link_phone_to_pending_invites RPC is available for Phase 15 profile setup
- Plan 02 (app.json + Supabase dashboard config) can proceed independently

## Self-Check: PASSED

---
*Phase: 13-database-infrastructure-prep*
*Completed: 2026-02-22*
