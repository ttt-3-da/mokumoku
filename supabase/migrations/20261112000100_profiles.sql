-- =========================================================
-- Phase 1: profiles
-- ログインIDは username。Supabase Auth はメール必須なので、
-- クライアント側で `{username}@users.mokumoku.invalid` に変換して登録する。
-- 確認メールは無効（メールは一切送らない）。
-- =========================================================

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
               check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null
               check (char_length(btrim(display_name)) between 1 and 30),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'ユーザーの公開プロフィール。username はログインIDを兼ねるため変更不可。';

alter table public.profiles enable row level security;

-- ログインユーザーは全員のプロフィールを閲覧できる（タイムライン・在室者表示に必要）
create policy "profiles: authenticated can read"
  on public.profiles for select
  to authenticated
  using (true);

-- 本人だけが更新できる。更新できる列は display_name のみ（列権限で制限）
create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------
-- サインアップ時に profiles を作るトリガー
-- raw_user_meta_data の username / display_name を使う
-- ---------------------------------------------------------
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
  if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$' then
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- ユーザーIDが使えるかを登録前に確認する（未ログインでも呼べる）
-- ---------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.profiles where username = lower(btrim(p_username))
     );
$$;

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
