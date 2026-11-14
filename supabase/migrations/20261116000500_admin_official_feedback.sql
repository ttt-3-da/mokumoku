-- =========================================================
-- 管理者（公式アカウント）・利用停止・予約したユーザーID・通報の対応・フィードバック
-- 管理者にするのは SQL エディタから public.make_official('ユーザーID') を実行したときだけ
-- （アプリからは管理者になれない）
-- =========================================================

alter table public.profiles
  add column is_admin boolean not null default false,
  add column suspended_at timestamptz;

comment on column public.profiles.is_admin is '公式（管理者）アカウント。公式マークが付き、管理の画面を使える';
comment on column public.profiles.suspended_at is '管理者が利用停止にした時刻。null なら利用できる';

alter table public.reports
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------
-- 公式と紛らわしいユーザーIDは登録できないようにする
-- ---------------------------------------------------------
create table public.reserved_usernames (username text primary key);
alter table public.reserved_usernames enable row level security;
revoke all on public.reserved_usernames from anon, authenticated;

insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('admins'), ('official'), ('mokumoku'), ('mokumoku_official'), ('mokumoku_admin'),
  ('support'), ('staff'), ('system'), ('root'), ('moderator'), ('unei');

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username)))
     and not exists (select 1 from public.reserved_usernames where username = lower(btrim(p_username)));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(new.raw_user_meta_data ->> 'username'));
  v_display  text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$'
     or exists (select 1 from public.reserved_usernames where username = v_username) then
    raise exception 'invalid_username' using errcode = '22023';
  end if;

  if v_display = '' then
    v_display := v_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display);

  return new;
end;
$$;

-- ---------------------------------------------------------
-- 管理者かどうか（利用停止中は管理者でも使えない）
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid() and suspended_at is null), false);
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only';
  end if;
end;
$$;

revoke execute on function public.require_admin() from public, anon, authenticated;

-- SQL エディタから実行する：select public.make_official('いまのユーザーID', '新しいユーザーID（省略可）');
-- 新しいユーザーIDには予約した名前（mokumoku など）も使える。ログインIDも新しい名前に変わる
create or replace function public.make_official(p_username text, p_new_username text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_new text := lower(btrim(p_new_username));
begin
  select id into v_id from public.profiles where username = lower(btrim(p_username));
  if v_id is null then
    raise exception 'user_not_found';
  end if;
  update public.profiles set is_admin = true where id = v_id;
  if v_new is not null and v_new <> lower(btrim(p_username)) then
    if v_new !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.profiles where username = v_new) then
      raise exception 'invalid_username';
    end if;
    update public.profiles set username = v_new where id = v_id;
    update auth.users set email = v_new || '@users.mokumoku.invalid' where id = v_id;
  end if;
end;
$$;

revoke execute on function public.make_official(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 利用停止中の人は入室できない
-- ---------------------------------------------------------
create or replace function public.block_suspended_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and suspended_at is not null) then
    raise exception 'suspended';
  end if;
  return new;
end;
$$;

revoke execute on function public.block_suspended_session() from public, anon, authenticated;

create trigger study_sessions_block_suspended
  before insert on public.study_sessions
  for each row execute function public.block_suspended_session();

-- ---------------------------------------------------------
-- 通報の一覧（同じ相手への通報はまとめる）
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
           else '（投稿）'
         end,
         case r.target_type
           when 'room' then '/rooms/' || r.target_id
           when 'user' then coalesce((select '/u/' || p.username from public.profiles p where p.id = r.target_id), '')
           else ''
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

revoke execute on function public.admin_list_reports(boolean) from public, anon;
grant execute on function public.admin_list_reports(boolean) to authenticated;

create or replace function public.admin_resolve_reports(p_target_type public.report_target, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  update public.reports set resolved_at = now(), resolved_by = auth.uid()
  where target_type = p_target_type and target_id = p_target_id and resolved_at is null;
end;
$$;

revoke execute on function public.admin_resolve_reports(public.report_target, uuid) from public, anon;
grant execute on function public.admin_resolve_reports(public.report_target, uuid) to authenticated;

-- ---------------------------------------------------------
-- 部屋の削除・文字を消す
-- ---------------------------------------------------------
create or replace function public.admin_delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  perform 1 from public.rooms where id = p_room_id and deleted_at is null for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  perform public.close_room_sessions_internal(p_room_id, null);
  update public.rooms set deleted_at = now(), closed_at = coalesce(closed_at, now()) where id = p_room_id;
end;
$$;

revoke execute on function public.admin_delete_room(uuid) from public, anon;
grant execute on function public.admin_delete_room(uuid) to authenticated;

create or replace function public.admin_clear_room_text(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  update public.rooms set name = '名前を消した部屋', description = '' where id = p_room_id;
end;
$$;

revoke execute on function public.admin_clear_room_text(uuid) from public, anon;
grant execute on function public.admin_clear_room_text(uuid) to authenticated;

-- ---------------------------------------------------------
-- ユーザーの利用停止・名前と自己紹介を消す
-- ---------------------------------------------------------
create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'cannot_suspend_self';
  end if;
  update public.profiles
  set suspended_at = case when p_suspended then coalesce(suspended_at, now()) end
  where id = p_user_id;
  if p_suspended then
    select id into v_session from public.study_sessions where user_id = p_user_id and ended_at is null;
    if v_session is not null then
      perform public.close_session_internal(v_session, now());
    end if;
  end if;
end;
$$;

revoke execute on function public.admin_set_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;

create or replace function public.admin_clear_user_text(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  update public.profiles set display_name = username, bio = '' where id = p_user_id;
end;
$$;

revoke execute on function public.admin_clear_user_text(uuid) from public, anon;
grant execute on function public.admin_clear_user_text(uuid) to authenticated;


-- ---------------------------------------------------------
-- フィードバック（ご意見・不具合）。送るだけで、管理者が読む
-- ---------------------------------------------------------
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  kind       text not null check (kind in ('bug', 'request', 'other')),
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  page       text not null default '' check (char_length(page) <= 200),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.send_feedback(p_kind text, p_body text, p_page text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind not in ('bug', 'request', 'other') or char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'invalid_feedback';
  end if;
  -- いたずらで大量に送られないよう、1日10件まで
  if (select count(*) from public.feedback where user_id = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_feedback';
  end if;
  insert into public.feedback (user_id, kind, body, page)
  values (v_uid, p_kind, btrim(p_body), left(coalesce(p_page, ''), 200));
end;
$$;

revoke execute on function public.send_feedback(text, text, text) from public, anon;
grant execute on function public.send_feedback(text, text, text) to authenticated;

create or replace function public.admin_list_feedback()
returns table (id uuid, kind text, body text, page text, created_at timestamptz, read_at timestamptz, username text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return query
  select f.id, f.kind, f.body, f.page, f.created_at, f.read_at, p.username, p.display_name
  from public.feedback f
  left join public.profiles p on p.id = f.user_id
  order by f.created_at desc
  limit 300;
end;
$$;

revoke execute on function public.admin_list_feedback() from public, anon;
grant execute on function public.admin_list_feedback() to authenticated;

create or replace function public.admin_mark_feedback_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  update public.feedback set read_at = coalesce(read_at, now()) where id = p_id;
end;
$$;

revoke execute on function public.admin_mark_feedback_read(uuid) from public, anon;
grant execute on function public.admin_mark_feedback_read(uuid) to authenticated;

-- 運営の公式アカウント
update public.profiles set is_admin = true where username = 'mokumoku_oficial';
