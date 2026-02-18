-- Auto-link trigger: when a new user signs up via phone OTP, automatically claim
-- any pending_members records matching their phone number.
-- This atomically adds them to groups, transfers expense splits, and removes pending records.

create or replace function public.handle_pending_member_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending record;
begin
  -- Look up all pending members matching this phone number across all groups
  for pending in
    select id, group_id from pending_members
    where phone_number = new.phone
  loop
    begin
      -- Ensure public.users row exists (needed for group_members FK)
      -- Profile setup does an upsert later to fill in display_name
      insert into users (id, phone_number)
      values (new.id, new.phone)
      on conflict (id) do nothing;

      -- Add user to the group (idempotent -- handles case where user already joined)
      insert into group_members (group_id, user_id)
      values (pending.group_id, new.id)
      on conflict (group_id, user_id) do nothing;

      -- Transfer expense splits from pending to real user
      update expense_splits
      set user_id = new.id, pending_member_id = null
      where pending_member_id = pending.id;

      -- Remove the pending member entry (now fully claimed)
      delete from pending_members where id = pending.id;
    exception
      when others then
        -- Log but never block signup -- auth.users INSERT must succeed
        raise warning 'pending_member_claim failed for pending_id %, phone %: %',
          pending.id, new.phone, sqlerrm;
    end;
  end loop;

  return new;
exception
  when others then
    -- Outer catch: never block signup under any circumstances
    raise warning 'handle_pending_member_claim failed entirely for phone %: %',
      new.phone, sqlerrm;
    return new;
end;
$$;

-- Fire after insert on auth.users (when someone signs up)
create trigger on_auth_user_created_claim_pending
  after insert on auth.users
  for each row
  execute function public.handle_pending_member_claim();
