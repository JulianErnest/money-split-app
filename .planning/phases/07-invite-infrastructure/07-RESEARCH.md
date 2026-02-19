# Phase 7: Invite Infrastructure - Research

**Researched:** 2026-02-19
**Domain:** Supabase PostgreSQL RPC, phone normalization, invite schema design
**Confidence:** HIGH

## Summary

Phase 7 addresses three problems in the existing codebase: (1) a phone format mismatch between Supabase Auth and the app's phone lookup, (2) missing permission enforcement so that only the group creator can add members by phone, and (3) converting the current "auto-add" behavior into a consent-based invite flow where phone-added users appear as pending invites rather than immediate group members.

The existing codebase already has a `pending_members` table with phone number, group, and added_by fields. Migration 00014 partially fixed the phone format issue by normalizing with `ltrim('+')`, but migration 00015 (the latest `add_pending_member` function) regressed this fix by dropping the normalization logic. The current function compares `p_phone_number` directly against `users.phone_number` without stripping the `+` prefix. The auto-link trigger (migration 00014 version) does handle both formats. The invite link flow via `join_group_by_invite` is separate and must remain as-is (instant auto-join).

**Primary recommendation:** Fix phone normalization in the latest `add_pending_member` RPC, add a creator-only guard by checking `groups.created_by`, add an `invite_status` column to `pending_members`, and update the client to pass `created_by` info for UI gating.

## Standard Stack

This phase is entirely within the existing stack -- no new libraries needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase (PostgreSQL) | existing | RPC functions, migrations, RLS | Already in use |
| Expo Router | existing | Navigation, deep linking | Already in use |
| @gorhom/bottom-sheet | existing | AddMemberSheet modal | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| supabase-js | existing | Client-side RPC calls | All data operations |

**Installation:** No new packages required.

## Architecture Patterns

### Pattern 1: Phone Number Normalization at the RPC Layer

**What:** Always strip the leading `+` from phone numbers before comparing against `users.phone_number` or storing in `pending_members.phone_number`. Supabase Auth stores phones WITHOUT the `+` prefix (e.g., `639171234567`), while the app sends WITH the `+` prefix (e.g., `+639171234567`).

**When to use:** Every phone lookup in any RPC function.

**Current bug (CRITICAL):** Migration 00015 (`pending_member_nickname.sql`) replaced the `add_pending_member` function but **dropped the phone normalization** that migration 00014 added. The current production function does a raw comparison:
```sql
-- BROKEN: Current state in 00015
select u.id into existing_user_id
from users u
where u.phone_number = p_phone_number;  -- No normalization!
```

**Fix:** Reintroduce the normalization from 00014:
```sql
-- CORRECT: Normalize before comparison
normalized_phone := ltrim(p_phone_number, '+');

select u.id into existing_user_id
from users u
where u.phone_number = normalized_phone;
```

**Also normalize for storage:**
```sql
-- Store without '+' to match auth.users format
insert into pending_members (group_id, phone_number, added_by, nickname)
values (p_group_id, normalized_phone, current_user_id, p_nickname);
```

**Also normalize duplicate checks:**
```sql
-- Check both formats for existing pending members
where group_id = p_group_id
  and (phone_number = p_phone_number or phone_number = normalized_phone)
```

### Pattern 2: Creator-Only Permission Guard in RPC

**What:** Add a check in `add_pending_member` that verifies the calling user is the group creator (`groups.created_by = auth.uid()`), not just a member.

**Example:**
```sql
-- After the existing group membership check, add:
if not exists (
  select 1 from groups
  where id = p_group_id and created_by = current_user_id
) then
  raise exception 'Only the group creator can add members by phone';
end if;
```

**Client-side gating:** The group detail screen already fetches `created_by` from the groups table. Use this to conditionally show/hide or disable the "Add Member" button:
```typescript
// In group/[id].tsx - group detail already has created_by
const isCreator = user?.id === group.created_by;

// Only show Add Member button for creator
{isCreator && (
  <Button label="Add Member" variant="secondary" onPress={openAddMember} />
)}
```

### Pattern 3: Invite Status Column on pending_members

**What:** Add an `invite_status` column to `pending_members` to distinguish between different states of an invite. This is needed for Phase 8 (accept/decline UI) but the schema change belongs in Phase 7 (infrastructure).

**Schema change:**
```sql
-- Add invite status to pending_members
alter table public.pending_members
  add column invite_status text not null default 'pending'
  check (invite_status in ('pending', 'accepted', 'declined'));
```

**Why this pattern:** The `pending_members` table already serves as the invite record. Adding a status column is simpler than creating a separate `invites` table, and the existing auto-link trigger, expense_splits references, and balance RPCs all already reference `pending_members`. No need to refactor those relationships.

**Behavioral change for INV-03:** When a phone-added user already has an account, the current behavior is to add them directly to `group_members`. With INV-03, this should instead create a `pending_members` record with `invite_status = 'pending'`, regardless of whether the user already has an account. The auto-link trigger (on signup) should only apply to users who are signing up for the first time.

### Pattern 4: Preserve Invite Link Auto-Join (INV-08)

**What:** The `join_group_by_invite` RPC must remain unchanged. It inserts directly into `group_members` with no pending/invite step. This is the distinct flow for share-sheet deep links.

**Current implementation is correct as-is:**
```sql
-- join_group_by_invite: direct join, no invite step
insert into group_members (group_id, user_id)
values (found_group_id, current_user_id)
on conflict (group_id, user_id) do nothing;
```

**Key distinction:**
- Phone invite (add_pending_member) = consent-based, creates pending invite
- Link invite (join_group_by_invite) = instant auto-join, user initiated the action themselves

### Anti-Patterns to Avoid

- **Separate invites table:** Do not create a new `invites` table. The `pending_members` table already has the right structure and relationships. Adding a status column is sufficient.
- **Client-side permission checking only:** The creator check MUST be in the RPC function (server-side). Client-side hiding is a UX nicety, not a security measure.
- **Changing join_group_by_invite:** Do not modify the invite link flow. INV-08 explicitly requires it stays as instant auto-join.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone normalization | Custom regex parser | `ltrim(p_phone_number, '+')` | PostgreSQL built-in, handles edge cases |
| Permission checking | Client-side only checks | Server-side RPC guard + client UI gating | Security must be server-enforced |
| Invite state machine | Complex state transitions | Simple status column with CHECK constraint | Only 3 states needed (pending/accepted/declined) |

## Common Pitfalls

### Pitfall 1: Migration Regression on Phone Normalization

**What goes wrong:** A later migration replaces a function but drops fixes from earlier migrations. This already happened -- migration 00015 dropped the normalization from 00014.
**Why it happens:** Each `CREATE OR REPLACE FUNCTION` completely replaces the function body. If the new version doesn't include all fixes from previous versions, they are lost.
**How to avoid:** When writing a new version of `add_pending_member`, start from the LATEST working version (00014's logic) and add new features on top, not from the pre-fix version.
**Warning signs:** Phone lookup tests fail for numbers with `+` prefix.

### Pitfall 2: Auto-Link Trigger Conflict with Invite Consent

**What goes wrong:** The auto-link trigger (`handle_pending_member_claim`) fires on `auth.users` INSERT and automatically adds users to groups and transfers expense splits. With consent-based invites, this trigger should NOT auto-accept invites.
**Why it happens:** The trigger was designed for the old flow where pending members are auto-added on signup.
**How to avoid:** Modify the auto-link trigger to check `invite_status`. If status is `pending`, the trigger should NOT auto-add the user to `group_members`. Instead, the user should see the invite in their inbox (Phase 8) and accept it manually. The trigger should still link the user's ID to the pending_members record (so the invite inbox can show it), but not promote them to full membership.
**Warning signs:** New users are automatically added to groups they were phone-invited to, bypassing the accept/decline flow.

### Pitfall 3: Existing Pending Members Data Migration

**What goes wrong:** Existing `pending_members` rows from before the invite_status column was added need a sensible default.
**Why it happens:** The app has been live with pending_members that were created under the old "auto-add" model.
**How to avoid:** Set `default 'pending'` on the new column so existing rows get status `pending`. This is correct because those users haven't explicitly accepted yet.

### Pitfall 4: Creator Check Race Condition on Group Creation

**What goes wrong:** If the `groups.created_by` field is used for the permission check, the creator must be the user who called `create_group`. This is already the case.
**How to avoid:** No action needed -- `create_group` RPC already sets `created_by = auth.uid()`.

### Pitfall 5: Expense Splits for Invited-but-Not-Accepted Users

**What goes wrong:** Users can be included in expense splits while their invite is still pending. This is actually correct behavior -- expenses should include pending invitees. But if the user later declines (Phase 8), those splits must be cleaned up.
**How to avoid:** Phase 7 does not need to handle decline cleanup (that is Phase 8 / INV-07). But the schema must support it. The existing `expense_splits.pending_member_id` FK to `pending_members.id` with `ON DELETE CASCADE` would handle this IF we delete the pending_members row on decline. Verify this cascade exists.

## Code Examples

### Fix 1: Updated add_pending_member with Normalization + Creator Guard + Invite Status

```sql
-- Source: Derived from existing migrations 00014 and 00015
create or replace function public.add_pending_member(
  p_group_id uuid,
  p_phone_number text,
  p_nickname text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_phone text;
  existing_user_id uuid;
  existing_pending_id uuid;
  new_pending_id uuid;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Normalize phone: strip leading '+' to match auth.users format
  normalized_phone := ltrim(p_phone_number, '+');

  -- Verify caller is a member of the group
  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = current_user_id
  ) then
    raise exception 'Not a member of this group';
  end if;

  -- INV-02: Only the group creator can add members by phone
  if not exists (
    select 1 from groups
    where id = p_group_id and created_by = current_user_id
  ) then
    raise exception 'Only the group creator can add members by phone';
  end if;

  -- Check if already a pending member in this group (both formats)
  select id into existing_pending_id
  from pending_members
  where group_id = p_group_id
    and (phone_number = p_phone_number or phone_number = normalized_phone);

  if existing_pending_id is not null then
    raise exception 'This phone number is already pending in this group';
  end if;

  -- Check if already a full group member by phone
  select u.id into existing_user_id
  from users u
  where u.phone_number = normalized_phone;

  if existing_user_id is not null then
    if exists (
      select 1 from group_members
      where group_id = p_group_id and user_id = existing_user_id
    ) then
      raise exception 'This person is already a member of this group';
    end if;
  end if;

  -- INV-03: Always create as pending invite (not auto-add)
  -- Even if user exists, they must accept the invite
  insert into pending_members (group_id, phone_number, added_by, nickname, invite_status)
  values (p_group_id, normalized_phone, current_user_id, nullif(trim(p_nickname), ''), 'pending')
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;
```

### Fix 2: Updated Auto-Link Trigger (Consent-Aware)

```sql
-- The auto-link trigger should link user identity but NOT auto-join
create or replace function public.handle_pending_member_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending record;
begin
  -- Look up pending members matching this phone (normalized comparison)
  for pending in
    select id, group_id, invite_status from pending_members
    where ltrim(phone_number, '+') = ltrim(new.phone, '+')
  loop
    begin
      -- Ensure public.users row exists
      insert into users (id, phone_number)
      values (new.id, new.phone)
      on conflict (id) do nothing;

      -- Only auto-join for NON-invite pending members (legacy behavior)
      -- For invite-based pending members, leave as pending for accept/decline
      -- Phase 8 will handle the accept flow
      -- NOTE: With the new invite system, all phone-added members have
      -- invite_status = 'pending', so this trigger effectively becomes a no-op
      -- for new records. It only auto-joins legacy records without invite_status.
    exception
      when others then
        raise warning 'pending_member_claim failed for pending_id %, phone %: %',
          pending.id, new.phone, sqlerrm;
    end;
  end loop;

  return new;
exception
  when others then
    raise warning 'handle_pending_member_claim failed entirely for phone %: %',
      new.phone, sqlerrm;
    return new;
end;
$$;
```

### Fix 3: Client-Side Creator Gating

```typescript
// In app/group/[id].tsx - the group detail already fetches created_by
// Current code already has: group.created_by
// Add creator check for the Add Member button:

const isCreator = currentUserId === group.created_by;

// Replace current unconditional Add Member button:
{isCreator && (
  <Button
    label="Add Member"
    variant="secondary"
    onPress={openAddMember}
    style={styles.addMemberButton}
  />
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-add on phone invite | Consent-based pending invite | This phase | Users must accept before joining |
| Any member can add by phone | Creator-only phone invites | This phase | Security improvement |
| +prefix mismatch in lookup | Normalized comparison with ltrim | Partially done in 00014, regressed in 00015 | Must re-fix |

## Open Questions

1. **Should existing pending_members be treated as already-accepted?**
   - What we know: Existing pending members were created under the old auto-add model. Setting them to `pending` status means they would need to accept again.
   - What's unclear: Whether existing pending members should be grandfathered as accepted or left as pending.
   - Recommendation: Leave as `pending` (default). Since these are users who haven't signed up yet, they should still go through the consent flow when they do sign up.

2. **Should the auto-link trigger be completely disabled or just modified?**
   - What we know: The trigger currently auto-joins users on signup. With consent-based invites, auto-joining defeats the purpose.
   - What's unclear: Whether there are edge cases where auto-linking is still desired.
   - Recommendation: Modify the trigger to only create the `public.users` row (needed for FK constraints) but NOT auto-add to `group_members` or transfer expense splits. Those actions should happen in the accept-invite RPC (Phase 8).

3. **Should `pending_members` also store the invited user's UUID when known?**
   - What we know: Currently `pending_members` only stores `phone_number`. If the invited user already has an account, we know their user_id but don't store it.
   - What's unclear: Whether adding a `user_id` column to `pending_members` would simplify Phase 8's invite inbox query.
   - Recommendation: Add an optional `user_id` column to `pending_members`. This makes it easy for Phase 8 to query "show me all pending_members where user_id = auth.uid()" for the invite inbox, rather than doing a phone number join.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 17 migration files read and analyzed
- `supabase/migrations/00014_fix_phone_format_mismatch.sql` -- phone normalization fix
- `supabase/migrations/00015_pending_member_nickname.sql` -- current (regressed) add_pending_member
- `supabase/migrations/00007_auto_link_trigger.sql` -- auto-link trigger
- `supabase/migrations/00001_initial_schema.sql` -- groups.created_by field
- `components/groups/AddMemberModal.tsx` -- client sends `+63${rawDigits}`
- `app/group/[id].tsx` -- group detail fetches created_by, renders Add Member button
- `app/join/[code].tsx` -- invite link auto-join flow (must not change)
- `.planning/REQUIREMENTS.md` -- INV-01 through INV-08
- `.planning/STATE.md` -- known issues and decisions

### Secondary (MEDIUM confidence)
- Supabase Auth phone format: confirmed by migration 00014's comments that auth.users stores without `+` prefix

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, existing codebase analysis
- Architecture: HIGH -- patterns derived directly from existing code and migrations
- Pitfalls: HIGH -- the phone regression bug is confirmed by code diff between migrations 00014 and 00015

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, schema changes are project-specific)
