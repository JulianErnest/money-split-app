# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** Phase 4 (Expenses) complete -- all 3 plans delivered. Ready for Phase 5 (Balances).

## Current Position

Phase: 4 of 6 (Expenses)
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-02-18 -- Completed 04-03-PLAN.md

Progress: [██████████░░░░░] 67% (10/15 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 5.5min
- Total execution time: ~0.92 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2/2 | 13min | 6.5min |
| 02-authentication | 2/2 | 18min | 9min |
| 03-groups | 3/3 | 10min | 3.3min |
| 04-expenses | 3/3 | 15min | 5min |

**Recent Trend:**
- Last 5 plans: 03-02 (6min), 03-03 (2min), 04-01 (6min), 04-02 (6min), 04-03 (3min)
- Trend: stable at ~5min for feature plans

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phone OTP only (no email/OAuth) -- Filipino users primarily use phone numbers
- Expenses immutable in Stage 1 -- simplifies data integrity
- Dark-first with soft green accent -- modern fintech aesthetic
- expo-sqlite localStorage for Supabase session persistence (not AsyncStorage) -- 01-01
- (select auth.uid()) subquery pattern in all RLS policies -- 01-01
- Two-tier color tokens: palette primitives + semantic tokens -- 01-02
- BottomTabBarProps for custom TabBar (not expo-router/ui headless) -- 01-02
- useSegments-based routing guard in root layout -- 02-01
- isNewUser determined by display_name in users table -- 02-01
- Emoji-based avatars stored as unicode strings in avatar_url -- 02-02
- security definer function for RLS to avoid group_members recursion -- 02-02
- gen_random_uuid() instead of uuid_generate_v4() on Supabase hosted -- 02-02
- Cross-platform Modal for group name input (not Alert.prompt which is iOS-only) -- 03-01
- Type cast (as any) for future /group/[id] route navigation -- 03-01
- Batch member count query with client-side reduce (not N+1) -- 03-03
- ScrollView for member list (small lists, simpler than nested FlatList) -- 03-03
- Jest with ts-jest for test infrastructure (not vitest) -- 04-01
- useAmountInput hook with raw display string for numpad state -- 04-02
- All members selected by default for equal split -- 04-02
- Inline TextInput for custom split amounts (not custom numpad) -- 04-02
- useFocusEffect from @react-navigation/native for expense list refresh -- 04-03

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 04-03-PLAN.md (Phase 4 complete)
Resume file: None
