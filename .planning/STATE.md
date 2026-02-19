# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** Milestone v1.1 — Invites & Settle Up

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-19 — Milestone v1.1 started

## Performance Metrics

**Previous Milestone (v1.0):**
- Total plans completed: 22
- Average duration: 3.9min
- Total execution time: ~1.4 hours

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phone OTP only (no email/OAuth) — Filipino users primarily use phone numbers
- Expenses immutable — simplifies data integrity
- security definer function for RLS to avoid group_members recursion
- Inner BEGIN...EXCEPTION per loop iteration in auto-link trigger (never block signups)
- Invite inbox (not push notifications) for consent-based invites
- Creator-only phone invites for security
- Whole-balance settlement only for simplicity
- Decline removes associated expense splits

### Known Issues

- Phone format mismatch: Supabase Auth stores phone without `+` prefix, app sends with `+` — causes lookup failures in `add_pending_member`
- Multiple migration fixes (00010, 00011, 00014, 00015) attempted to fix phone lookup — bug persists in some cases
- Any group member can currently add anyone by phone — no permission check on creator

### Pending Todos

None yet.

### Roadmap Evolution

- v1.0: Phases 1-6 (plus 4.1 inserted) — core expense splitting loop
- v1.1: Starting — invites overhaul + settle up

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-19
Stopped at: Initializing milestone v1.1
Resume file: None
