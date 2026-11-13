-- =========================================================
-- フォロー・通知
-- - フォローは一方向。プロフィールを非公開にしている人はフォローできず、
--   一覧・「いま勉強中」・くらべる にも出ない（非公開の人自身はほかの人をフォローできる）
-- - フォローされたら通知を作る
-- =========================================================

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;

-- 自分が関わる行だけ読める。書き込みは RPC のみ
create policy "follows: own rows"
  on public.follows for select
  to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

revoke all on public.follows from anon, authenticated;
grant select on public.follows to authenticated;

-- ---------------------------------------------------------
-- 通知（今はフォローだけ）
-- ---------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('follow')),
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- 公開している人か
create or replace function public.is_public_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_public from public.profiles where id = p_user_id), false);
$$;

revoke execute on function public.is_public_profile(uuid) from public, anon;
grant execute on function public.is_public_profile(uuid) to authenticated;

-- ---------------------------------------------------------
-- フォローする・やめる
-- ---------------------------------------------------------
create or replace function public.follow_user(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_target public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_target from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if not found or not v_target.is_public then
    raise exception 'user_not_found';
  end if;
  if v_target.id = v_uid then
    raise exception 'cannot_follow_self';
  end if;

  insert into public.follows (follower_id, followee_id) values (v_uid, v_target.id)
  on conflict do nothing;

  -- 初めてフォローしたときだけ通知（付けたり外したりを繰り返しても通知が増えないように、
  -- 同じ人からの未読のフォロー通知があれば作らない）
  if found and not exists (
    select 1 from public.notifications
    where user_id = v_target.id and actor_id = v_uid and kind = 'follow' and read_at is null
  ) then
    insert into public.notifications (user_id, kind, actor_id) values (v_target.id, 'follow', v_uid);
  end if;
end;
$$;

create or replace function public.unfollow_user(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.follows
  where follower_id = auth.uid()
    and followee_id = (select id from public.profiles where username = lower(btrim(coalesce(p_username, ''))));
end;
$$;

-- ---------------------------------------------------------
-- プロフィール用：数と、自分がフォローしているか・されているか
-- 数えるのは公開している人どうしのフォローだけ
-- ---------------------------------------------------------
create or replace function public.get_follow_info(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_target uuid;
begin
  select id into v_target from public.profiles
  where username = lower(btrim(coalesce(p_username, ''))) and (is_public or id = v_uid);
  if v_target is null or v_uid is null then
    return null;
  end if;
  return jsonb_build_object(
    'followers', (select count(*) from public.follows f
                  where f.followee_id = v_target and public.is_public_profile(f.follower_id)),
    'following', (select count(*) from public.follows f
                  where f.follower_id = v_target and public.is_public_profile(f.followee_id)),
    'is_following', exists (select 1 from public.follows where follower_id = v_uid and followee_id = v_target),
    'follows_me', exists (select 1 from public.follows where follower_id = v_target and followee_id = v_uid)
  );
end;
$$;

-- フォロワー・フォロー中の一覧（公開している人だけ。見る相手が非公開なら本人以外には返さない）
create or replace function public.list_follows(p_username text, p_kind text)
returns table (username text, display_name text, bio text, avatar jsonb, is_following boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_target uuid;
begin
  if p_kind not in ('followers', 'following') then
    raise exception 'invalid_kind';
  end if;
  -- 戻り値の列名（username など）とぶつからないよう、テーブルに別名を付ける
  select pr.id into v_target from public.profiles pr
  where pr.username = lower(btrim(coalesce(p_username, ''))) and (pr.is_public or pr.id = v_uid);
  if v_target is null or v_uid is null then
    return;
  end if;

  return query
    select p.username, p.display_name, left(p.bio, 120), public.avatar_json(p.id),
           exists (select 1 from public.follows x where x.follower_id = v_uid and x.followee_id = p.id)
    from public.follows f
    join public.profiles p
      on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
    where (case when p_kind = 'followers' then f.followee_id else f.follower_id end) = v_target
      and p.is_public
    order by f.created_at desc
    limit 200;
end;
$$;

-- ---------------------------------------------------------
-- いま勉強中のフォロー中の人
-- 公開部屋なら部屋名と ID を出し、限定・承認制の部屋なら「勉強中」とだけ出す
-- ---------------------------------------------------------
create or replace function public.list_following_activity()
returns table (
  username text, display_name text, avatar jsonb, started_at timestamptz,
  room_id uuid, room_name text, room_icon text, task text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, p.display_name, public.avatar_json(p.id), s.started_at,
         case when r.visibility = 'public' then r.id end,
         case when r.visibility = 'public' then r.name end,
         case when r.visibility = 'public' then r.icon end,
         case when r.visibility = 'public' then s.task end
  from public.follows f
  join public.profiles p        on p.id = f.followee_id and p.is_public
  join public.study_sessions s  on s.user_id = p.id and s.ended_at is null
  join public.rooms r           on r.id = s.room_id and r.closed_at is null
  where f.follower_id = auth.uid()
  order by s.started_at;
$$;

-- ---------------------------------------------------------
-- くらべる：自分とフォロー中の人（統計を公開している人だけ）の今週の学習時間（月曜始まり・日本時間）
-- ---------------------------------------------------------
create or replace function public.follow_leaderboard()
returns table (username text, display_name text, avatar jsonb, week_minutes int, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with week as (
    select public.jst_date(now()) - (extract(isodow from public.jst_date(now()))::int - 1) as start
  ),
  people as (
    select auth.uid() as id
    union
    select f.followee_id from public.follows f
    join public.profiles p on p.id = f.followee_id and p.is_public and p.stats_public
    where f.follower_id = auth.uid()
  )
  select p.username, p.display_name, public.avatar_json(p.id),
         coalesce((
           select sum(public.session_minutes(s.started_at, s.ended_at))::int
           from public.study_sessions s, week
           where s.user_id = p.id and s.ended_at is not null and public.jst_date(s.started_at) >= week.start
         ), 0) as week_minutes,
         p.id = auth.uid()
  from people
  join public.profiles p on p.id = people.id
  where auth.uid() is not null
  order by week_minutes desc, p.username;
$$;

-- ---------------------------------------------------------
-- 通知：一覧・未読の数・既読にする
-- ---------------------------------------------------------
create or replace function public.list_notifications(p_limit int default 50)
returns table (id uuid, kind text, created_at timestamptz, read_at timestamptz,
               actor_username text, actor_display_name text, actor_avatar jsonb, is_following boolean)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.kind, n.created_at, n.read_at, p.username, p.display_name, public.avatar_json(p.id),
         exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from public.notifications n
  join public.profiles p on p.id = n.actor_id
  where n.user_id = auth.uid()
    and p.is_public
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.count_unread_notifications()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.notifications n
  join public.profiles p on p.id = n.actor_id and p.is_public
  where n.user_id = auth.uid() and n.read_at is null;
$$;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

revoke execute on function public.follow_user(text), public.unfollow_user(text), public.get_follow_info(text),
  public.list_follows(text, text), public.list_following_activity(), public.follow_leaderboard(),
  public.list_notifications(int), public.count_unread_notifications(), public.mark_notifications_read()
  from public, anon;
grant execute on function public.follow_user(text), public.unfollow_user(text), public.get_follow_info(text),
  public.list_follows(text, text), public.list_following_activity(), public.follow_leaderboard(),
  public.list_notifications(int), public.count_unread_notifications(), public.mark_notifications_read()
  to authenticated;

-- ---------------------------------------------------------
-- ユーザー検索に「自分がフォローしているか」を足す（戻り値の列が変わるので作り直す）
-- ---------------------------------------------------------
drop function public.search_users(text, int);

create function public.search_users(p_query text, p_limit int default 20)
returns table (username text, display_name text, bio text, avatar jsonb, is_following boolean)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p,
           btrim(coalesce(p_query, '')) as raw
  )
  select pr.username, pr.display_name, left(pr.bio, 120), public.avatar_json(pr.id),
         exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = pr.id)
  from public.profiles pr, q
  where auth.uid() is not null
    and char_length(q.raw) >= 1
    and pr.is_public
    and (pr.username ilike q.p or pr.display_name ilike q.p)
  order by (lower(pr.username) = lower(q.raw)) desc, pr.username
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.search_users(text, int) from public, anon;
grant execute on function public.search_users(text, int) to authenticated;