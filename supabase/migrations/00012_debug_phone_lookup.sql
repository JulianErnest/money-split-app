-- Temporary debug function to diagnose phone lookup issue
-- Will be removed after debugging

create or replace function public.debug_phone_lookup(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  result jsonb;
  pub_id uuid;
  pub_phone text;
  auth_id uuid;
  auth_phone text;
  pending_count int;
begin
  -- Check public.users
  select u.id, u.phone_number into pub_id, pub_phone
  from users u
  where u.phone_number = p_phone;

  -- Check auth.users
  begin
    select au.id, au.phone into auth_id, auth_phone
    from auth.users au
    where au.phone = p_phone;
  exception when others then
    auth_id := null;
    auth_phone := 'ERROR: ' || sqlerrm;
  end;

  -- Check pending_members
  select count(*) into pending_count
  from pending_members
  where phone_number = p_phone;

  result := jsonb_build_object(
    'input_phone', p_phone,
    'public_users_id', pub_id,
    'public_users_phone', pub_phone,
    'auth_users_id', auth_id,
    'auth_users_phone', auth_phone,
    'pending_count', pending_count,
    'row_security_setting', current_setting('row_security')
  );

  return result;
end;
$$;
