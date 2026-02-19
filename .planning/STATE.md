# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** Phase 6 (Polish & Distribution) in progress.

## Current Position

Phase: 6 of 6 (Polish & Distribution)
Plan: 5 of 5 in current phase
Status: Phase complete
Last activity: 2026-02-19 -- Completed 06-03-PLAN.md

Progress: [█████████████████████] 100% (21/21 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: 4.0min
- Total execution time: ~1.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2/2 | 13min | 6.5min |
| 02-authentication | 2/2 | 18min | 9min |
| 03-groups | 3/3 | 10min | 3.3min |
| 04-expenses | 3/3 | 15min | 5min |
| 04.1-pending-members | 3/3 | 7min | 2.3min |
| 05-balances | 3/3 | 7min | 2.3min |
| 06-polish-distribution | 5/5 | 17min | 3.4min |

**Recent Trend:**
- Last 5 plans: 06-01 (4min), 06-02 (5min), 06-04 (0min), 06-05 (4min), 06-03 (4min)
- Trend: stable execution

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
- Inner BEGIN...EXCEPTION per loop iteration in auto-link trigger (never block signups) -- 04.1-01
- Trigger creates public.users row before group_members insert (FK dependency) -- 04.1-01
- Hash symbol (#) as pending member avatar placeholder -- 04.1-02
- Conditional split payload: pending_member_id vs user_id in expense splits -- 04.1-03
- Greedy two-pointer algorithm for debt simplification (O(n log n), optimal for small groups) -- 05-01
- Left join paid on owed in balance RPC (pending members cannot be payers) -- 05-02
- Separate balance member flags Map for accurate pending detection from RPC data -- 05-02
- Balance fetch on groups list uses useFocusEffect separately from groups fetch -- 05-03
- Settlement drill-down only navigates when current user is involved -- 05-03
- Treat netinfo isConnected null as online (avoid false offline flash on startup) -- 06-01
- Shared SQLite DB (hatian_offline.db) for offline queue and cached data -- 06-01
- Cache group detail as serializable object with Map converted to tuple arrays -- 06-02
- Show back button during skeleton loading state for navigation continuity -- 06-02
- MotiView fade-in animation on data refresh but not initial load -- 06-02
- Single flush on reconnect, no silent auto-retry, user controls retry via toast Retry button -- 06-05
- Optimistic pending rows with opacity 0.6 and warning-color "Pending sync..." label -- 06-05
- syncCompleteListeners Set for decoupled cross-component sync notifications -- 06-05
- forwardRef pattern for AppBottomSheet and AddMemberSheet (parent controls open/close via ref) -- 06-03
- Unicode escape \u20B1 for peso sign in JSX for reliable cross-platform rendering -- 06-03

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 4.1 inserted after Phase 4: Pre-register group members by phone number (URGENT) -- users need to split expenses with friends who haven't installed the app yet

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 06-03-PLAN.md (all phases complete)
Resume file: None
