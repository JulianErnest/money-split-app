-- Fix infinite recursion in group_members RLS policies
-- Security definer function bypasses RLS, breaking the circular reference

create or replace function public.get_user_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from group_members where user_id = auth.uid();
$$;

-- Drop recursive policies
drop policy if exists "Members can view group members" on public.group_members;
drop policy if exists "Members can view their groups" on public.groups;
drop policy if exists "Members can view group expenses" on public.expenses;
drop policy if exists "Members can view expense splits" on public.expense_splits;
drop policy if exists "Users can view profiles of group co-members" on public.users;
drop policy if exists "Members can add expenses to their groups" on public.expenses;
drop policy if exists "Members can add expense splits" on public.expense_splits;

-- Recreate policies using the security definer function
create policy "Members can view group members"
  on public.group_members for select
  using (group_id in (select public.get_user_group_ids()));

create policy "Members can view their groups"
  on public.groups for select
  using (id in (select public.get_user_group_ids()));

create policy "Members can view group expenses"
  on public.expenses for select
  using (group_id in (select public.get_user_group_ids()));

create policy "Members can add expenses to their groups"
  on public.expenses for insert
  to authenticated
  with check (
    group_id in (select public.get_user_group_ids())
    and (select auth.uid()) = created_by
  );

create policy "Members can view expense splits"
  on public.expense_splits for select
  using (
    expense_id in (
      select id from public.expenses
      where group_id in (select public.get_user_group_ids())
    )
  );

create policy "Members can add expense splits"
  on public.expense_splits for insert
  to authenticated
  with check (
    expense_id in (
      select id from public.expenses
      where group_id in (select public.get_user_group_ids())
    )
  );

create policy "Users can view profiles of group co-members"
  on public.users for select
  using (
    id in (
      select user_id from public.group_members
      where group_id in (select public.get_user_group_ids())
    )
  );
