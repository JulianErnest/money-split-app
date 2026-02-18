-- Fix: phone format mismatch in add_pending_member
--
-- Root cause: Supabase Auth stores phones WITHOUT '+' prefix (e.g., '639773028986')
-- but the client sends WITH '+' prefix (e.g., '+639773028986').
-- The lookup failed because '+639773028986' != '639773028986'.
--
-- Fix: Strip leading '+' before comparing with users tables.
-- Also normalize pending_members phone_number to match (strip '+').

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

  -- Check if a user with this phone already exists
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

  -- Create pending member (store normalized format without '+')
  insert into pending_members (group_id, phone_number, added_by)
  values (p_group_id, normalized_phone, current_user_id)
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;

-- Also fix the auto-link trigger to handle both phone formats
create or replace function public.handle_pending_member_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending record;
begin
  -- Look up pending members matching this phone (with or without '+')
  for pending in
    select id, group_id from pending_members
    where phone_number = new.phone
       or phone_number = '+' || new.phone
       or ltrim(phone_number, '+') = ltrim(new.phone, '+')
  loop
    begin
      insert into users (id, phone_number)
      values (new.id, new.phone)
      on conflict (id) do nothing;

      insert into group_members (group_id, user_id)
      values (pending.group_id, new.id)
      on conflict (group_id, user_id) do nothing;

      update expense_splits
      set user_id = new.id, pending_member_id = null
      where pending_member_id = pending.id;

      delete from pending_members where id = pending.id;
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

-- One-time data fix: claim existing pending members with format mismatch
do $$
declare
  pending record;
  real_user_id uuid;
begin
  for pending in
    select pm.id, pm.group_id, pm.phone_number
    from pending_members pm
  loop
    -- Match with or without '+' prefix
    select u.id into real_user_id
    from public.users u
    where u.phone_number = ltrim(pending.phone_number, '+');

    if real_user_id is not null then
      insert into group_members (group_id, user_id)
      values (pending.group_id, real_user_id)
      on conflict (group_id, user_id) do nothing;

      update expense_splits
      set user_id = real_user_id, pending_member_id = null
      where pending_member_id = pending.id;

      delete from pending_members where id = pending.id;
    end if;
  end loop;
end;
$$;

-- Clean up debug functions
drop function if exists public.debug_phone_lookup(text);
drop function if exists public.debug_list_phones();
