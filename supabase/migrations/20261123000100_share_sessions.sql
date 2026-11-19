-- =========================================================
-- 勉強の記録を X などでシェアする
-- 本人が「シェア」を押した記録だけ、ログインしていない人にも記録カード（/s/{id}）が見える。
-- 見えるのは表示名・もち・勉強した時間・ポモドーロの回数・終わらせた ToDo の数・日付だけ
-- （やったことや部屋の名前は出さない）。シェアはあとから止められる。
-- =========================================================

alter table public.study_sessions add column if not exists shared_at timestamptz;

-- シェアする（何度押しても同じ）
create or replace function public.share_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_session public.study_sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'suspended';
  end if;
  select * into v_session from public.study_sessions where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'session_not_found';
  end if;
  if v_session.ended_at is null then
    raise exception 'session_not_ended';
  end if;
  if public.session_minutes(v_session.started_at, v_session.ended_at) < 1 then
    raise exception 'too_short';
  end if;
  update public.study_sessions set shared_at = coalesce(shared_at, now()) where id = p_session_id;
end;
$$;
revoke execute on function public.share_session(uuid) from public, anon;
grant execute on function public.share_session(uuid) to authenticated;

-- シェアをやめる（リンクを開いても見えなくなる）
create or replace function public.unshare_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.study_sessions set shared_at = null where id = p_session_id and user_id = auth.uid();
$$;
revoke execute on function public.unshare_session(uuid) from public, anon;
grant execute on function public.unshare_session(uuid) to authenticated;

-- シェアされた記録カードの中身（ログインしていなくても読める）。シェアしていない・止めた・利用停止中なら null
create or replace function public.get_shared_session(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'display_name', p.display_name,
    'avatar', public.avatar_json(s.user_id),
    'minutes', public.session_minutes(s.started_at, s.ended_at),
    'pomodoros', s.pomodoros,
    'todos_done', (select count(*)::int from public.todos t
                   where t.user_id = s.user_id and t.done_at between s.started_at and s.ended_at),
    'ended_at', s.ended_at
  )
  from public.study_sessions s
  join public.profiles p on p.id = s.user_id
  where s.id = p_session_id
    and s.shared_at is not null
    and s.ended_at is not null
    and p.suspended_at is null;
$$;
revoke execute on function public.get_shared_session(uuid) from public;
grant execute on function public.get_shared_session(uuid) to anon, authenticated;
