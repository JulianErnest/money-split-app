-- Group card enrichment RPC: member display info and last activity per group
--
-- Returns one row per group the caller belongs to, containing:
-- - member_count (total members)
-- - first 4 members' IDs, display names, and avatar URLs
-- - last activity timestamp (most recent expense or settlement)

create or replace function public.get_group_card_data()
returns table(
  group_id uuid,
  member_count integer,
  member_ids uuid[],
  member_names text[],
  member_avatars text[],
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with my_groups as (
    select gm.group_id
    from group_members gm
    where gm.user_id = current_user_id
  ),
  ranked_members as (
    select
      gm.group_id,
      gm.user_id,
      coalesce(u.display_name, 'Unknown') as display_name,
      u.avatar_url,
      row_number() over (partition by gm.group_id order by gm.joined_at) as rn
    from group_members gm
    join users u on u.id = gm.user_id
    where gm.group_id in (select mg.group_id from my_groups mg)
  ),
  group_member_agg as (
    select
      rm.group_id,
      count(*)::integer as member_count,
      array_agg(rm.user_id order by rm.rn) filter (where rm.rn <= 4) as member_ids,
      array_agg(rm.display_name order by rm.rn) filter (where rm.rn <= 4) as member_names,
      array_agg(rm.avatar_url order by rm.rn) filter (where rm.rn <= 4) as member_avatars
    from ranked_members rm
    group by rm.group_id
  ),
  last_activities as (
    select
      a.group_id,
      max(a.created_at) as last_activity_at
    from (
      select e.group_id, e.created_at
      from expenses e
      where e.group_id in (select mg.group_id from my_groups mg)
      union all
      select s.group_id, s.created_at
      from settlements s
      where s.group_id in (select mg.group_id from my_groups mg)
    ) a
    group by a.group_id
  )
  select
    mg.group_id,
    coalesce(gma.member_count, 0)::integer as member_count,
    coalesce(gma.member_ids, '{}') as member_ids,
    coalesce(gma.member_names, '{}') as member_names,
    coalesce(gma.member_avatars, '{}') as member_avatars,
    la.last_activity_at
  from my_groups mg
  left join group_member_agg gma on gma.group_id = mg.group_id
  left join last_activities la on la.group_id = mg.group_id;
end;
$$;
