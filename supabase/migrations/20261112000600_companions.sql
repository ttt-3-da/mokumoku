-- =========================================================
-- Phase 7: 交流アニメーション用
-- 「同じ部屋で累計10時間以上一緒にいた相手」とは、隣に座ったときに顔を見合わせる。
-- 今その部屋にいる人どうしのペアのうち、同じ部屋でのセッションの重なりが
-- 合計600分以上のものを返す。呼べるのはその部屋に入室中の人だけ。
-- =========================================================

create or replace function public.get_room_companions(p_room_id uuid)
returns table (user_a uuid, user_b uuid)
language sql
stable
security definer
set search_path = public
as $$
  with present as (
    select user_id from public.study_sessions
    where room_id = p_room_id and ended_at is null
  ),
  allowed as (
    select 1 where exists (select 1 from present where user_id = auth.uid())
  ),
  sessions as (
    select s.user_id, s.started_at, coalesce(s.ended_at, now()) as ended_at
    from public.study_sessions s
    where s.room_id = p_room_id
      and s.user_id in (select user_id from present)
  )
  select a.user_id, b.user_id
  from sessions a
  join sessions b
    on a.user_id < b.user_id
   and a.started_at < b.ended_at
   and b.started_at < a.ended_at
  where exists (select 1 from allowed)
  group by a.user_id, b.user_id
  having sum(extract(epoch from least(a.ended_at, b.ended_at) - greatest(a.started_at, b.started_at))) >= 600 * 60;
$$;

revoke execute on function public.get_room_companions(uuid) from public, anon;
grant execute on function public.get_room_companions(uuid) to authenticated;
