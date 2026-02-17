-- RPC functions for atomic group creation and invite-based joining
-- Both use security definer to bypass RLS for transactional operations

-- create_group: atomically creates a group and adds the creator as the first member
create or replace function public.create_group(
  group_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Insert group
  insert into groups (name, created_by)
  values (group_name, current_user_id)
  returning id into new_group_id;

  -- Add creator as first member
  insert into group_members (group_id, user_id)
  values (new_group_id, current_user_id);

  return new_group_id;
end;
$$;

-- join_group_by_invite: looks up a group by invite code and adds the user as a member
create or replace function public.join_group_by_invite(
  invite text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_group_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into found_group_id
  from groups
  where invite_code = invite;

  if found_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Insert if not already a member (idempotent)
  insert into group_members (group_id, user_id)
  values (found_group_id, current_user_id)
  on conflict (group_id, user_id) do nothing;

  return found_group_id;
end;
$$;
