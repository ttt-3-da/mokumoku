-- =========================================================
-- 管理：登録しているユーザーの一覧 / 部屋を作った人をだれでも見られるようにする
-- =========================================================

create or replace function public.admin_list_users()
returns table (
  id uuid, username text, display_name text, created_at timestamptz,
  is_admin boolean, is_public boolean, suspended_at timestamptz,
  last_country text, last_seen_at timestamptz, total_minutes int, rooms_owned int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.username, p.display_name, p.created_at,
         p.is_admin, p.is_public, p.suspended_at,
         a.last_country, a.last_seen_at,
         coalesce((select sum(public.session_minutes(s.started_at, coalesce(s.ended_at, now())))::int
                   from public.study_sessions s where s.user_id = p.id), 0),
         (select count(*)::int from public.rooms r where r.owner_id = p.id)
  from public.profiles p
  left join public.user_access a on a.user_id = p.id
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- 見てよい部屋の、作った人（オーナー）の名前
create or replace function public.room_owners(p_room_ids uuid[])
returns table (room_id uuid, username text, display_name text, is_official boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, p.username, p.display_name, p.is_admin
  from public.rooms r
  join public.profiles p on p.id = r.owner_id
  where r.id = any (p_room_ids[1:60])
    and public.can_view_room(r.id)
    and auth.uid() is not null;
$$;

revoke execute on function public.room_owners(uuid[]) from public, anon;
grant execute on function public.room_owners(uuid[]) to authenticated;
