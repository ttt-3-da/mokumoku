-- =========================================================
-- 復活コード：パスワードを忘れたときに、ユーザーID＋復活コードで新しいパスワードを決められる
-- メールアドレスを集めない方針のままで使えるように、コードは本人が保存しておく。
-- - コードは bcrypt のハッシュだけ保存する（運営も元のコードは見られない）
-- - 使ったコードは使えなくなり、新しいコードが出る
-- - 15分で5回まちがえると、しばらく試せない（総当たりを防ぐ）
-- =========================================================

create table public.recovery_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code_hash  text not null,
  created_at timestamptz not null default now()
);
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;

create table public.recovery_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index recovery_attempts_user_time on public.recovery_attempts (user_id, attempted_at);
alter table public.recovery_attempts enable row level security;
revoke all on public.recovery_attempts from anon, authenticated;

-- まぎらわしい文字（0 O 1 I L）を使わない12文字
create or replace function public.new_recovery_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_code  text := '';
begin
  for i in 0..11 loop
    v_code := v_code || substr(v_chars, (get_byte(v_bytes, i) % length(v_chars)) + 1, 1);
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.new_recovery_code() from public, anon, authenticated;

-- 入力のゆれをなくす（小文字・ハイフン・空白を許す）
create or replace function public.normalize_recovery_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- 復活コードを作る（作り直すと前のコードは使えなくなる）。コードはこのときだけ返る
create or replace function public.issue_recovery_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := public.new_recovery_code();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.recovery_codes (user_id, code_hash)
  values (v_uid, extensions.crypt(v_code, extensions.gen_salt('bf', 8)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
  return v_code;
end;
$$;
revoke execute on function public.issue_recovery_code() from public, anon;
grant execute on function public.issue_recovery_code() to authenticated;

-- 自分の復活コードを作ってあるか（作った日時。まだなら null）
create or replace function public.recovery_code_created_at()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select created_at from public.recovery_codes where user_id = auth.uid();
$$;
revoke execute on function public.recovery_code_created_at() from public, anon;
grant execute on function public.recovery_code_created_at() to authenticated;

-- ログインしていない人が呼ぶ。合っていればパスワードを変え、ほかの端末のログインを切り、新しいコードを返す。
-- まちがえた回数を残したいので、まちがいは例外ではなく { error } で返す（例外だと記録も取り消されるため）
create or replace function public.reset_password_with_code(p_username text, p_code text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_hash text;
  v_code text := public.normalize_recovery_code(p_code);
  v_new  text;
begin
  if p_new_password is null or char_length(p_new_password) < 8 or octet_length(p_new_password) > 72 then
    raise exception 'invalid_password';
  end if;

  select id into v_uid from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if v_uid is null then
    -- ユーザーIDがあるかどうかを知られないよう、コードちがいと同じ答えにする
    return jsonb_build_object('error', 'invalid_code');
  end if;

  if (select count(*) from public.recovery_attempts
      where user_id = v_uid and attempted_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  select code_hash into v_hash from public.recovery_codes where user_id = v_uid for update;
  if v_hash is null or v_code = '' or extensions.crypt(v_code, v_hash) <> v_hash then
    insert into public.recovery_attempts (user_id) values (v_uid);
    return jsonb_build_object('error', 'invalid_code');
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = v_uid;
  -- 前のパスワードでログインしていた端末はログアウトさせる
  delete from auth.sessions where user_id = v_uid;
  delete from public.recovery_attempts where user_id = v_uid;

  v_new := public.new_recovery_code();
  update public.recovery_codes
  set code_hash = extensions.crypt(v_new, extensions.gen_salt('bf', 8)), created_at = now()
  where user_id = v_uid;

  return jsonb_build_object('code', v_new);
end;
$$;
revoke execute on function public.reset_password_with_code(text, text, text) from public;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
