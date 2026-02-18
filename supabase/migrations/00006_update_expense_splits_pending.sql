-- Allow expense_splits to reference pending members (users not yet signed up)
-- Exactly one of user_id or pending_member_id must be set per split row.

-- Make user_id nullable (was NOT NULL) to allow pending member splits
alter table public.expense_splits
  alter column user_id drop not null;

-- Add pending_member_id column referencing pending_members
alter table public.expense_splits
  add column pending_member_id uuid references public.pending_members(id) on delete set null;

-- Ensure exactly one of user_id or pending_member_id is set
alter table public.expense_splits
  add constraint expense_splits_member_check
  check (num_nonnulls(user_id, pending_member_id) = 1);

-- Drop the old unique constraint and create partial unique indexes
alter table public.expense_splits
  drop constraint if exists expense_splits_expense_id_user_id_key;

create unique index expense_splits_expense_user_unique
  on public.expense_splits(expense_id, user_id)
  where user_id is not null;

create unique index expense_splits_expense_pending_unique
  on public.expense_splits(expense_id, pending_member_id)
  where pending_member_id is not null;

-- Index for claim lookups (auto-link trigger queries by pending_member_id)
create index idx_expense_splits_pending_member
  on public.expense_splits(pending_member_id)
  where pending_member_id is not null;
