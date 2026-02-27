# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** v1.5 Partial Settlements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-27 — Milestone v1.5 started

## Performance Metrics

**v1.0 Milestone:**
- Total plans completed: 22
- Average duration: 3.9min
- Total execution time: ~1.4 hours

**v1.1 Milestone:**
- Total plans completed: 6
- Timeline: 2 days (Feb 19-20)

**v1.2 Milestone:**
- Plans completed: 5
- Total: ~21min

**v1.3 Milestone (complete):**
- Plans completed: 6
- Total: ~32min

**v1.4 Milestone (complete):**
- Plans completed: 2
- Total: ~6min

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent for v1.4:
- Single phase for all 17 analytics requirements (small scope, high interdependence, ~200 LOC)
- Autocapture disabled (crashes with Expo Router -- known PostHog issue #2740)
- Manual screen tracking via usePathname() hook
- Standalone PostHog client instance pattern (allows non-React access)
- Events fire only after RPC success, never on error paths
- trackInviteShared fires on intent (Share.share()), not delivery

### Known Issues

None.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: Starting milestone v1.5 Partial Settlements — defining requirements
Resume file: None
