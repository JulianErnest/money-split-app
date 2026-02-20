-- Add optional nickname column to pending_members
-- When a user adds someone by phone who hasn't signed up yet,
-- they can give them a temporary display name instead of just showing the number.

alter table public.pending_members
  add column nickname text;

-- Update add_pending_member to accept an optional nickname
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

  -- Check if a user with this phone already exists
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
    delete from pending_members
    where group_id = p_group_id and phone_number = p_phone_number;

    -- Transfer any expense splits from the pending member to the real user
    update expense_splits
    set user_id = existing_user_id, pending_member_id = null
    where pending_member_id in (
      select id from pending_members
      where phone_number = p_phone_number
    );

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

  -- Create pending member with optional nickname
  insert into pending_members (group_id, phone_number, added_by, nickname)
  values (p_group_id, p_phone_number, current_user_id, nullif(trim(p_nickname), ''))
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;
