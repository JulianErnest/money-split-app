-- RPC to remove a member (real or pending) from a group.
-- Cleans up their expense splits and prevents removing the group creator.

create or replace function public.remove_group_member(
  p_group_id uuid,
  p_member_id uuid,
  p_is_pending boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
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

  if p_is_pending then
    -- Remove pending member and their expense splits
    delete from expense_splits
    where pending_member_id = p_member_id;

    delete from pending_members
    where id = p_member_id and group_id = p_group_id;
  else
    -- Cannot remove the group creator
    if exists (
      select 1 from groups
      where id = p_group_id and created_by = p_member_id
    ) then
      raise exception 'Cannot remove the group creator';
    end if;

    -- Cannot remove yourself (use leave group instead)
    if p_member_id = current_user_id then
      raise exception 'Cannot remove yourself from the group';
    end if;

    -- Remove their expense splits in this group
    delete from expense_splits
    where user_id = p_member_id
      and expense_id in (
        select id from expenses where group_id = p_group_id
      );

    -- Remove from group
    delete from group_members
    where group_id = p_group_id and user_id = p_member_id;
  end if;
end;
$$;
