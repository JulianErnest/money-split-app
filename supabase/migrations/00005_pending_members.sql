-- Pending members: phone-number-identified placeholders for users not yet signed up
-- These represent group members who have been added by phone number but haven't created an account yet.

create table public.pending_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  phone_number text not null,  -- E.164 format: +639XXXXXXXXX
  added_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null,
  unique(group_id, phone_number)
);

alter table public.pending_members enable row level security;

-- Members of the group can view pending members in their groups
create policy "Members can view pending members"
  on public.pending_members for select
  using (group_id in (select public.get_user_group_ids()));

-- Members can add pending members to their groups
create policy "Members can add pending members"
  on public.pending_members for insert
  to authenticated
  with check (
    group_id in (select public.get_user_group_ids())
    and (select auth.uid()) = added_by
  );

-- Members can remove pending members from their groups
create policy "Members can remove pending members"
  on public.pending_members for delete
  using (group_id in (select public.get_user_group_ids()));

-- Index for phone number lookup during auto-link trigger
create index idx_pending_members_phone on public.pending_members(phone_number);
create index idx_pending_members_group_id on public.pending_members(group_id);
