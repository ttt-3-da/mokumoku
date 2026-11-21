-- =========================================================
-- 1) ToDo のチェックを RPC（POST）でつける
--    Mac の Safari で、todos への PATCH が事前の確認（OPTIONS）のあと送られず、チェックがつけられない人がいた
--    （追加の POST・消す DELETE は届いていた）。PATCH を使わずに済むよう RPC にする。
--    終わった時刻もサーバーの時計で入れる（端末の時計のずれを持ちこまない）
-- 2) 運営が、みんなの投稿に「運営が確認しました」の印をつけられる（つけると投稿した人にお知らせ）
-- =========================================================

create or replace function public.set_todo_done(p_id uuid, p_done boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done_at timestamptz;
begin
  update public.todos
     set done_at = case when p_done then coalesce(done_at, now()) end
   where id = p_id and user_id = auth.uid()
  returning done_at into v_done_at;
  if not found then
    raise exception 'todo_not_found';
  end if;
  return v_done_at;
end;
$$;
revoke execute on function public.set_todo_done(uuid, boolean) from public, anon;
grant execute on function public.set_todo_done(uuid, boolean) to authenticated;

-- ---------------------------------------------------------
-- 運営の確認の印
-- ---------------------------------------------------------
alter table public.posts add column staff_checked_at timestamptz;
comment on column public.posts.staff_checked_at is '運営が「確認しました」の印をつけた時刻（みんなに見える）';

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule', 'mochi_stamp', 'post_reaction',
                  'feedback_request', 'feedback_reply', 'announcement', 'post_checked'));

create or replace function public.admin_set_post_checked(p_post_id uuid, p_checked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_body text;
  v_was  timestamptz;
begin
  perform public.require_admin();
  select user_id, body, staff_checked_at into v_user, v_body, v_was from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'post_not_found';
  end if;
  update public.posts set staff_checked_at = case when p_checked then coalesce(staff_checked_at, now()) end
   where id = p_post_id;
  -- はじめて印をつけたときだけ、投稿した人に知らせる（自分の投稿には送らない）
  if p_checked and v_was is null and v_user <> auth.uid() then
    insert into public.notifications (user_id, kind, detail)
    values (v_user, 'post_checked', left(coalesce(nullif(btrim(v_body), ''), ''), 60));
  end if;
  return p_checked;
end;
$$;
revoke execute on function public.admin_set_post_checked(uuid, boolean) from public, anon;
grant execute on function public.admin_set_post_checked(uuid, boolean) to authenticated;

-- list_posts に「運営が確認したか」を足す（返す列が変わるので作り直す）
drop function public.list_posts(text, timestamptz, int);
create function public.list_posts(p_tab text default 'following', p_before timestamptz default null, p_limit int default 20)
returns table (
  id uuid, body text, created_at timestamptz, todos_done int,
  minutes int, task text, pomodoros int, room_name text, room_icon text,
  username text, display_name text, avatar jsonb, mine boolean, reactions jsonb,
  staff_checked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.body, p.created_at, p.todos_done,
    public.session_minutes(s.started_at, s.ended_at), s.task, s.pomodoros,
    case when public.can_view_room(r.id) then r.name end,
    case when public.can_view_room(r.id) then r.icon end,
    pr.username, pr.display_name, public.avatar_json(pr.id),
    p.user_id = auth.uid(),
    coalesce((
      select jsonb_agg(jsonb_build_object('stamp_id', x.stamp_id, 'count', x.cnt, 'reacted', x.mine) order by x.stamp_id)
      from (
        select rx.stamp_id, count(*)::int as cnt, bool_or(rx.user_id = auth.uid()) as mine
        from public.post_reactions rx
        join public.profiles rp on rp.id = rx.user_id
        where rx.post_id = p.id and rp.suspended_at is null and not public.is_blocked_between(auth.uid(), rx.user_id)
        group by rx.stamp_id
      ) x
    ), '[]'::jsonb),
    p.staff_checked_at is not null
  from public.posts p
  join public.profiles pr      on pr.id = p.user_id
  join public.study_sessions s on s.id = p.session_id
  join public.rooms r          on r.id = s.room_id
  where public.can_view_post_author(p.user_id)
    and (p_before is null or p.created_at < p_before)
    and (coalesce(p_tab, 'following') = 'all'
         or p.user_id = auth.uid()
         or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke execute on function public.list_posts(text, timestamptz, int) from public, anon;
grant execute on function public.list_posts(text, timestamptz, int) to authenticated;
