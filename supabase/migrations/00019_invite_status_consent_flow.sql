-- Invite status and consent-aware flow (INV-03)
--
-- Three changes:
-- 1. Add invite_status and user_id columns to pending_members
-- 2. Replace add_pending_member to ALWAYS create pending invites (never auto-add)
-- 3. Replace auto-link trigger to be consent-aware (link identity, don't auto-join)
--
-- Key behavioral change: phone-added users appear as pending invites, not auto-added members.
-- The invite link flow (join_group_by_invite) is NOT modified here (INV-08).

-- ============================================================================
-- PART 1: Schema changes on pending_members
-- ============================================================================

-- Add invite_status column (defaults to 'pending' for existing rows)
alter table public.pending_members
  add column if not exists invite_status text not null default 'pending'
  constraint pending_members_invite_status_check
  check (invite_status in ('pending', 'accepted', 'declined'));

-- Add optional user_id column (for Phase 8 invite inbox queries)
-- When a known user is added by phone, we store their user_id here
-- so Phase 8 can query: SELECT * FROM pending_members WHERE user_id = auth.uid()
alter table public.pending_members
  add column if not exists user_id uuid references users(id);

-- Index for Phase 8 inbox lookups
create index if not exists idx_pending_members_user_id
  on pending_members(user_id) where user_id is not null;

-- ============================================================================
-- PART 2: Replace add_pending_member — ALWAYS create pending invite
-- ============================================================================
-- Key change from 00018: even if user already exists and has an account,
-- they are NOT auto-added to group_members. Instead a pending_members row
-- is created with their user_id linked.

create or replace function public.add_pending_member(
  p_group_id uuid,
  p_phone_number text,  -- Expected E.164 format: +639XXXXXXXXX
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

  -- Check if already a pending member in this group (normalized comparison)
  if exists (
    select 1 from pending_members
    where group_id = p_group_id
      and (phone_number = p_phone_number or phone_number = normalized_phone)
  ) then
    raise exception 'This phone number is already pending in this group';
  end if;

  -- Check if a user with this phone already exists (normalized comparison)
  select u.id into existing_user_id
  from users u
  where u.phone_number = normalized_phone;

  if existing_user_id is not null then
    -- User exists -- check if already a full group member
    if exists (
      select 1 from group_members
      where group_id = p_group_id and user_id = existing_user_id
    ) then
      raise exception 'This person is already a member of this group';
    end if;

    -- INV-03: Create pending invite WITH user_id linked (user must accept in Phase 8)
    -- Do NOT insert into group_members. Do NOT transfer expense splits.
    insert into pending_members (group_id, phone_number, added_by, nickname, invite_status, user_id)
    values (p_group_id, normalized_phone, current_user_id, nullif(trim(p_nickname), ''), 'pending', existing_user_id)
    returning id into new_pending_id;

    return new_pending_id;
  end if;

  -- User does not exist: create pending invite (user_id stays NULL, linked by trigger on signup)
  insert into pending_members (group_id, phone_number, added_by, nickname, invite_status)
  values (p_group_id, normalized_phone, current_user_id, nullif(trim(p_nickname), ''), 'pending')
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;

-- ============================================================================
-- PART 3: Replace auto-link trigger — consent-aware
-- ============================================================================
-- Key change: on new signup, link user_id to pending_members but do NOT
-- auto-join group_members or transfer expense_splits. User must accept
-- the invite in Phase 8.

create or replace function public.handle_pending_member_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure public.users row exists (needed for FK constraints)
  insert into users (id, phone_number)
  values (new.id, new.phone)
  on conflict (id) do nothing;

  -- Link identity to pending invites (don't auto-join, user must accept in Phase 8)
  update pending_members
  set user_id = new.id
  where user_id is null
    and ltrim(phone_number, '+') = ltrim(new.phone, '+');

  return new;
exception
  when others then
    raise warning 'handle_pending_member_claim failed for phone %: %',
      new.phone, sqlerrm;
    return new;
end;
$$;
