-- Activity feed RPC: unified chronological feed of expenses and settlements
--
-- Returns recent activity across all of the caller's groups,
-- merging expenses and settlements via UNION ALL with denormalized
-- group and payer names. Supports offset pagination and a configurable
-- time window (default 30 days).

create or replace function public.get_recent_activity(
  p_limit integer default 5,
  p_offset integer default 0,
  p_since timestamptz default (now() - interval '30 days')
)
returns table(
  id uuid,
  type text,
  description text,
  amount numeric(10,2),
  payer_name text,
  payer_id uuid,
  group_name text,
  group_id uuid,
  expense_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with my_groups as (
    select gm.group_id
    from group_members gm
    where gm.user_id = current_user_id
  )
  -- Expenses from user's groups
  select
    e.id,
    'expense'::text as type,
    e.description,
    e.amount,
    coalesce(u.display_name, 'Unknown') as payer_name,
    e.paid_by as payer_id,
    g.name as group_name,
    e.group_id,
    e.id as expense_id,
    e.created_at
  from expenses e
  join groups g on g.id = e.group_id
  join users u on u.id = e.paid_by
  where e.group_id in (select mg.group_id from my_groups mg)
    and e.created_at >= p_since

  union all

  -- Settlements from user's groups
  select
    s.id,
    'settlement'::text as type,
    'Settlement'::text as description,
    s.amount,
    coalesce(u.display_name, 'Unknown') as payer_name,
    s.paid_by as payer_id,
    g.name as group_name,
    s.group_id,
    null::uuid as expense_id,
    s.created_at
  from settlements s
  join groups g on g.id = s.group_id
  join users u on u.id = s.paid_by
  where s.group_id in (select mg.group_id from my_groups mg)
    and s.created_at >= p_since

  order by created_at desc
  limit p_limit
  offset p_offset;
end;
$$;
