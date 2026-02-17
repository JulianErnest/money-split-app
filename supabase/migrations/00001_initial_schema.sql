-- supabase/migrations/00001_initial_schema.sql

-- gen_random_uuid() is built into PostgreSQL 13+, no extension needed

-- Users table (synced from auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.users for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert their own profile"
  on public.users for insert
  with check ((select auth.uid()) = id);

-- Groups table
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null
);

alter table public.groups enable row level security;

-- Group members junction table
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

-- Users can only see groups they are members of
create policy "Members can view their groups"
  on public.groups for select
  using (
    id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can create groups"
  on public.groups for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- Group members policies
create policy "Members can view group members"
  on public.group_members for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can join groups"
  on public.group_members for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Expenses table
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  description text not null,
  amount numeric(10,2) not null check (amount > 0 and amount <= 999999),
  paid_by uuid references public.users(id) not null,
  split_type text not null check (split_type in ('equal', 'custom')),
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null
);

alter table public.expenses enable row level security;

create policy "Members can view group expenses"
  on public.expenses for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
  );

create policy "Members can add expenses to their groups"
  on public.expenses for insert
  to authenticated
  with check (
    group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid())
    )
    and (select auth.uid()) = created_by
  );

-- Expense splits table
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  amount numeric(10,2) not null check (amount >= 0),
  unique(expense_id, user_id)
);

alter table public.expense_splits enable row level security;

create policy "Members can view expense splits"
  on public.expense_splits for select
  using (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = (select auth.uid())
    )
  );

create policy "Members can add expense splits"
  on public.expense_splits for insert
  to authenticated
  with check (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = (select auth.uid())
    )
  );

-- Indexes for RLS policy performance
create index idx_group_members_user_id on public.group_members(user_id);
create index idx_group_members_group_id on public.group_members(group_id);
create index idx_expenses_group_id on public.expenses(group_id);
create index idx_expense_splits_expense_id on public.expense_splits(expense_id);

-- Also allow users to see other members' profiles within their groups (for display names)
create policy "Users can view profiles of group co-members"
  on public.users for select
  using (
    id in (
      select gm2.user_id from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = (select auth.uid())
    )
  );
