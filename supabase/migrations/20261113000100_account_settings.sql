-- =========================================================
-- 退会・パスワード変更（アプリ側）・部屋の削除と一斉退出・ユーザー検索・
-- プロフィールの公開範囲・自己紹介
-- =========================================================

-- ---------------------------------------------------------
-- プロフィール：自己紹介と公開範囲
-- ---------------------------------------------------------
alter table public.profiles
  add column bio          text    not null default '' check (char_length(bio) <= 500),
  add column is_public    boolean not null default true,
  add column stats_public boolean not null default true;

comment on column public.profiles.is_public is 'false ならプロフィールページと検索から隠す（部屋の中では見える）';
comment on column public.profiles.stats_public is 'false ならプロフィールの学習統計を本人以外に見せない';

-- 非公開のプロフィールは、本人以外は読めない
-- （部屋の在室表示は Presence、入室前画面や申請一覧は security definer 関数で名前を出すので影響しない）
drop policy "profiles: authenticated can read" on public.profiles;
create policy "profiles: public or self"
  on public.profiles for select
  to authenticated
  using (is_public or id = (select auth.uid()));

grant update (display_name, bio, is_public, stats_public) on public.profiles to authenticated;

-- 表示名・自己紹介にも NG ワードを効かせる
create or replace function public.check_profile_ng_words()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.contains_ng_word(new.display_name) or public.contains_ng_word(new.bio) then
    raise exception 'ng_word_profile';
  end if;
  return new;
end;
$$;

create trigger profiles_check_ng_words
  before update of display_name, bio on public.profiles
  for each row execute function public.check_profile_ng_words();

-- 解放済みアイテムも、非公開の人のものは本人以外に見せない
drop policy "unlocks: authenticated can read" on public.unlocks;
create policy "unlocks: public profile or self"
  on public.unlocks for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = unlocks.user_id and p.is_public)
  );

-- 統計：非公開の人・統計を隠している人は、本人以外には返さない
create or replace function public.can_view_stats(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id = auth.uid()
      or exists (select 1 from public.profiles where id = p_user_id and is_public and stats_public);
$$;

revoke execute on function public.can_view_stats(uuid) from public, anon;
grant execute on function public.can_view_stats(uuid) to authenticated;

-- get_profile_stats の先頭で can_view_stats を確かめる（中身は前のマイグレーションと同じ）
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.get_profile_stats(text)'::regprocedure) into v_src;
  v_src := replace(v_src,
    '  if v_user is null then
    return null;
  end if;',
    '  if v_user is null or not public.can_view_stats(v_user) then
    return null;
  end if;');
  execute v_src;
end;
$$;

-- ---------------------------------------------------------
-- ユーザー検索（公開している人だけ。ユーザーIDか表示名の部分一致）
-- ---------------------------------------------------------
create or replace function public.search_users(p_query text, p_limit int default 20)
returns table (username text, display_name text, bio text, avatar jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p,
           btrim(coalesce(p_query, '')) as raw
  )
  select pr.username, pr.display_name, left(pr.bio, 120), public.avatar_json(pr.id)
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

-- ---------------------------------------------------------
-- 部屋の削除（オーナーのみ）。記録は残し、部屋は一覧・検索・招待URLから消す
-- ---------------------------------------------------------
alter table public.rooms add column deleted_at timestamptz;

-- 退会したオーナーの部屋は、閉じてオーナーなしで残す（ほかの人の記録を消さないため）
alter table public.rooms alter column owner_id drop not null;
alter table public.rooms drop constraint rooms_owner_id_fkey;
alter table public.rooms
  add constraint rooms_owner_id_fkey foreign key (owner_id) references public.profiles (id) on delete set null;

-- 部屋にいる全員（p_except を除く）のセッションを閉じる。戻り値は閉じた人数
create or replace function public.close_room_sessions_internal(p_room_id uuid, p_except uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count int := 0;
begin
  for v_id in
    select id from public.study_sessions
    where room_id = p_room_id and ended_at is null and user_id is distinct from p_except
  loop
    perform public.close_session_internal(v_id, now());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.close_room_sessions_internal(uuid, uuid) from public, anon, authenticated;

-- 一斉退出（オーナー・モデレーター）：自分以外の全員を退室させる
create or replace function public.evacuate_room(p_room_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  perform 1 from public.rooms where id = p_room_id for update;
  return public.close_room_sessions_internal(p_room_id, auth.uid());
end;
$$;

create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms where id = p_room_id and owner_id = auth.uid() and deleted_at is null) then
    raise exception 'owner_only';
  end if;
  perform 1 from public.rooms where id = p_room_id for update;
  perform public.close_room_sessions_internal(p_room_id, null);
  update public.rooms
  set deleted_at = now(), closed_at = coalesce(closed_at, now())
  where id = p_room_id;
end;
$$;

revoke execute on function public.evacuate_room(uuid), public.delete_room(uuid) from public, anon;
grant execute on function public.evacuate_room(uuid), public.delete_room(uuid) to authenticated;

-- 削除された部屋は、入室前画面・招待URLから見えなくする
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.get_room_preview(uuid, text)'::regprocedure) into v_src;
  v_src := replace(v_src,
    '  select * into v_room from public.rooms where id = p_room_id;
  if not found then',
    '  select * into v_room from public.rooms where id = p_room_id and deleted_at is null;
  if not found then');
  execute v_src;

  select pg_get_functiondef('public.get_room_by_invite(text)'::regprocedure) into v_src;
  v_src := replace(v_src, 'and r.closed_at is null', 'and r.closed_at is null and r.deleted_at is null');
  execute v_src;
end;
$$;

-- 記録の一覧：削除された部屋は名前を出さない
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
         s.task, s.note, r.id,
         case when r.deleted_at is null then r.name else '削除された部屋' end,
         case when r.deleted_at is null then r.icon else '🗑️' end
  from public.study_sessions s
  join public.rooms r on r.id = s.room_id
  where s.user_id = auth.uid()
    and s.ended_at is not null
    and public.session_minutes(s.started_at, s.ended_at) >= 1
    and (p_before is null or s.started_at < p_before)
  order by s.started_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- ---------------------------------------------------------
-- 退会。確認のためユーザーIDを入力してもらう。
-- 自分がオーナーの部屋は閉じ（いる人は退室させ）、オーナーなしで残す。
-- 自分の記録・アバター・メンバー情報などは auth.users の削除で一緒に消える
-- ---------------------------------------------------------
create or replace function public.delete_my_account(p_confirm_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and username = lower(btrim(coalesce(p_confirm_username, '')))) then
    raise exception 'confirm_mismatch';
  end if;

  for v_room in select id from public.rooms where owner_id = v_uid and closed_at is null loop
    perform public.close_room_sessions_internal(v_room, null);
    update public.rooms set closed_at = now() where id = v_room;
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
