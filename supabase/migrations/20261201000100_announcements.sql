-- =========================================================
-- 運営からのお知らせ（直したこと・新しい機能など）を、管理者がみんなのお知らせ（🔔）に送る
-- 送る相手の選び方は「フィードバックを送ってみませんか？」と同じ（all / active / pick / not_yet）。
-- not_yet は「このお知らせの種類をまだ受け取っていない人」ではなく、フィードバックのお願いを
-- 受け取っていない人になるので、お知らせでは all / active / pick を使う。
-- =========================================================

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule', 'mochi_stamp', 'post_reaction',
                  'feedback_request', 'feedback_reply', 'announcement'));

create or replace function public.admin_send_announcement(p_message text, p_audience text, p_user_ids uuid[] default null)
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
  if char_length(v_message) < 1 or char_length(v_message) > 300 then
    raise exception 'invalid_announcement';
  end if;
  if p_audience not in ('all', 'active', 'pick') then
    raise exception 'invalid_audience';
  end if;
  insert into public.notifications (user_id, kind, detail)
  select a, 'announcement', v_message
  from public.feedback_request_audience(p_audience, p_user_ids) a;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.admin_send_announcement(text, text, uuid[]) from public, anon;
grant execute on function public.admin_send_announcement(text, text, uuid[]) to authenticated;
