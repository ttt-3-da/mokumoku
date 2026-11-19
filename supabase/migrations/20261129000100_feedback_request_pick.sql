-- =========================================================
-- 「フィードバックを送ってみませんか？」の送る相手を、もっと細かく選べるようにする
--   pick    … 管理者が選んだ人だけ（p_user_ids）
--   not_yet … まだこのお知らせを一度も受け取っていない人（あとから登録した人など）
-- 今までの all / active はそのまま。利用停止中の人と送った本人には、どれでも届けない。
-- =========================================================

drop function public.admin_feedback_audience_count(text);
drop function public.admin_send_feedback_request(text, text);

-- 送る相手（内部用）
create or replace function public.feedback_request_audience(p_audience text, p_user_ids uuid[])
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_audience not in ('all', 'active', 'pick', 'not_yet') then
    raise exception 'invalid_audience';
  end if;
  if p_audience = 'pick' and (coalesce(cardinality(p_user_ids), 0) = 0 or cardinality(p_user_ids) > 200) then
    raise exception 'invalid_audience';
  end if;
  return query
  select p.id from public.profiles p
  where p.suspended_at is null
    and p.id <> auth.uid()
    and case p_audience
          when 'all' then true
          when 'active' then exists (select 1 from public.study_sessions s where s.user_id = p.id and s.started_at > now() - interval '7 days')
          when 'pick' then p.id = any(p_user_ids)
          when 'not_yet' then not exists (select 1 from public.notifications n where n.user_id = p.id and n.kind = 'feedback_request')
        end;
end;
$$;
revoke execute on function public.feedback_request_audience(text, uuid[]) from public, anon, authenticated;

create function public.admin_feedback_audience_count(p_audience text, p_user_ids uuid[] default null)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return (select count(*)::int from public.feedback_request_audience(p_audience, p_user_ids));
end;
$$;
revoke execute on function public.admin_feedback_audience_count(text, uuid[]) from public, anon;
grant execute on function public.admin_feedback_audience_count(text, uuid[]) to authenticated;

create function public.admin_send_feedback_request(p_message text, p_audience text, p_user_ids uuid[] default null)
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
  insert into public.notifications (user_id, kind, detail)
  select a, 'feedback_request', v_message
  from public.feedback_request_audience(p_audience, p_user_ids) a;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.admin_send_feedback_request(text, text, uuid[]) from public, anon;
grant execute on function public.admin_send_feedback_request(text, text, uuid[]) to authenticated;
