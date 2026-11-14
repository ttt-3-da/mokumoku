-- =========================================================
-- アクセスした国を記録する（IP アドレスは記録しない）
-- 国は Vercel が付けるヘッダー（x-vercel-ip-country）から、サーバーで読んで送る。
-- 見られるのは管理者だけ
-- =========================================================

create table public.user_access (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  first_country   text check (first_country ~ '^[A-Z]{2}$'),
  first_seen_at   timestamptz not null default now(),
  last_country    text check (last_country ~ '^[A-Z]{2}$'),
  last_seen_at    timestamptz not null default now()
);

alter table public.user_access enable row level security;
revoke all on public.user_access from anon, authenticated;

-- ページを開いたときに呼ぶ。同じ国なら1時間に1回だけ書きこむ
create or replace function public.touch_access(p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_c   text := case when upper(btrim(coalesce(p_country, ''))) ~ '^[A-Z]{2}$' then upper(btrim(p_country)) end;
begin
  if v_uid is null then
    return;
  end if;
  insert into public.user_access (user_id, first_country, last_country)
  values (v_uid, v_c, v_c)
  on conflict (user_id) do update
  set last_country = coalesce(excluded.last_country, public.user_access.last_country),
      last_seen_at = now()
  where public.user_access.last_seen_at < now() - interval '1 hour'
     or public.user_access.last_country is distinct from coalesce(excluded.last_country, public.user_access.last_country);
end;
$$;

revoke execute on function public.touch_access(text) from public, anon;
grant execute on function public.touch_access(text) to authenticated;

create or replace function public.admin_get_access(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return (select to_jsonb(a) - 'user_id' from public.user_access a where a.user_id = p_user_id);
end;
$$;

revoke execute on function public.admin_get_access(uuid) from public, anon;
grant execute on function public.admin_get_access(uuid) to authenticated;
