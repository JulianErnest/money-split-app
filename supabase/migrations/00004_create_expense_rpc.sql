-- RPC function for atomic expense creation with split inserts
-- Uses security definer to bypass RLS for transactional operations

create or replace function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_amount numeric(10,2),
  p_paid_by uuid,
  p_split_type text,
  p_splits jsonb  -- array of { "user_id": uuid, "amount": numeric }
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

  -- Verify payer is a member of the group
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

  -- Insert splits from jsonb array
  insert into expense_splits (expense_id, user_id, amount)
  select
    new_expense_id,
    (elem->>'user_id')::uuid,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_splits) as elem;

  return new_expense_id;
end;
$$;
