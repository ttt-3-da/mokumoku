-- 管理者（公式アカウント）はコインが無限。残高はいつもとても大きな数になり、何を買っても減らない
-- （画面では「∞」と表示する。停止中の管理者はふつうの残高）
create or replace function public.coin_balance(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.profiles where id = p_user_id and is_admin and suspended_at is null) then 1000000000
    else (select coalesce(sum(amount), 0)::int from public.coin_transactions where user_id = p_user_id)
  end;
$$;

revoke execute on function public.coin_balance(uuid) from public, anon, authenticated;
