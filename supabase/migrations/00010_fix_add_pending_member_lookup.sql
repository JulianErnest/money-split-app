-- Fix: add_pending_member now queries auth.users for phone lookup
-- instead of public.users which is restricted by RLS.
--
-- Bug: When user A adds user B by phone number, if B is already signed up
-- but not in any shared group with A, the RLS policy on public.users hides
-- B's row. The lookup returns NULL and a pending member is created instead
-- of adding B directly to the group.
--
-- Fix: Query auth.users.phone (not subject to public.users RLS) to detect
-- existing users. The function already runs as security definer so it has
-- access to auth schema.

create or replace function public.add_pending_member(
  p_group_id uuid,
  p_phone_number text  -- Expected E.164 format: +639XXXXXXXXX
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_user_id uuid;
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

  -- Check if a user with this phone already exists (query auth.users to bypass RLS)
  select au.id into existing_user_id
  from auth.users au
  where au.phone = p_phone_number;

  if existing_user_id is not null then
    -- User exists -- check if already a group member
    if exists (
      select 1 from group_members
      where group_id = p_group_id and user_id = existing_user_id
    ) then
      raise exception 'This person is already a member of this group';
    end if;

    -- User exists but not in group -- add them directly
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
