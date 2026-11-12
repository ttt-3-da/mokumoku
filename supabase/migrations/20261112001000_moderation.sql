-- =========================================================
-- Phase 11: モデレーション（キック・BAN・モデレーター任命・NGワード・通報）
-- =========================================================

-- ---------------------------------------------------------
-- NGワード。部屋名・説明文に含まれていたら作成・更新できない
-- 比較は「NFKC 正規化・小文字・空白と記号を除去」した文字列どうしで行う
-- （全角半角や大文字小文字、間にスペースを入れる回避を防ぐ）
-- 管理は SQL（Supabase の管理画面）で行う。クライアントからは読めない
-- ---------------------------------------------------------
create table public.ng_words (
  word       text primary key check (char_length(word) between 1 and 50),
  created_at timestamptz not null default now()
);

alter table public.ng_words enable row level security;
revoke all on public.ng_words from anon, authenticated;

create or replace function public.normalize_for_ng(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(normalize(coalesce(p_text, ''), NFKC)), '[[:space:][:punct:]・ー〜～！？。、「」『』（）]+', '', 'g');
$$;

insert into public.ng_words (word)
select public.normalize_for_ng(w) from unnest(array[
  -- ひらがなの短い語（「ばか」→「〜ばかり」など）は普通の言葉に誤反応するので入れない
  '死ね', '殺す', 'ころす', 'きもい', 'キモい', 'うざい', 'バカ',
  'fuck', 'shit', 'bitch',
  '出会い', '副業', '稼げる', '儲かる', 'line交換', 'カジノ'
]) as w
on conflict do nothing;

create or replace function public.contains_ng_word(p_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ng_words
    where public.normalize_for_ng(p_text) like '%' || word || '%'
  );
$$;

revoke execute on function public.contains_ng_word(text) from public, anon;
grant execute on function public.contains_ng_word(text) to authenticated;

create or replace function public.check_room_ng_words()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.contains_ng_word(new.name) or public.contains_ng_word(new.description) then
    raise exception 'ng_word';
  end if;
  return new;
end;
$$;

create trigger rooms_check_ng_words
  before insert or update of name, description on public.rooms
  for each row execute function public.check_room_ng_words();

-- ---------------------------------------------------------
-- キック・BAN の共通チェック
-- - 操作できるのはオーナー・モデレーター
-- - オーナーは対象にできない（BAN もできない）
-- - モデレーターどうしは操作できない（モデレーターを外せるのはオーナーだけ）
-- ---------------------------------------------------------
create or replace function public.assert_can_moderate(p_room_id uuid, p_target uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
  v_role public.member_role;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  if p_target = v_uid then
    raise exception 'cannot_target_self';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.owner_id = p_target then
    raise exception 'cannot_target_owner';
  end if;

  select role into v_role from public.room_members where room_id = p_room_id and user_id = p_target;
  if v_role = 'moderator' and v_room.owner_id <> v_uid then
    raise exception 'cannot_target_moderator';
  end if;
  return v_room;
end;
$$;

revoke execute on function public.assert_can_moderate(uuid, uuid) from public, anon, authenticated;

-- 対象者がその部屋にいればセッションを閉じる。ロックの順番は入室と同じ「ユーザー → 部屋」
create or replace function public.remove_from_room_internal(p_room_id uuid, p_target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  perform public.lock_user(p_target);
  perform 1 from public.rooms where id = p_room_id for update;

  select id into v_session_id from public.study_sessions
  where user_id = p_target and room_id = p_room_id and ended_at is null;

  if v_session_id is not null then
    perform public.close_session_internal(v_session_id, now());
  end if;
  return v_session_id;
end;
$$;

revoke execute on function public.remove_from_room_internal(uuid, uuid) from public, anon, authenticated;

-- キック：今いる部屋から退室させる（また入室はできる）
create or replace function public.kick_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_can_moderate(p_room_id, p_user_id);
  if public.remove_from_room_internal(p_room_id, p_user_id) is null then
    raise exception 'not_in_room';
  end if;
end;
$$;

-- BAN：退室させ、二度と入室できないようにする（メンバー・申請も取り消す）
create or replace function public.ban_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_can_moderate(p_room_id, p_user_id);
  perform public.remove_from_room_internal(p_room_id, p_user_id);
  insert into public.room_bans (room_id, user_id) values (p_room_id, p_user_id)
  on conflict do nothing;
  delete from public.room_members where room_id = p_room_id and user_id = p_user_id;
end;
$$;

create or replace function public.unban_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  delete from public.room_bans where room_id = p_room_id and user_id = p_user_id;
end;
$$;

create or replace function public.list_room_bans(p_room_id uuid)
returns table (user_id uuid, username text, display_name text, banned_at timestamptz)
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
    select b.user_id, p.username, p.display_name, b.banned_at
    from public.room_bans b
    join public.profiles p on p.id = b.user_id
    where b.room_id = p_room_id
    order by b.banned_at desc;
end;
$$;

-- モデレーターの任命・解除（オーナーのみ。対象は部屋のメンバー）
create or replace function public.set_moderator(p_room_id uuid, p_user_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms where id = p_room_id and owner_id = auth.uid()) then
    raise exception 'owner_only';
  end if;
  update public.room_members
  set role = case when p_on then 'moderator'::public.member_role else 'member'::public.member_role end
  where room_id = p_room_id and user_id = p_user_id and status = 'active' and role <> 'owner';
  if not found then
    raise exception 'not_member';
  end if;
end;
$$;

-- 在室者それぞれの役割（部屋の画面でオーナー・モデレーターの印を出すため）。入室中の人だけ呼べる
create or replace function public.list_room_roles(p_room_id uuid)
returns table (user_id uuid, role public.member_role)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.role
  from public.room_members m
  where m.room_id = p_room_id
    and m.status = 'active'
    and m.role in ('owner', 'moderator')
    and exists (select 1 from public.study_sessions s
                where s.room_id = p_room_id and s.user_id = auth.uid() and s.ended_at is null);
$$;

revoke execute on function public.kick_member(uuid, uuid), public.ban_member(uuid, uuid),
  public.unban_member(uuid, uuid), public.list_room_bans(uuid), public.set_moderator(uuid, uuid, boolean),
  public.list_room_roles(uuid) from public, anon;
grant execute on function public.kick_member(uuid, uuid), public.ban_member(uuid, uuid),
  public.unban_member(uuid, uuid), public.list_room_bans(uuid), public.set_moderator(uuid, uuid, boolean),
  public.list_room_roles(uuid) to authenticated;

-- ---------------------------------------------------------
-- 通報。部屋・ユーザー・投稿を対象にできる。
-- 本人は自分の通報だけ見られる。運営は Supabase の管理画面で確認する
-- ---------------------------------------------------------
create type public.report_target as enum ('room', 'user', 'post');

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      text not null default '' check (char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  -- 同じ相手を何度も通報できないようにする
  unique (reporter_id, target_type, target_id)
);

create index reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

create policy "reports: create own"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "reports: read own"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;
