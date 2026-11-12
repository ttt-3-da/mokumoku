-- =========================================================
-- Phase 4: posts / post_reactions / create_post / list_timeline
-- =========================================================

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null unique references public.study_sessions (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_user_idx    on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;

create policy "posts: authenticated can read"
  on public.posts for select
  to authenticated
  using (true);

-- 書き込みは create_post RPC のみ
revoke all on public.posts from anon, authenticated;
grant select on public.posts to authenticated;

-- ---------------------------------------------------------
-- リアクション（スタンプと同じ4種類）。自分の分だけ付け外しできる
-- ---------------------------------------------------------
create table public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('👏', '🔥', '☕', '💪')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

alter table public.post_reactions enable row level security;

create policy "post_reactions: authenticated can read"
  on public.post_reactions for select
  to authenticated
  using (true);

create policy "post_reactions: add own"
  on public.post_reactions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "post_reactions: remove own"
  on public.post_reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.post_reactions from anon, authenticated;
grant select, delete on public.post_reactions to authenticated;
grant insert (post_id, user_id, emoji) on public.post_reactions to authenticated;

-- ---------------------------------------------------------
-- 投稿 RPC：本人の、終了済みで1分以上のセッションだけ。1セッション1回まで
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
  if char_length(v_body) > 280 then
    raise exception 'invalid_body';
  end if;

  select * into v_session from public.study_sessions
  where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'session_not_found';
  end if;
  if v_session.ended_at is null then
    raise exception 'session_not_ended';
  end if;
  if public.session_minutes(v_session.started_at, v_session.ended_at) < 1 then
    raise exception 'too_short';
  end if;

  insert into public.posts (user_id, session_id, body)
  values (v_uid, v_session.id, v_body)
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
-- タイムライン：投稿＋学習時間＋部屋＋リアクション集計を1回で返す
-- 部屋名は「その部屋を閲覧できる人」にだけ見せる（限定部屋の名前を漏らさない）
-- p_before より古い投稿を返す（無限スクロール用のカーソル）
-- ---------------------------------------------------------
create or replace function public.list_timeline(
  p_before timestamptz default null,
  p_limit int default 20,
  p_username text default null
)
returns table (
  id uuid, body text, created_at timestamptz, username text, display_name text,
  task text, minutes int, pomodoros int, room_name text, room_icon text, reactions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.body, p.created_at, pr.username, pr.display_name,
    s.task,
    public.session_minutes(s.started_at, s.ended_at),
    s.pomodoros,
    case when public.can_view_room(r.id) then r.name end,
    case when public.can_view_room(r.id) then r.icon end,
    coalesce((
      select jsonb_agg(jsonb_build_object('emoji', x.emoji, 'count', x.cnt, 'reacted', x.mine))
      from (
        select pr2.emoji, count(*) as cnt, bool_or(pr2.user_id = auth.uid()) as mine
        from public.post_reactions pr2
        where pr2.post_id = p.id
        group by pr2.emoji
      ) x
    ), '[]'::jsonb)
  from public.posts p
  join public.profiles pr      on pr.id = p.user_id
  join public.study_sessions s on s.id = p.session_id
  join public.rooms r          on r.id = s.room_id
  where auth.uid() is not null
    and (p_before is null or p.created_at < p_before)
    and (p_username is null or pr.username = lower(p_username))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.list_timeline(timestamptz, int, text) from public, anon;
grant execute on function public.list_timeline(timestamptz, int, text) to authenticated;
