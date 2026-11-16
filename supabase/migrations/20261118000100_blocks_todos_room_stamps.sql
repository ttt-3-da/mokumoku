-- =========================================================
-- ブロック・ToDoリスト・もちの部屋に置いていくスタンプ
-- =========================================================

-- ---------------------------------------------------------
-- ブロック
-- ブロックすると、おたがいのフォローが外れ、フォローも、もちの部屋に遊びに行くこともできなくなる。
-- 検索・お知らせ・自習室（もちとスタンプ）でも、おたがいが見えなくなる
-- ---------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;

-- どちらかがどちらかをブロックしているか
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

create or replace function public.block_user(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select id into v_target from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if v_target is null then
    raise exception 'user_not_found';
  end if;
  if v_target = v_uid then
    raise exception 'cannot_block_self';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, v_target) on conflict do nothing;
  delete from public.follows
  where (follower_id = v_uid and followee_id = v_target) or (follower_id = v_target and followee_id = v_uid);
end;
$$;

create or replace function public.unblock_user(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.blocks
  where blocker_id = auth.uid()
    and blocked_id = (select id from public.profiles where username = lower(btrim(coalesce(p_username, ''))));
end;
$$;

-- 自分がブロックしている人（設定の画面に出す）
create or replace function public.list_blocks()
returns table (username text, display_name text, avatar jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, p.display_name, public.avatar_json(p.id), b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- 自分がブロックしている人と、自分をブロックしている人（自習室で、おたがいを見えなくする）
create or replace function public.my_block_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

revoke execute on function public.block_user(text), public.unblock_user(text), public.list_blocks(), public.my_block_ids()
  from public, anon;
grant execute on function public.block_user(text), public.unblock_user(text), public.list_blocks(), public.my_block_ids()
  to authenticated;

-- フォロー：ブロックしている・されているとできない
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
  if public.is_blocked_between(v_uid, v_target.id) then
    raise exception 'blocked';
  end if;

  insert into public.follows (follower_id, followee_id) values (v_uid, v_target.id)
  on conflict do nothing;

  if found and not exists (
    select 1 from public.notifications
    where user_id = v_target.id and actor_id = v_uid and kind = 'follow' and read_at is null
  ) then
    insert into public.notifications (user_id, kind, actor_id) values (v_target.id, 'follow', v_uid);
  end if;
end;
$$;

-- プロフィール用：ブロックしているか・されているかも返す
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
    'follows_me', exists (select 1 from public.follows where follower_id = v_target and followee_id = v_uid),
    'blocking', exists (select 1 from public.blocks where blocker_id = v_uid and blocked_id = v_target),
    'blocked_by', exists (select 1 from public.blocks where blocker_id = v_target and blocked_id = v_uid)
  );
end;
$$;

-- ユーザー検索：ブロックしている・されている人は出さない
create or replace function public.search_users(p_query text, p_limit int default 20)
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
    and not public.is_blocked_between(auth.uid(), pr.id)
    and (pr.username ilike q.p or pr.display_name ilike q.p)
  order by (lower(pr.username) = lower(q.raw)) desc, pr.username
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------------------------------------------------------
-- お知らせ：もちの部屋にスタンプを置いていってもらった（mochi_stamp）を足す。
-- ブロックしている・されている人からのお知らせは出さない
-- ---------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule', 'mochi_stamp'));

create or replace function public.list_notifications(p_limit int default 50)
returns table (id uuid, kind text, created_at timestamptz, read_at timestamptz,
               actor_username text, actor_display_name text, actor_avatar jsonb, is_following boolean,
               room_id uuid, room_name text, room_icon text, detail text)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.kind, n.created_at, n.read_at, p.username, p.display_name,
         case when p.id is not null then public.avatar_json(p.id) end,
         coalesce(exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id), false),
         r.id, r.name, r.icon, n.detail
  from public.notifications n
  left join public.profiles p on p.id = n.actor_id
  left join public.rooms r    on r.id = n.room_id and r.deleted_at is null
  where n.user_id = auth.uid()
    and (n.actor_id is null or (p.is_public and not public.is_blocked_between(auth.uid(), n.actor_id)))
    and (n.kind <> 'schedule' or r.id is not null)
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
  left join public.profiles p on p.id = n.actor_id
  left join public.rooms r    on r.id = n.room_id and r.deleted_at is null
  where n.user_id = auth.uid() and n.read_at is null
    and (n.actor_id is null or (p.is_public and not public.is_blocked_between(auth.uid(), n.actor_id)))
    and (n.kind <> 'schedule' or r.id is not null);
$$;

-- ---------------------------------------------------------
-- ToDoリスト：やることを書いておき、終わったらチェックする。チェックしたものはずっと残る
-- ---------------------------------------------------------
create table public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 100),
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create index todos_user_idx on public.todos (user_id, done_at desc nulls first, created_at);

alter table public.todos enable row level security;

create policy "todos: own rows" on public.todos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.todos from anon, authenticated;
grant select, insert, delete on public.todos to authenticated;
grant update (title, done_at) on public.todos to authenticated;

-- まだ終わっていないものは 100 個まで
create or replace function public.todos_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.todos where user_id = new.user_id and done_at is null) >= 100 then
    raise exception 'too_many_todos';
  end if;
  return new;
end;
$$;

create trigger todos_limit before insert on public.todos
  for each row execute function public.todos_limit();

-- ---------------------------------------------------------
-- もちの部屋に置いていくスタンプ（遊びに来た人が置く。部屋の人と置いた人は消せる）
-- 位置は部屋の幅・高さに対する 0〜100。ID は src/lib/stamps.ts と一致させる
-- ---------------------------------------------------------
create table public.mochi_room_stamps (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  stamp_id   text not null,
  x          numeric(4, 1) not null check (x between 0 and 100),
  y          numeric(4, 1) not null check (y between 0 and 100),
  created_at timestamptz not null default now(),
  check (owner_id <> sender_id)
);

create index mochi_room_stamps_owner_idx on public.mochi_room_stamps (owner_id, created_at desc);

alter table public.mochi_room_stamps enable row level security;
revoke all on public.mochi_room_stamps from anon, authenticated;

create or replace function public.leave_mochi_stamp(p_username text, p_stamp_id text, p_x numeric, p_y numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner public.profiles;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_owner from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if not found or not v_owner.is_public or public.is_blocked_between(v_uid, v_owner.id) then
    raise exception 'user_not_found';
  end if;
  if v_owner.id = v_uid then
    raise exception 'cannot_stamp_self';
  end if;
  -- 非公開の人のスタンプは部屋の人に見えないので、置けないようにする
  if not public.is_public_profile(v_uid) then
    raise exception 'profile_private';
  end if;
  if p_stamp_id not in ('clap', 'ganbare', 'coffee', 'fight', 'nice', 'morning', 'night', 'otsukare', 'thanks', 'wow',
                        'wakaru', 'focus', 'pat', 'dango', 'heart', 'nebare', 'hanamaru', 'congrats', 'daruma', 'crown')
     or p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception 'invalid_stamp';
  end if;
  if p_stamp_id not in ('clap', 'ganbare')
     and not exists (select 1 from public.owned_items where user_id = v_uid and item_id = 'stamp:' || p_stamp_id) then
    raise exception 'item_locked';
  end if;
  -- 続けて置きすぎないように（同じ部屋には 10 秒に1つ）
  if exists (select 1 from public.mochi_room_stamps
             where owner_id = v_owner.id and sender_id = v_uid and created_at > now() - interval '10 seconds') then
    raise exception 'too_fast';
  end if;

  insert into public.mochi_room_stamps (owner_id, sender_id, stamp_id, x, y)
  values (v_owner.id, v_uid, p_stamp_id, round(p_x, 1), round(p_y, 1))
  returning id into v_id;

  -- 同じ人からの未読のお知らせがあれば増やさない
  if not exists (select 1 from public.notifications
                 where user_id = v_owner.id and actor_id = v_uid and kind = 'mochi_stamp' and read_at is null) then
    insert into public.notifications (user_id, kind, actor_id, detail) values (v_owner.id, 'mochi_stamp', v_uid, p_stamp_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.remove_mochi_stamp(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mochi_room_stamps
  where id = p_id and (owner_id = auth.uid() or sender_id = auth.uid());
$$;

revoke execute on function public.leave_mochi_stamp(text, text, numeric, numeric), public.remove_mochi_stamp(uuid) from public, anon;
grant execute on function public.leave_mochi_stamp(text, text, numeric, numeric), public.remove_mochi_stamp(uuid) to authenticated;

-- 部屋を見る：ブロックしている・されている人の部屋は見られない。置いていってもらったスタンプ（新しい 30 個）も返す
create or replace function public.get_mochi_room(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'is_me', p.id = auth.uid(),
    'wallpaper', coalesce(m.wallpaper, 'cream'),
    'items', coalesce(m.items, '[]'::jsonb),
    'avatar', public.avatar_json(p.id),
    'stamps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'stamp_id', s.stamp_id, 'x', s.x, 'y', s.y, 'created_at', s.created_at,
               'mine', s.sender_id = auth.uid(),
               'sender_username', sp.username, 'sender_display_name', sp.display_name,
               'sender_avatar', public.avatar_json(sp.id))
             order by s.created_at)
      from (
        select * from public.mochi_room_stamps x
        where x.owner_id = p.id
          and not public.is_blocked_between(auth.uid(), x.sender_id)
          and (public.is_public_profile(x.sender_id) or x.sender_id = auth.uid())
        order by x.created_at desc
        limit 30
      ) s
      join public.profiles sp on sp.id = s.sender_id
    ), '[]'::jsonb)
  )
  from public.profiles p
  left join public.mochi_rooms m on m.user_id = p.id
  where p.username = lower(btrim(p_username))
    and (p.is_public or p.id = auth.uid())
    and not public.is_blocked_between(auth.uid(), p.id)
    and auth.uid() is not null;
$$;
