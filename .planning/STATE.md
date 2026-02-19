# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** A group of friends can add shared expenses and instantly see who owes who, with simplified balances that minimize the number of transactions needed.
**Current focus:** Phase 8 — Invite UX

## Current Position

Phase: 8 of 9 (Invite UX)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-02-19 — Completed Phase 7 (Invite Infrastructure)

Progress: [##################] 93% (24/28 plans across all milestones)

## Performance Metrics

**Previous Milestone (v1.0):**
- Total plans completed: 22
- Average duration: 3.9min
- Total execution time: ~1.4 hours

**Current Milestone (v1.1):**
- Total plans completed: 2
- Estimated plans: 6

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Invite inbox (not push notifications) for consent-based invites
- Creator-only phone invites for security
- Whole-balance settlement only for simplicity
- Decline removes associated expense splits
- Phone normalization uses ltrim(p_phone_number, '+') for all comparisons and storage
- Creator guard checks groups.created_by = current_user_id; client gates Add Member button
- Phone-added users always become pending invites, never auto-added members (INV-03)
- Auto-link trigger links identity (user_id) but does not auto-join groups

### Known Issues

- Phone format mismatch: RESOLVED in 07-01 (migration 00018 restores ltrim normalization)
- Any group member can add by phone: RESOLVED in 07-01 (creator guard added server + client)
- supabase db reset not verified for 00019 (Docker not running; SQL follows same patterns as verified 00018)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 07-02-PLAN.md (Phase 7 complete)
Resume file: None
