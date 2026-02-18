-- Fix: add_pending_member phone lookup bypasses RLS via set row_security = off
--
-- Previous fix (00010) queried auth.users but may have permission issues.
-- This approach disables RLS entirely for the function, then queries
-- public.users directly. Safe because the function does its own auth checks.

create or replace function public.add_pending_member(
  p_group_id uuid,
  p_phone_number text  -- Expected E.164 format: +639XXXXXXXXX
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  existing_user_id uuid;
  pending_id uuid;
  new_pending_id uuid;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify caller is a member of the group
  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = current_user_id
  ) then
    raise exception 'Not a member of this group';
  end if;

  -- Check if a user with this phone already exists
  -- RLS is disabled (set row_security = off) so we see ALL users
  select u.id into existing_user_id
  from users u
  where u.phone_number = p_phone_number;

  if existing_user_id is not null then
    -- User exists -- check if already a group member
    if exists (
      select 1 from group_members
      where group_id = p_group_id and user_id = existing_user_id
    ) then
      raise exception 'This person is already a member of this group';
    end if;

    -- Clean up any pending member entry for this phone in this group
    select id into pending_id
    from pending_members
    where group_id = p_group_id and phone_number = p_phone_number;

    if pending_id is not null then
      -- Transfer expense splits from pending to real user
      update expense_splits
      set user_id = existing_user_id, pending_member_id = null
      where pending_member_id = pending_id;

      -- Remove the pending entry
      delete from pending_members where id = pending_id;
    end if;

    -- Add real user to group
    insert into group_members (group_id, user_id)
    values (p_group_id, existing_user_id);

    return existing_user_id;
  end if;

  -- Check if already a pending member in this group
  if exists (
    select 1 from pending_members
    where group_id = p_group_id and phone_number = p_phone_number
  ) then
    raise exception 'This phone number is already pending in this group';
  end if;

  -- Create pending member
  insert into pending_members (group_id, phone_number, added_by)
  values (p_group_id, p_phone_number, current_user_id)
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;

-- One-time data fix: claim any existing pending members whose phone
-- matches a signed-up user. Fixes data created before this bug fix.
do $$
declare
  pending record;
  real_user_id uuid;
begin
  for pending in
    select pm.id, pm.group_id, pm.phone_number
    from pending_members pm
  loop
    select u.id into real_user_id
    from public.users u
    where u.phone_number = pending.phone_number;

    if real_user_id is not null then
      -- Add to group (skip if already member)
      insert into group_members (group_id, user_id)
      values (pending.group_id, real_user_id)
      on conflict (group_id, user_id) do nothing;

      -- Transfer expense splits
      update expense_splits
      set user_id = real_user_id, pending_member_id = null
      where pending_member_id = pending.id;

      -- Remove pending entry
      delete from pending_members where id = pending.id;
    end if;
  end loop;
end;
$$;
