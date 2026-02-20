-- Fix get_group_balances to anchor on all group members (real + pending)
-- instead of only on expense splits (owed CTE).
--
-- Bug: If a member paid for expenses but had no splits (e.g., "Not involved"),
-- they were invisible in the query and their paid amount was lost.
-- The groups list (get_my_group_balances) was correct because it anchors on
-- group_members. This migration aligns get_group_balances to the same approach.

create or replace function public.get_group_balances(p_group_id uuid)
returns table(member_id uuid, is_pending boolean, net_balance numeric(10,2))
language plpgsql
security definer
set search_path = public
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

  return query
  with all_members as (
    -- All real members
    select gm.user_id as mid, false as is_pend
    from group_members gm
    where gm.group_id = p_group_id
    union all
    -- All pending members
    select pm.id as mid, true as is_pend
    from pending_members pm
    where pm.group_id = p_group_id
  ),
  paid as (
    -- How much each member paid for the group
    select
      e.paid_by as mid,
      sum(e.amount) as total_paid
    from expenses e
    where e.group_id = p_group_id
    group by e.paid_by
  ),
  owed as (
    -- How much each member owes (split amounts)
    select
      coalesce(es.user_id, es.pending_member_id) as mid,
      (es.user_id is null) as is_pend,
      sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by coalesce(es.user_id, es.pending_member_id), (es.user_id is null)
  )
  select
    am.mid as member_id,
    am.is_pend as is_pending,
    (coalesce(p.total_paid, 0) - coalesce(o.total_owed, 0))::numeric(10,2) as net_balance
  from all_members am
  left join paid p on p.mid = am.mid and am.is_pend = false
  left join owed o on o.mid = am.mid and o.is_pend = am.is_pend
  where coalesce(p.total_paid, 0) - coalesce(o.total_owed, 0) != 0;
end;
$$;
