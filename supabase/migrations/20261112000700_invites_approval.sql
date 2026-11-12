-- =========================================================
-- Phase 8: 招待URL・限定部屋・承認制
-- =========================================================

-- 承認制の部屋もロビーに出す（見つけた人が申請できるように）。部屋名もタイムラインで見せてよい
create or replace function public.can_view_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (r.visibility in ('public', 'approval') or r.owner_id = auth.uid() or public.is_active_member(r.id))
  );
$$;

create or replace function public.list_public_rooms(
  p_query text default null,
  p_tag text default null,
  p_limit int default 60
)
returns table (
  id uuid, name text, icon text, tags text[], visibility public.room_visibility,
  capacity int, timer_mode public.timer_mode, focus_minutes int, break_minutes int,
  timer_started_at timestamptz, is_persistent boolean, active_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select nullif(btrim(p_query), '') as text,
           nullif(btrim(p_tag), '') as tag
  ), pattern as (
    select '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p, q.tag
    from q
  )
  select r.id, r.name, r.icon, r.tags, r.visibility, r.capacity, r.timer_mode,
         r.focus_minutes, r.break_minutes, r.timer_started_at, r.is_persistent,
         (select count(*) from public.study_sessions s
           where s.room_id = r.id and s.ended_at is null)::int as active_count
  from public.rooms r, pattern
  where auth.uid() is not null
    and r.visibility in ('public', 'approval')
    and r.closed_at is null
    and (pattern.p is null or r.name ilike pattern.p or r.description ilike pattern.p)
    and (pattern.tag is null or pattern.tag = any (r.tags))
  order by active_count desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;

-- ---------------------------------------------------------
-- 招待コード → 部屋ID。限定部屋は RLS で見えないので security definer で引く
-- ---------------------------------------------------------
create or replace function public.get_room_by_invite(p_invite_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id from public.rooms r
  where auth.uid() is not null
    and p_invite_code is not null
    and r.invite_code = p_invite_code
    and r.closed_at is null;
$$;

revoke execute on function public.get_room_by_invite(text) from public, anon;
grant execute on function public.get_room_by_invite(text) to authenticated;

-- ---------------------------------------------------------
-- 入室前画面用（招待コードを受け取れるように作り直す）
-- 見せてよい条件：公開・承認制 / オーナー / メンバー（申請中を含む）/ 正しい招待コード
-- スタッフには招待コードと申請中の人数も返す
-- ---------------------------------------------------------
drop function public.get_room_preview(uuid);

create function public.get_room_preview(p_room_id uuid, p_invite_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_room   public.rooms;
  v_status public.member_status;
  v_role   public.member_role;
  v_staff  boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    return null;
  end if;

  select status, role into v_status, v_role from public.room_members
  where room_id = p_room_id and user_id = v_uid;

  if not coalesce(
       v_room.visibility in ('public', 'approval')
    or v_room.owner_id = v_uid
    or v_status is not null
    or p_invite_code = v_room.invite_code,
    false) then
    return null;
  end if;

  v_staff := coalesce(v_room.owner_id = v_uid
                      or (v_status = 'active' and v_role in ('owner', 'moderator')), false);

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'owner_id', v_room.owner_id, 'name', v_room.name,
      'description', v_room.description, 'icon', v_room.icon, 'tags', to_jsonb(v_room.tags),
      'visibility', v_room.visibility, 'capacity', v_room.capacity,
      'timer_mode', v_room.timer_mode, 'focus_minutes', v_room.focus_minutes,
      'break_minutes', v_room.break_minutes, 'timer_started_at', v_room.timer_started_at,
      'is_persistent', v_room.is_persistent, 'closed_at', v_room.closed_at,
      'active_count', (select count(*) from public.study_sessions
                       where room_id = v_room.id and ended_at is null)
    ),
    'occupants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', s.user_id, 'display_name', p.display_name, 'started_at', s.started_at,
               'avatar', public.avatar_json(s.user_id))
             order by s.started_at)
      from public.study_sessions s
      join public.profiles p on p.id = s.user_id
      where s.room_id = v_room.id and s.ended_at is null
    ), '[]'::jsonb),
    'is_member', coalesce(v_status = 'active', false),
    'is_pending', coalesce(v_status = 'pending', false),
    'is_staff', v_staff,
    'is_banned', exists (select 1 from public.room_bans where room_id = v_room.id and user_id = v_uid),
    'invite_code', case when v_staff then v_room.invite_code end,
    'pending_count', case when v_staff then
      (select count(*) from public.room_members where room_id = v_room.id and status = 'pending') end
  );
end;
$$;

revoke execute on function public.get_room_preview(uuid, text) from public, anon;
grant execute on function public.get_room_preview(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 承認：申請中の一覧・承認・却下（オーナー・モデレーターのみ）
-- ---------------------------------------------------------
create or replace function public.list_pending_members(p_room_id uuid)
returns table (user_id uuid, username text, display_name text, requested_at timestamptz, avatar jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  return query
    select m.user_id, p.username, p.display_name, m.joined_at, public.avatar_json(m.user_id)
    from public.room_members m
    join public.profiles p on p.id = m.user_id
    where m.room_id = p_room_id and m.status = 'pending'
    order by m.joined_at;
end;
$$;

create or replace function public.approve_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  update public.room_members set status = 'active'
  where room_id = p_room_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'request_not_found';
  end if;
end;
$$;

create or replace function public.reject_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  delete from public.room_members
  where room_id = p_room_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'request_not_found';
  end if;
end;
$$;

revoke execute on function public.list_pending_members(uuid), public.approve_member(uuid, uuid),
  public.reject_member(uuid, uuid) from public, anon;
grant execute on function public.list_pending_members(uuid), public.approve_member(uuid, uuid),
  public.reject_member(uuid, uuid) to authenticated;
