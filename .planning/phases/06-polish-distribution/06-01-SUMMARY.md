---
phase: 06-polish-distribution
plan: 01
subsystem: infrastructure
tags: [offline, network, sqlite, providers, bottom-sheet]
dependency-graph:
  requires: [01-01, 01-02]
  provides: [NetworkProvider, offline-queue, cached-data, OfflineBanner, provider-wiring]
  affects: [06-02, 06-03, 06-04, 06-05]
tech-stack:
  added: ["@gorhom/bottom-sheet", "moti", "expo-linear-gradient", "@react-native-community/netinfo"]
  patterns: [context-provider, sqlite-persistence, offline-first]
key-files:
  created:
    - lib/network-context.tsx
    - lib/offline-queue.ts
    - lib/cached-data.ts
    - components/ui/OfflineBanner.tsx
  modified:
    - app/_layout.tsx
    - package.json
decisions:
  - Treat netinfo isConnected === null as online to avoid false positives on app start
  - Share single SQLite database (hatian_offline.db) between offline queue and cached data
metrics:
  duration: 4min
  completed: 2026-02-19
---

# Phase 6 Plan 1: Offline Infrastructure Summary

**One-liner:** Network detection via netinfo, SQLite-backed offline queue and cache, animated offline banner, root layout wired with GestureHandlerRootView + BottomSheetModalProvider

## What Was Done

### Task 1: Install dependencies and create network/offline infrastructure
- Installed 4 new dependencies: @gorhom/bottom-sheet, moti, expo-linear-gradient, @react-native-community/netinfo
- Created `lib/network-context.tsx` with NetworkProvider that exposes `isOnline` boolean via useNetInfo hook
- Created `lib/offline-queue.ts` with SQLite-backed queue: enqueue, getAll, remove, updateStatus, clearAll
- Created `lib/cached-data.ts` with SQLite-backed key-value cache: setCachedData, getCachedData, clearUserCache
- Created `components/ui/OfflineBanner.tsx` with Reanimated slide animation, yellow warning banner

### Task 2: Wire providers into root layout
- Wrapped app in GestureHandlerRootView (outermost, required by bottom-sheet)
- Added NetworkProvider inside AuthProvider
- Added BottomSheetModalProvider inside NetworkProvider
- Placed OfflineBanner as sibling of RootNavigator inside all providers

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install dependencies and create network/offline infrastructure | 3837b63 | lib/network-context.tsx, lib/offline-queue.ts, lib/cached-data.ts, components/ui/OfflineBanner.tsx |
| 2 | Wire providers into root layout | 363d7d1 | app/_layout.tsx |

## Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Treat null isConnected as online | Avoid false "offline" flash on app startup when netinfo hasn't resolved yet | Default to offline (too conservative, bad UX) |
| Shared SQLite DB for queue and cache | Single DB file, simpler management, both are offline infrastructure | Separate DBs (unnecessary complexity) |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**For 06-02 (Bottom Sheet Settings):** BottomSheetModalProvider is wired and ready. GestureHandlerRootView is in place.
**For 06-03 (Offline Queue Wiring):** offline-queue.ts and cached-data.ts are ready for integration with expense/group creation flows.
**For 06-04/05:** NetworkProvider context available app-wide for conditional behavior.

## Self-Check: PASSED
