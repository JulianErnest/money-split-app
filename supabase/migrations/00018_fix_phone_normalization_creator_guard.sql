-- Fix phone normalization regression from 00015 and add creator-only permission guard
-- (INV-01, INV-02)
--
-- Migration 00015 added the nickname parameter but accidentally dropped the phone
-- normalization logic that 00014 introduced. This restores it and adds a new guard
-- so only the group creator can add members by phone.

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
  pending_id uuid;
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

  -- Check if a user with this phone already exists (normalized comparison)
  select u.id into existing_user_id
  from users u
  where u.phone_number = normalized_phone;

  if existing_user_id is not null then
    -- User exists -- check if already a group member
    if exists (
      select 1 from group_members
      where group_id = p_group_id and user_id = existing_user_id
    ) then
      raise exception 'This person is already a member of this group';
    end if;

    -- Clean up any pending member entry for this phone in this group
    -- Check both formats (with and without '+')
    select id into pending_id
    from pending_members
    where group_id = p_group_id
      and (phone_number = p_phone_number or phone_number = normalized_phone);

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

  -- Check if already a pending member in this group (both formats)
  if exists (
    select 1 from pending_members
    where group_id = p_group_id
      and (phone_number = p_phone_number or phone_number = normalized_phone)
  ) then
    raise exception 'This phone number is already pending in this group';
  end if;

  -- Create pending member with optional nickname (store normalized format without '+')
  insert into pending_members (group_id, phone_number, added_by, nickname)
  values (p_group_id, normalized_phone, current_user_id, nullif(trim(p_nickname), ''))
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;
