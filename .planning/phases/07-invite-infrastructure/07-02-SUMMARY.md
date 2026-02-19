---
phase: 07-invite-infrastructure
plan: 02
subsystem: database-schema
tags: [invite-status, consent-flow, pending-members, auto-link-trigger]
dependency-graph:
  requires: [07-01]
  provides: [invite_status column, user_id column on pending_members, consent-aware add_pending_member, consent-aware auto-link trigger]
  affects: [08-accept-decline-ui]
tech-stack:
  added: []
  patterns: [consent-based invites, pending invite with linked user_id]
key-files:
  created:
    - supabase/migrations/00019_invite_status_consent_flow.sql
  modified:
    - lib/group-members.ts
    - lib/database.types.ts
decisions:
  - id: INV-03-consent
    choice: "Phone-added users always become pending invites, never auto-added members"
    rationale: "Consent-based invite model requires explicit acceptance"
  - id: INV-03-autolink
    choice: "Auto-link trigger links identity (user_id) but does not auto-join groups"
    rationale: "Phase 8 invite inbox needs user_id to find pending invites; auto-join would bypass consent"
metrics:
  duration: 1.6min
  completed: 2026-02-19
---

# Phase 7 Plan 2: Invite Status and Consent-Aware Flow Summary

Consent-aware invite schema: add_pending_member always creates pending invites with invite_status column; auto-link trigger links user_id without auto-joining groups.

## Task Commits

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Create migration for invite schema and consent-aware RPCs | cb797ca | 00019 migration: invite_status + user_id columns, consent-aware add_pending_member and auto-link trigger |
| 2 | Update client member fetching to include invite status | 3bccdfc | GroupMember type + query include invite_status, database.types.ts updated |

## What Was Done

### Migration 00019: Invite Status and Consent Flow

**Part 1 - Schema changes:**
- Added `invite_status` column (text, not null, default 'pending', check constraint: pending/accepted/declined)
- Added `user_id` column (uuid, nullable FK to users) for Phase 8 inbox queries
- Created index `idx_pending_members_user_id` for inbox lookups

**Part 2 - add_pending_member behavioral change (INV-03):**
- Existing user found by phone: creates pending_members row with user_id linked, does NOT insert into group_members, does NOT transfer expense_splits
- Unknown user: creates pending_members row as before, user_id stays NULL (linked by trigger on signup)
- Both paths set invite_status = 'pending'
- Preserved: auth check, phone normalization, creator-only guard, duplicate checks

**Part 3 - Auto-link trigger (consent-aware):**
- On new signup: ensures public.users row exists, then updates pending_members.user_id
- Does NOT auto-join group_members
- Does NOT transfer expense_splits
- Does NOT delete pending_members

### Client-side Updates
- `GroupMember` interface: added `invite_status?: 'pending' | 'accepted' | 'declined'`
- Pending members query: added `invite_status` to select
- `database.types.ts`: added `invite_status` and `user_id` to pending_members types

## What Was NOT Changed

- `join_group_by_invite`: unchanged, still instant auto-join (INV-08)
- Group detail UI: no rendering changes (Phase 8 will add accept/decline buttons)
- Expense split logic: pending members still participate in splits as before

## Decisions Made

1. **Phone-added users always become pending invites** - Even if the user already has an account, they appear as a pending invite with their user_id linked, rather than being auto-added to group_members
2. **Auto-link trigger is identity-only** - Links user_id for inbox queries but does not auto-join or transfer splits

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Migration 00019 SQL is syntactically correct and follows established patterns
- [x] add_pending_member always creates pending_members rows (never group_members)
- [x] Auto-link trigger links user_id without auto-joining
- [x] join_group_by_invite NOT modified (INV-08)
- [x] Client fetches invite_status, types updated
- [x] App compiles without TypeScript errors (npx expo export --platform ios)
- [ ] supabase db reset not verified (Docker not running; SQL follows same patterns as verified 00018)

## Next Phase Readiness

Phase 8 (Accept/Decline UI) can now:
- Query `pending_members WHERE user_id = auth.uid()` for invite inbox
- Read `invite_status` to determine invite state
- Build accept (set invite_status = 'accepted', move to group_members) and decline (set invite_status = 'declined') flows

## Self-Check: PASSED
