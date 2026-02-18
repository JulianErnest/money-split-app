-- RPC functions for balance calculations
-- get_group_balances: net balances per member within a group
-- get_my_group_balances: caller's net balance across all groups

-- ---------------------------------------------------------------------------
-- get_group_balances(p_group_id uuid)
-- Returns net balance per member (positive = owed money, negative = owes money)
-- Includes pending members identified by is_pending flag
-- ---------------------------------------------------------------------------

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
  with paid as (
    -- How much each member paid for the group
    select
      e.paid_by as member_id,
      false as is_pending,
      sum(e.amount) as total_paid
    from expenses e
    where e.group_id = p_group_id
    group by e.paid_by
  ),
  owed as (
    -- How much each member owes (split amounts)
    select
      coalesce(es.user_id, es.pending_member_id) as member_id,
      (es.user_id is null) as is_pending,
      sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by coalesce(es.user_id, es.pending_member_id), (es.user_id is null)
  )
  select
    o.member_id,
    o.is_pending,
    coalesce(p.total_paid, 0) - o.total_owed as net_balance
  from owed o
  left join paid p on p.member_id = o.member_id and o.is_pending = false
  where coalesce(p.total_paid, 0) - o.total_owed != 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_group_balances()
-- Returns caller's net balance per group (for groups list summary)
-- Only returns groups where balance != 0
-- ---------------------------------------------------------------------------

create or replace function public.get_my_group_balances()
returns table(group_id uuid, net_balance numeric(10,2))
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

  return query
  with my_groups as (
    select gm.group_id
    from group_members gm
    where gm.user_id = current_user_id
  ),
  paid as (
    -- How much caller paid per group
    select
      e.group_id,
      sum(e.amount) as total_paid
    from expenses e
    where e.paid_by = current_user_id
      and e.group_id in (select mg.group_id from my_groups mg)
    group by e.group_id
  ),
  owed as (
    -- How much caller owes per group
    select
      e.group_id,
      sum(es.amount) as total_owed
    from expense_splits es
    join expenses e on e.id = es.expense_id
    where es.user_id = current_user_id
      and e.group_id in (select mg.group_id from my_groups mg)
    group by e.group_id
  )
  select
    mg.group_id,
    coalesce(p.total_paid, 0) - coalesce(o.total_owed, 0) as net_balance
  from my_groups mg
  left join paid p on p.group_id = mg.group_id
  left join owed o on o.group_id = mg.group_id
  where coalesce(p.total_paid, 0) - coalesce(o.total_owed, 0) != 0;
end;
$$;
