-- Settlements table, record/delete RPCs, and balance RPC updates
--
-- Five parts:
-- 1. settlements table with RLS and indexes
-- 2. record_settlement RPC (validates caller, membership, positive amount)
-- 3. delete_settlement RPC (creator-only deletion)
-- 4. Updated get_group_balances incorporating settlement math
-- 5. Updated get_my_group_balances incorporating settlement math

-- ============================================================================
-- PART 1: settlements table
-- ============================================================================

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.users(id) not null,
  paid_to uuid references public.users(id) not null,
  amount numeric(10,2) not null check (amount > 0),
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null
);

alter table public.settlements enable row level security;

-- RLS: group members can view settlements in their groups
create policy "Members can view group settlements"
  on public.settlements for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

-- Indexes for query performance
create index idx_settlements_group_id on public.settlements(group_id);
create index idx_settlements_paid_by on public.settlements(paid_by);
create index idx_settlements_paid_to on public.settlements(paid_to);

-- ============================================================================
-- PART 2: record_settlement RPC
-- ============================================================================
-- Validates: auth, caller is payer or receiver, both are group members, positive amount.
-- Does NOT validate amount matches current balance (race condition tolerance).

create or replace function public.record_settlement(
  p_group_id uuid,
  p_paid_by uuid,
  p_paid_to uuid,
  p_amount numeric(10,2)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_settlement_id uuid;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Caller must be either the payer or the receiver (own debts only)
  if current_user_id != p_paid_by and current_user_id != p_paid_to then
    raise exception 'You can only settle your own debts';
  end if;

  -- Both parties must be group members
  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = p_paid_by
  ) then
    raise exception 'Payer is not a member of this group';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = p_paid_to
  ) then
    raise exception 'Receiver is not a member of this group';
  end if;

  -- Amount must be positive
  if p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  -- Insert the settlement
  insert into settlements (group_id, paid_by, paid_to, amount, created_by)
  values (p_group_id, p_paid_by, p_paid_to, p_amount, current_user_id)
  returning id into new_settlement_id;

  return new_settlement_id;
end;
$$;

-- ============================================================================
-- PART 3: delete_settlement RPC
-- ============================================================================
-- Only the settlement creator can delete it. No time window restriction.

create or replace function public.delete_settlement(
  p_settlement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_created_by uuid;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Fetch settlement creator
  select created_by into v_created_by
  from settlements
  where id = p_settlement_id;

  if v_created_by is null then
    raise exception 'Settlement not found';
  end if;

  if v_created_by != current_user_id then
    raise exception 'Only the person who recorded this settlement can delete it';
  end if;

  delete from settlements where id = p_settlement_id;
end;
$$;

-- ============================================================================
-- PART 4: Updated get_group_balances with settlement math
-- ============================================================================
-- Replaces the version from 00017 (anchor fix). Adds settled_out and settled_in
-- CTEs so that settlements affect net balance:
--   paid_by (debtor) net goes UP   (+settled_out)
--   paid_to (creditor) net goes DOWN (-settled_in)

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
  ),
  -- Settlement adjustments (only real members can settle)
  settled_out as (
    -- Money paid OUT (settlements where this member was the payer/debtor)
    select s.paid_by as mid, sum(s.amount) as total_settled
    from settlements s
    where s.group_id = p_group_id
    group by s.paid_by
  ),
  settled_in as (
    -- Money received IN (settlements where this member was the receiver/creditor)
    select s.paid_to as mid, sum(s.amount) as total_settled
    from settlements s
    where s.group_id = p_group_id
    group by s.paid_to
  )
  select
    am.mid as member_id,
    am.is_pend as is_pending,
    (
      coalesce(p.total_paid, 0)
      - coalesce(o.total_owed, 0)
      + coalesce(so.total_settled, 0)
      - coalesce(si.total_settled, 0)
    )::numeric(10,2) as net_balance
  from all_members am
  left join paid p on p.mid = am.mid and am.is_pend = false
  left join owed o on o.mid = am.mid and o.is_pend = am.is_pend
  left join settled_out so on so.mid = am.mid and am.is_pend = false
  left join settled_in si on si.mid = am.mid and am.is_pend = false
  where (
    coalesce(p.total_paid, 0)
    - coalesce(o.total_owed, 0)
    + coalesce(so.total_settled, 0)
    - coalesce(si.total_settled, 0)
  ) != 0;
end;
$$;

-- ============================================================================
-- PART 5: Updated get_my_group_balances with settlement math
-- ============================================================================
-- Replaces the version from 00009. Adds settled_out and settled_in CTEs
-- so that home screen per-group balance reflects settlements.

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
  ),
  settled_out as (
    -- Settlements where caller was the payer/debtor (net goes up)
    select
      s.group_id,
      sum(s.amount) as total_settled
    from settlements s
    where s.paid_by = current_user_id
      and s.group_id in (select mg.group_id from my_groups mg)
    group by s.group_id
  ),
  settled_in as (
    -- Settlements where caller was the receiver/creditor (net goes down)
    select
      s.group_id,
      sum(s.amount) as total_settled
    from settlements s
    where s.paid_to = current_user_id
      and s.group_id in (select mg.group_id from my_groups mg)
    group by s.group_id
  )
  select
    mg.group_id,
    (
      coalesce(p.total_paid, 0)
      - coalesce(o.total_owed, 0)
      + coalesce(so.total_settled, 0)
      - coalesce(si.total_settled, 0)
    )::numeric(10,2) as net_balance
  from my_groups mg
  left join paid p on p.group_id = mg.group_id
  left join owed o on o.group_id = mg.group_id
  left join settled_out so on so.group_id = mg.group_id
  left join settled_in si on si.group_id = mg.group_id
  where (
    coalesce(p.total_paid, 0)
    - coalesce(o.total_owed, 0)
    + coalesce(so.total_settled, 0)
    - coalesce(si.total_settled, 0)
  ) != 0;
end;
$$;
