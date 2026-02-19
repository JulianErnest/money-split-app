# Phase 6: Polish & Distribution - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app feel production-ready with offline resilience, micro-interactions, Filipino-localized microcopy, and distribute a testable build to 5-10 friends via EAS internal distribution. No new features — this phase polishes what exists.

</domain>

<decisions>
## Implementation Decisions

### Offline behavior
- Queue both "add expense" and "create group" actions offline
- Show items optimistically (with pending state) plus a persistent "You're offline" banner at top of screen
- On reconnect sync failure: show error toast with a "Retry" action button; item stays in pending state until resolved
- No silent auto-retry — user controls retry
- Cached data (groups, expenses, balances) persists across app restarts via local storage
- App opens instantly with last-known data, refreshes in background

### Loading & transitions
- Shimmer skeleton loaders for all list screens (groups, expenses, members, balances)
- Custom animated pull-to-refresh (e.g., coin/peso drop animation fitting the app personality)
- Platform default screen transitions (iOS slide-from-right, Android fade) — no shared element transitions
- Background data updates use fade-in animation for new/changed items so user notices what changed

### Claude's Discretion
- Haptic feedback patterns (which actions, intensity)
- Bottom sheet vs modal decisions for confirmation flows
- Empty state illustrations and microcopy (Taglish tone, peso sign usage)
- Skeleton shape design matching existing card/list components
- Specific pull-to-refresh animation design
- Offline queue storage mechanism (expo-sqlite vs AsyncStorage vs MMKV)
- EAS build configuration and distribution setup
- Exact offline banner styling and positioning

</decisions>

<specifics>
## Specific Ideas

- Custom pull-to-refresh animation should fit the money/expense theme (peso coin drop suggested)
- Shimmer skeletons preferred over pulse — matches the modern fintech aesthetic established in Phase 1
- Persistent offline banner (not just a toast) so users always know their connectivity state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-polish-distribution*
*Context gathered: 2026-02-19*
