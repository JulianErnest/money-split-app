-- Invite accept/decline RPCs and RLS policy for invite inbox
--
-- Four parts:
-- 1. RLS policy allowing invited users to see their own pending_members rows
-- 2. get_my_pending_invites RPC for invite inbox
-- 3. accept_invite RPC for joining a group via invite
-- 4. decline_invite RPC for rejecting an invite (hard delete for re-invite support)

-- ============================================================================
-- PART 1: RLS policy for invite inbox SELECT
-- ============================================================================
-- Allows a user to see pending_members rows where they are the invited user
-- (user_id column), regardless of whether they are in group_members yet.
-- This is secure because user_id is set by the server-side add_pending_member
-- RPC and the auto-link trigger -- the client cannot set it.

create policy "Users can view their own pending invites"
  on public.pending_members for select
  using (user_id = (select auth.uid()));

-- ============================================================================
-- PART 2: get_my_pending_invites RPC
-- ============================================================================
-- Returns pending invites for the authenticated user with group name and
-- inviter name. Uses security definer to bypass RLS on groups table (invited
-- user is not yet a group member, so groups RLS would block the join).

create or replace function public.get_my_pending_invites()
returns table(
  pending_member_id uuid,
  group_id uuid,
  group_name text,
  invited_by_name text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    pm.id as pending_member_id,
    pm.group_id,
    g.name as group_name,
    coalesce(u.display_name, 'Someone') as invited_by_name
  from pending_members pm
  join groups g on g.id = pm.group_id
  join users u on u.id = pm.added_by
  where pm.user_id = current_user_id
    and pm.invite_status = 'pending';
end;
$$;

-- ============================================================================
-- PART 3: accept_invite RPC
-- ============================================================================
-- Atomically: validates ownership, adds user to group_members, transfers
-- expense splits from pending_member_id to user_id, deletes pending_members
-- row, and returns group_id for client-side navigation.

create or replace function public.accept_invite(
  p_pending_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  v_group_id uuid;
  v_user_id uuid;
  v_invite_status text;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Fetch and validate the pending member row
  select group_id, user_id, invite_status
  into v_group_id, v_user_id, v_invite_status
  from pending_members
  where id = p_pending_member_id;

  if v_group_id is null then
    raise exception 'Invite not found';
  end if;

  if v_user_id != current_user_id then
    raise exception 'This invite is not for you';
  end if;

  if v_invite_status != 'pending' then
    raise exception 'This invite has already been %', v_invite_status;
  end if;

  -- Add to group (idempotent -- handles edge case where user joined via
  -- invite link while phone invite was pending)
  insert into group_members (group_id, user_id)
  values (v_group_id, current_user_id)
  on conflict (group_id, user_id) do nothing;

  -- Transfer expense splits from pending member to real user
  -- Single UPDATE satisfies expense_splits_member_check constraint
  update expense_splits
  set user_id = current_user_id, pending_member_id = null
  where pending_member_id = p_pending_member_id;

  -- Hard delete the pending member row
  delete from pending_members where id = p_pending_member_id;

  return v_group_id;
end;
$$;

-- ============================================================================
-- PART 4: decline_invite RPC
-- ============================================================================
-- Deletes expense splits for the pending member and hard-deletes the
-- pending_members row. Hard delete allows the group creator to re-invite
-- the same phone number later.

create or replace function public.decline_invite(
  p_pending_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  v_user_id uuid;
  v_invite_status text;
begin
  -- Auth check
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Fetch and validate the pending member row
  select user_id, invite_status
  into v_user_id, v_invite_status
  from pending_members
  where id = p_pending_member_id;

  if v_user_id is null then
    raise exception 'Invite not found';
  end if;

  if v_user_id != current_user_id then
    raise exception 'This invite is not for you';
  end if;

  if v_invite_status != 'pending' then
    raise exception 'This invite has already been %', v_invite_status;
  end if;

  -- Delete expense splits for this pending member (INV-07: balances recalculate)
  delete from expense_splits
  where pending_member_id = p_pending_member_id;

  -- Hard delete the pending member row (allows re-invite by creator later)
  delete from pending_members where id = p_pending_member_id;
end;
$$;
