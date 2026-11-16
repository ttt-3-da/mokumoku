-- =========================================================
-- 勉強の記録を投稿して、もちスタンプで反応できるようにする
-- - 退室したあと、本人が選んだときだけ投稿する（1回の勉強につき1回）
-- - 「フォロー中」「みんな」のタイムライン。非公開・利用停止・ブロックの相手の投稿は出さない
-- - 反応は、だれでも使える4つのもちスタンプだけ（ショップのスタンプは使えない）
-- - 反応されるとお知らせ（同じ人から同じ投稿へのものは、未読のうちは1件にまとめる）
-- =========================================================

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null unique references public.study_sessions (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 280),
  todos_done int  not null default 0 check (todos_done >= 0),
  created_at timestamptz not null default now()
);

comment on table public.posts is '本人が選んで投稿した勉強の記録';
comment on column public.posts.todos_done is 'その勉強のあいだに終わらせた ToDo の数（投稿したときに数える）';

create index posts_created_idx on public.posts (created_at desc);
create index posts_user_idx    on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;
-- 自分の投稿だけ直接読める（退室画面で「投稿済みか」を見るため）。ほかは list_posts で読む
create policy "posts: read own" on public.posts for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.posts from anon, authenticated;
grant select on public.posts to authenticated;

create table public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  stamp_id   text not null check (stamp_id in ('clap', 'ganbare', 'otsukare', 'wow')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, stamp_id)
);

alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from anon, authenticated;

-- ---------------------------------------------------------
-- その人の投稿を、いまの自分が見てよいか
-- ---------------------------------------------------------
create or replace function public.can_view_post_author(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.profiles p where p.id = p_author and p.is_public and p.suspended_at is null)
     and not public.is_blocked_between(auth.uid(), p_author);
$$;

revoke execute on function public.can_view_post_author(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 投稿する
-- ---------------------------------------------------------
create or replace function public.create_post(p_session_id uuid, p_body text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_body    text := btrim(coalesce(p_body, ''));
  v_session public.study_sessions;
  v_post_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and is_public and suspended_at is null) then
    raise exception 'post_private';
  end if;
  if char_length(v_body) > 280 then
    raise exception 'invalid_body';
  end if;
  if v_body <> '' and public.contains_ng_word(v_body) then
    raise exception 'ng_word_post';
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

  insert into public.posts (user_id, session_id, body, todos_done)
  values (v_uid, v_session.id, v_body,
          (select count(*)::int from public.todos t
           where t.user_id = v_uid and t.done_at between v_session.started_at and v_session.ended_at))
  on conflict (session_id) do nothing
  returning id into v_post_id;

  if v_post_id is null then
    raise exception 'already_posted';
  end if;
  return v_post_id;
end;
$$;

revoke execute on function public.create_post(uuid, text) from public, anon;
grant execute on function public.create_post(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 投稿を消す（本人か管理者）
-- ---------------------------------------------------------
create or replace function public.delete_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.posts where id = p_post_id and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'post_not_found';
  end if;
end;
$$;

revoke execute on function public.delete_post(uuid) from public, anon;
grant execute on function public.delete_post(uuid) to authenticated;

-- ---------------------------------------------------------
-- タイムライン。p_tab = 'following'（フォロー中＋自分）か 'all'（みんな）
-- p_before より古いものを返す（「もっと見る」用）
-- 部屋の名前は、その部屋を見られる人にだけ見せる
-- ---------------------------------------------------------
create or replace function public.list_posts(p_tab text default 'following', p_before timestamptz default null, p_limit int default 20)
returns table (
  id uuid, body text, created_at timestamptz, todos_done int,
  minutes int, task text, pomodoros int, room_name text, room_icon text,
  username text, display_name text, avatar jsonb, mine boolean, reactions jsonb
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
    ), '[]'::jsonb)
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

-- ---------------------------------------------------------
-- もちスタンプで反応する／取り消す。返り値は「いま押している状態か」
-- ---------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule', 'mochi_stamp', 'post_reaction'));

create or replace function public.toggle_post_reaction(p_post_id uuid, p_stamp_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
  v_detail text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_stamp_id is null or p_stamp_id not in ('clap', 'ganbare', 'otsukare', 'wow') then
    raise exception 'invalid_stamp';
  end if;
  select user_id into v_author from public.posts where id = p_post_id;
  if not found or not public.can_view_post_author(v_author) then
    raise exception 'post_not_found';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'not_authenticated';
  end if;

  delete from public.post_reactions where post_id = p_post_id and user_id = v_uid and stamp_id = p_stamp_id;
  if found then
    return false;
  end if;

  insert into public.post_reactions (post_id, user_id, stamp_id) values (p_post_id, v_uid, p_stamp_id);

  -- 自分の投稿でなければお知らせ。未読のうちは、同じ人から同じ投稿へのものを1件にまとめる
  if v_author <> v_uid then
    v_detail := p_post_id::text || ':' || p_stamp_id;
    update public.notifications set detail = v_detail, created_at = now()
    where user_id = v_author and actor_id = v_uid and kind = 'post_reaction' and read_at is null
      and detail like p_post_id::text || ':%';
    if not found then
      insert into public.notifications (user_id, kind, actor_id, detail) values (v_author, 'post_reaction', v_uid, v_detail);
    end if;
  end if;
  return true;
end;
$$;

revoke execute on function public.toggle_post_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 通報の一覧：投稿は、ひとことと書いた人を出す
-- ---------------------------------------------------------
create or replace function public.admin_list_reports(p_resolved boolean default false)
returns table (
  target_type public.report_target,
  target_id uuid,
  label text,
  link text,
  reasons text[],
  reporters text[],
  report_count int,
  last_reported_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return query
  select r.target_type, r.target_id,
         case r.target_type
           when 'room' then coalesce((select rm.icon || ' ' || rm.name || case when rm.deleted_at is not null then '（削除済み）' else '' end
                                      from public.rooms rm where rm.id = r.target_id), '（なくなった部屋）')
           when 'user' then coalesce((select p.display_name || '（@' || p.username || '）' || case when p.suspended_at is not null then '・利用停止中' else '' end
                                      from public.profiles p where p.id = r.target_id), '（退会した人）')
           else coalesce((select '「' || case when po.body = '' then '（ひとことなし）' else left(po.body, 60) end || '」 @' || pp.username
                          from public.posts po join public.profiles pp on pp.id = po.user_id where po.id = r.target_id), '（消された投稿）')
         end,
         case r.target_type
           when 'room' then '/rooms/' || r.target_id
           when 'user' then coalesce((select '/u/' || p.username from public.profiles p where p.id = r.target_id), '')
           else coalesce((select '/u/' || pp.username from public.posts po join public.profiles pp on pp.id = po.user_id where po.id = r.target_id), '')
         end,
         array_agg(r.reason order by r.created_at desc),
         array_agg(coalesce(rp.username, '？') order by r.created_at desc),
         count(*)::int,
         max(r.created_at),
         max(r.resolved_at)
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  where (r.resolved_at is not null) = p_resolved
  group by r.target_type, r.target_id
  order by max(r.created_at) desc
  limit 200;
end;
$$;
