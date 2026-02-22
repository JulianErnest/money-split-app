# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** v1.3 Apple Sign-In — Phase 13 (Database & Infrastructure Prep)

## Current Position

Phase: 13 of 15 (Database & Infrastructure Prep)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-22 — Completed 13-01-PLAN.md

Progress: [█░░░░░░░░░] ~17% (1/~6 v1.3 plans)

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

**v1.3 Milestone (in progress):**
- Plans completed: 1
- Total: ~12min

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

- Apple Sign-In replaces phone OTP (simpler auth UX; phone still collected for invites)
- Native signInWithIdToken approach (no OAuth browser redirect, no 6-month key rotation)
- Phone number collected unverified during profile setup (not at auth time)
- 3-phase sequential deployment: DB prep -> auth swap -> profile enhancement
- Single atomic migration for ALTER TABLE + trigger rewrite + new RPC (interdependent changes)
- NULLIF(new.phone, '') converts empty strings to NULL at database level
- UserProfile interface updated to accept nullable phone_number

### Known Issues

- Pre-existing TypeScript error in app/(tabs)/index.tsx (SectionList type mismatch from phase 08-02) -- cosmetic
- Pre-existing TypeScript error in app/_layout.tsx (segments tuple index) -- cosmetic

### Pending Todos

None.

### Blockers/Concerns

- Phase 14 MUST be tested on real iOS device (Apple Sign-In does not work on Simulator)
- Apple provides fullName only on first authorization -- must capture immediately or data is lost forever

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 13-01-PLAN.md
Resume file: None
