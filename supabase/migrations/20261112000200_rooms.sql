-- =========================================================
-- Phase 2: rooms / room_members / room_bans
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

create type public.room_visibility as enum ('public', 'unlisted', 'approval');
create type public.timer_mode      as enum ('pomodoro', 'free');
create type public.member_role     as enum ('owner', 'moderator', 'member');
create type public.member_status   as enum ('active', 'pending');

-- タグ：最大5個、1つ1〜15文字、空白・カンマ・# を含まない
create or replace function public.valid_tags(p_tags text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(cardinality(p_tags), 0) <= 5
     and not exists (
       select 1 from unnest(p_tags) as t(tag)
       where char_length(t.tag) not between 1 and 15
          or t.tag ~ '[[:space:],#]'
     );
$$;

-- 招待コード：URLに使える72ビットのランダム文字列（12文字）
create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = public
as $$
  select translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
$$;

create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 40),
  description      text not null default '' check (char_length(description) <= 200),
  icon             text not null default '📚' check (char_length(icon) between 1 and 4),
  tags             text[] not null default '{}' check (public.valid_tags(tags)),
  visibility       public.room_visibility not null default 'public',
  capacity         int not null default 10 check (capacity between 2 and 20),
  timer_mode       public.timer_mode not null default 'pomodoro',
  focus_minutes    int not null default 25 check (focus_minutes between 5 and 90),
  break_minutes    int not null default 5 check (break_minutes between 1 and 30),
  timer_started_at timestamptz,
  is_persistent    boolean not null default true,
  invite_code      text not null unique default public.generate_invite_code(),
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);

create index rooms_public_open_idx on public.rooms (created_at desc)
  where closed_at is null and visibility = 'public';
create index rooms_tags_idx  on public.rooms using gin (tags);
create index rooms_owner_idx on public.rooms (owner_id);

create table public.room_members (
  room_id         uuid not null references public.rooms (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            public.member_role not null default 'member',
  status          public.member_status not null default 'active',
  joined_at       timestamptz not null default now(),
  last_entered_at timestamptz,
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id, last_entered_at desc);

create table public.room_bans (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  banned_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- ---------------------------------------------------------
-- 権限チェック用のヘルパー
-- rooms と room_members の RLS がお互いを参照すると無限再帰になるため、
-- security definer 関数にして RLS を通さずに判定する
-- ---------------------------------------------------------
create or replace function public.is_active_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid() and status = 'active'
  );
$$;

-- オーナー or モデレーター
create or replace function public.is_room_staff(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid()
      and status = 'active' and role in ('owner', 'moderator')
  );
$$;

-- RLS の rooms 閲覧条件と同じ判定（security definer 関数の中で使う）
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
      and (r.visibility = 'public' or r.owner_id = auth.uid() or public.is_active_member(r.id))
  );
$$;

revoke execute on function public.is_active_member(uuid), public.is_room_staff(uuid), public.can_view_room(uuid)
  from public, anon;
grant execute on function public.is_active_member(uuid), public.is_room_staff(uuid), public.can_view_room(uuid)
  to authenticated;

-- ---------------------------------------------------------
-- 部屋を作ったらオーナーを room_members に登録する
-- ---------------------------------------------------------
create or replace function public.handle_new_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  return new;
end;
$$;

revoke execute on function public.handle_new_room() from public, anon, authenticated;

create trigger on_room_created
  after insert on public.rooms
  for each row execute function public.handle_new_room();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.room_bans    enable row level security;

-- rooms：公開部屋、自分がオーナーの部屋、自分が active メンバーの部屋だけ閲覧可
create policy "rooms: visible rooms"
  on public.rooms for select
  to authenticated
  using (
    visibility = 'public'
    or owner_id = (select auth.uid())
    or public.is_active_member(id)
  );

create policy "rooms: create as owner"
  on public.rooms for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "rooms: owner can update"
  on public.rooms for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 列権限：invite_code / timer_started_at / closed_at などはクライアントから書けない
revoke all on public.rooms from anon, authenticated;
grant select on public.rooms to authenticated;
grant insert (owner_id, name, description, icon, tags, visibility, capacity,
              timer_mode, focus_minutes, break_minutes, is_persistent)
  on public.rooms to authenticated;
grant update (name, description, icon, tags, visibility, capacity,
              timer_mode, focus_minutes, break_minutes, is_persistent)
  on public.rooms to authenticated;

-- room_members：自分の行と、自分がスタッフの部屋の行だけ見える。書き込みは RPC のみ
create policy "room_members: self or staff"
  on public.room_members for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_room_staff(room_id));

revoke all on public.room_members from anon, authenticated;
grant select on public.room_members to authenticated;

-- room_bans：本人とスタッフだけ見える。書き込みは RPC のみ（フェーズ11）
create policy "room_bans: self or staff"
  on public.room_bans for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_room_staff(room_id));

revoke all on public.room_bans from anon, authenticated;
grant select on public.room_bans to authenticated;
