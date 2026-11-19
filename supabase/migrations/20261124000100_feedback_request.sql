-- =========================================================
-- 管理者が「フィードバックを送ってみませんか？」のお知らせを送る
-- 送る相手は、全員（all）か、最近7日間に勉強した人（active）。利用停止中の人と送った本人にはとどけない。
-- お知らせを押すと意見箱が開く（文は detail に入れる）。
-- =========================================================

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule', 'mochi_stamp', 'post_reaction', 'feedback_request'));

-- 送る相手の人数（送る前の確認に使う）
create or replace function public.admin_feedback_audience_count(p_audience text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  if p_audience not in ('all', 'active') then
    raise exception 'invalid_audience';
  end if;
  return (
    select count(*)::int from public.profiles p
    where p.suspended_at is null
      and p.id <> auth.uid()
      and (p_audience = 'all'
           or exists (select 1 from public.study_sessions s where s.user_id = p.id and s.started_at > now() - interval '7 days'))
  );
end;
$$;
revoke execute on function public.admin_feedback_audience_count(text) from public, anon;
grant execute on function public.admin_feedback_audience_count(text) to authenticated;

-- 送る。戻り値は送った人数
create or replace function public.admin_send_feedback_request(p_message text, p_audience text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_count   int;
begin
  perform public.require_admin();
  if char_length(v_message) < 1 or char_length(v_message) > 140 then
    raise exception 'invalid_message';
  end if;
  if p_audience not in ('all', 'active') then
    raise exception 'invalid_audience';
  end if;

  insert into public.notifications (user_id, kind, detail)
  select p.id, 'feedback_request', v_message
  from public.profiles p
  where p.suspended_at is null
    and p.id <> auth.uid()
    and (p_audience = 'all'
         or exists (select 1 from public.study_sessions s where s.user_id = p.id and s.started_at > now() - interval '7 days'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.admin_send_feedback_request(text, text) from public, anon;
grant execute on function public.admin_send_feedback_request(text, text) to authenticated;
