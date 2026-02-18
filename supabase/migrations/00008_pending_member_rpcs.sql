-- RPC: Add a pending member to a group by phone number
-- Handles: existing user detection, duplicate prevention, pending member creation

create or replace function public.add_pending_member(
  p_group_id uuid,
  p_phone_number text  -- Expected E.164 format: +639XXXXXXXXX
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_user_id uuid;
  new_pending_id uuid;
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

  -- Check if a user with this phone already exists
  select u.id into existing_user_id
  from users u
  where u.phone_number = p_phone_number;

  if existing_user_id is not null then
    -- User exists -- check if already a group member
    if exists (
      select 1 from group_members
      where group_id = p_group_id and user_id = existing_user_id
    ) then
      raise exception 'This person is already a member of this group';
    end if;

    -- User exists but not in group -- add them directly
    insert into group_members (group_id, user_id)
    values (p_group_id, existing_user_id);

    return existing_user_id;
  end if;

  -- Check if already a pending member in this group
  if exists (
    select 1 from pending_members
    where group_id = p_group_id and phone_number = p_phone_number
  ) then
    raise exception 'This phone number is already pending in this group';
  end if;

  -- Create pending member
  insert into pending_members (group_id, phone_number, added_by)
  values (p_group_id, p_phone_number, current_user_id)
  returning id into new_pending_id;

  return new_pending_id;
end;
$$;

-- Updated create_expense RPC: now supports pending_member_id in splits
-- Backward compatible -- existing calls with only user_id splits still work

create or replace function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_amount numeric(10,2),
  p_paid_by uuid,
  p_split_type text,
  p_splits jsonb  -- array of { "user_id": uuid, "amount": numeric } or { "pending_member_id": uuid, "amount": numeric }
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expense_id uuid;
  current_user_id uuid := auth.uid();
  split_record jsonb;
  splits_total numeric(10,2) := 0;
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

  -- Verify payer is a real member of the group (not pending)
  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = p_paid_by
  ) then
    raise exception 'Payer is not a member of this group';
  end if;

  -- Validate split type
  if p_split_type not in ('equal', 'custom') then
    raise exception 'Invalid split type: must be equal or custom';
  end if;

  -- Validate splits sum to total amount
  for split_record in select * from jsonb_array_elements(p_splits)
  loop
    splits_total := splits_total + (split_record->>'amount')::numeric;
  end loop;

  if splits_total != p_amount then
    raise exception 'Splits do not sum to total amount: expected %, got %', p_amount, splits_total;
  end if;

  -- Insert expense
  insert into expenses (group_id, description, amount, paid_by, split_type, created_by)
  values (p_group_id, p_description, p_amount, p_paid_by, p_split_type, current_user_id)
  returning id into new_expense_id;

  -- Insert splits from jsonb array (supports both user_id and pending_member_id)
  insert into expense_splits (expense_id, user_id, pending_member_id, amount)
  select
    new_expense_id,
    case when elem->>'user_id' is not null and elem->>'user_id' != ''
      then (elem->>'user_id')::uuid else null end,
    case when elem->>'pending_member_id' is not null and elem->>'pending_member_id' != ''
      then (elem->>'pending_member_id')::uuid else null end,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_splits) as elem;

  return new_expense_id;
end;
$$;
