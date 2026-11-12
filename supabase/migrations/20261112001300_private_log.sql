-- =========================================================
-- タイムラインを「自分だけの学習記録」にする
-- - 退室したセッションはすべて自動で記録に残る（投稿する／しないの選択はなくす）
-- - 退室画面で任意の「メモ」を付けられる（study_sessions.note）
-- - 他人の記録は見えない（study_sessions の RLS は本人のみ）
-- - リアクションはなくす
-- =========================================================

alter table public.study_sessions
  add column note text not null default '' check (char_length(note) <= 280);

comment on column public.study_sessions.note is '退室後に付ける、自分だけのメモ';

-- これまでの投稿の「ひとこと」はメモとして引き継ぐ
update public.study_sessions s
set note = p.body
from public.posts p
where p.session_id = s.id;

drop function public.list_timeline(timestamptz, int, text);
drop function public.create_post(uuid, text);
drop table public.post_reactions;
drop table public.posts;

-- 投稿の通報はできなくなる（過去の通報は残す）
-- report_target の 'post' は既存データのために残しておく

-- ---------------------------------------------------------
-- メモの保存（本人の、退室済みのセッションだけ）
-- ---------------------------------------------------------
create or replace function public.set_session_note(p_session_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_note) > 280 then
    raise exception 'invalid_note';
  end if;

  update public.study_sessions
  set note = v_note
  where id = p_session_id and user_id = auth.uid() and ended_at is not null;

  if not found then
    if exists (select 1 from public.study_sessions where id = p_session_id and user_id = auth.uid()) then
      raise exception 'session_not_ended';
    end if;
    raise exception 'session_not_found';
  end if;
end;
$$;

revoke execute on function public.set_session_note(uuid, text) from public, anon;
grant execute on function public.set_session_note(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 自分の記録の一覧（1分以上のセッション）。p_before より前を新しい順に返す
-- 部屋名は、自分が入った部屋なので限定部屋でも表示する
-- ---------------------------------------------------------
create or replace function public.list_my_sessions(p_before timestamptz default null, p_limit int default 30)
returns table (
  id uuid, started_at timestamptz, ended_at timestamptz, minutes int, pomodoros int,
  task text, note text, room_id uuid, room_name text, room_icon text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.started_at, s.ended_at,
         public.session_minutes(s.started_at, s.ended_at), s.pomodoros,
         s.task, s.note, r.id, r.name, r.icon
  from public.study_sessions s
  join public.rooms r on r.id = s.room_id
  where s.user_id = auth.uid()
    and s.ended_at is not null
    and public.session_minutes(s.started_at, s.ended_at) >= 1
    and (p_before is null or s.started_at < p_before)
  order by s.started_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function public.list_my_sessions(timestamptz, int) from public, anon;
grant execute on function public.list_my_sessions(timestamptz, int) to authenticated;
