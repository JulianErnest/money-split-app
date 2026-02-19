---
phase: 06-polish-distribution
plan: 04
subsystem: distribution
tags: [eas, build, distribution, testflight, expo, ios, android]

# Dependency graph
requires:
  - phase: 06-01
    provides: offline infrastructure and project config baseline
provides:
  - eas.json with development, preview, and production build profiles
  - preview profile configured for internal distribution (TestFlight iOS, direct APK Android)
  - app.json updated with iOS bundleIdentifier and Android package
affects: [future-deployment, app-store-submission]

# Tech tracking
tech-stack:
  added: [eas-cli]
  patterns: ["EAS internal distribution for pre-release builds via preview profile"]

key-files:
  created: [eas.json]
  modified: [app.json]

key-decisions:
  - "EAS internal distribution for preview profile (TestFlight iOS + direct APK Android)"
  - "appVersionSource: remote to manage version in EAS dashboard, not code"
  - "submit.production fields left empty as placeholders for Apple credentials at submission time"

patterns-established:
  - "EAS profile naming: development (simulator/device with dev client), preview (internal distribution), production (store)"

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 06 Plan 04: EAS Build Configuration Summary

**EAS Build configured for internal distribution with preview profile enabling TestFlight (iOS) and direct APK install (Android) via eas.json and bundled platform identifiers in app.json**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-19
- **Completed:** 2026-02-19
- **Tasks:** 2 (1 auto + 1 checkpoint approved)
- **Files modified:** 2

## Accomplishments

- Created `eas.json` with three build profiles: development (dev client, internal), preview (internal distribution, no simulator), and production (store submission)
- Updated `app.json` with `bundleIdentifier: com.hatian.app` for iOS and `package: com.hatian.app` for Android
- EAS CLI (`eas-cli`) installed globally and available for build triggers
- User verified and approved build configuration at checkpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure EAS Build for internal distribution** - `da0edd5` (feat)
2. **Task 2: Verify EAS build readiness** - checkpoint approved (no code changes)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `eas.json` - EAS Build configuration with development, preview, and production profiles; preview uses `"distribution": "internal"` for TestFlight and direct APK
- `app.json` - Added `ios.bundleIdentifier: "com.hatian.app"` and `android.package: "com.hatian.app"` required by EAS for platform builds

## Decisions Made

- **EAS internal distribution for preview profile:** Standard Expo approach for distributing pre-release builds to 5-10 testers without going through App Store review. iOS uses TestFlight, Android uses direct APK/AAB download link.
- **appVersionSource: remote:** Version managed in EAS dashboard rather than in code, allowing build-time version bumps without code changes.
- **Empty submit.production placeholders:** Apple Developer credentials (`appleId`, `ascAppId`, `appleTeamId`) are intentionally blank; user fills these in at store submission time to avoid storing credentials in the repo.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

External services require manual configuration before triggering builds:

- **EAS authentication:** Run `eas login` with Expo account
- **iOS builds (TestFlight):** Requires active Apple Developer Program membership. EAS will prompt for Apple credentials during first iOS build.
- **Android builds:** No additional credentials needed for internal distribution (EAS manages signing keys).
- **Trigger a preview build:** `eas build --platform android --profile preview --no-wait` (Android, no credentials needed) or `eas build --platform ios --profile preview --no-wait` (iOS, prompts for Apple credentials).

## Next Phase Readiness

- EAS build configuration is complete and approved. Builds can be triggered from CLI at any time.
- iOS TestFlight distribution requires Apple Developer membership to be active at build time.
- `submit.production` fields in `eas.json` need Apple credentials filled in before App Store submission (out of scope for this phase).
- Ready to proceed with remaining Phase 06 plans (polish, UAT).

---
*Phase: 06-polish-distribution*
*Completed: 2026-02-19*
