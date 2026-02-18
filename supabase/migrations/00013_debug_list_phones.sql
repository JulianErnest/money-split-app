-- Debug: list all phone formats in public.users and auth.users
create or replace function public.debug_list_phones()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'public_users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'phone_number', u.phone_number,
        'phone_length', length(u.phone_number),
        'phone_bytes', encode(u.phone_number::bytea, 'hex')
      ))
      from users u
      limit 10
    ), '[]'::jsonb),
    'auth_users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', au.id,
        'phone', au.phone,
        'phone_length', length(au.phone),
        'phone_bytes', encode(au.phone::bytea, 'hex')
      ))
      from auth.users au
      limit 10
    ), '[]'::jsonb),
    'pending_members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'phone_number', pm.phone_number,
        'phone_length', length(pm.phone_number),
        'group_id', pm.group_id
      ))
      from pending_members pm
      limit 10
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
