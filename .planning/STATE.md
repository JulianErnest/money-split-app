# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** v1.2 Home Screen Dashboard — COMPLETE

## Current Position

Phase: 12 of 12 (Group Cards & Visual Polish)
Plan: 2 of 2 in current phase
Status: Milestone complete
Last activity: 2026-02-21 — Completed 12-02-PLAN.md

Progress: ██████████ 100% (5/5 plans across v1.2)

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
- 10-01: 7min
- 11-01: 2min
- 11-02: 5min
- 12-01: 2min
- 12-02: 5min
- Total: ~21min

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

- Balance display without +/- prefix, using color + descriptor text for direction
- useMemo for dashboardHeader (JSX element, not render function)
- RPC returns pesos as-is; UI layer handles peso-to-centavo conversion for activity feed
- Offset-based pagination (not cursor) for activity feed simplicity
- Dashboard sections reordered: groups before invites, invites only shown when pending
- Activity items use text-only type indicators (E/S in colored circles) for density
- Compact empty state on dashboard, full EmptyState on history screen
- CSS-only glassmorphism (5% white bg + 8% white border) instead of expo-blur
- RPC returns raw arrays; TypeScript layer zips into typed objects
- supabase.rpc cast via (as any) since database types not regenerated until migration applied
- Gradient balance header removed per user feedback (looked bad on device)
- Dashboard shows 3 recent activities (not 5) per user preference

### Known Issues

- supabase db reset not verified for 00019 (Docker not running; SQL follows same patterns as verified 00018)
- Pre-existing TypeScript error in app/(tabs)/index.tsx (SectionList type mismatch from phase 08-02) -- cosmetic, does not affect runtime
- Pre-existing TypeScript error in app/_layout.tsx (segments tuple index) -- cosmetic, does not affect runtime

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-21
Stopped at: v1.2 milestone complete — all 12 phases done
Resume file: None
