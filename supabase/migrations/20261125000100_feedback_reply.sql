-- =========================================================
-- 管理者がフィードバックに返信する
-- 返信は feedback に残し、送った人のお知らせ（🔔）にも届ける。送った人は意見箱で自分の意見と返信を見られる。
-- =========================================================

alter table public.feedback
  add column reply text check (reply is null or char_length(reply) between 1 and 500),
  add column replied_at timestamptz;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule', 'mochi_stamp', 'post_reaction', 'feedback_request', 'feedback_reply'));

-- 管理者の一覧に返信も出す（戻り値の形が変わるので作り直す）
drop function public.admin_list_feedback();
create function public.admin_list_feedback()
returns table (id uuid, kind text, body text, page text, created_at timestamptz, read_at timestamptz,
               username text, display_name text, reply text, replied_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return query
  select f.id, f.kind, f.body, f.page, f.created_at, f.read_at, p.username, p.display_name, f.reply, f.replied_at
  from public.feedback f
  left join public.profiles p on p.id = f.user_id
  order by f.created_at desc
  limit 300;
end;
$$;
revoke execute on function public.admin_list_feedback() from public, anon;
grant execute on function public.admin_list_feedback() to authenticated;

-- 返信する（書き直しもできる。お知らせは返信のたびに届く）
create or replace function public.admin_reply_feedback(p_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply text := btrim(coalesce(p_reply, ''));
  v_user  uuid;
begin
  perform public.require_admin();
  if char_length(v_reply) < 1 or char_length(v_reply) > 500 then
    raise exception 'invalid_reply';
  end if;
  select user_id into v_user from public.feedback where id = p_id for update;
  if not found then
    raise exception 'feedback_not_found';
  end if;
  if v_user is null then
    raise exception 'user_gone';
  end if;
  update public.feedback
  set reply = v_reply, replied_at = now(), read_at = coalesce(read_at, now())
  where id = p_id;
  insert into public.notifications (user_id, kind, detail) values (v_user, 'feedback_reply', v_reply);
end;
$$;
revoke execute on function public.admin_reply_feedback(uuid, text) from public, anon;
grant execute on function public.admin_reply_feedback(uuid, text) to authenticated;

-- 自分が送ったフィードバックと、その返信
create or replace function public.my_feedback()
returns table (id uuid, kind text, body text, created_at timestamptz, reply text, replied_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.kind, f.body, f.created_at, f.reply, f.replied_at
  from public.feedback f
  where f.user_id = auth.uid()
  order by f.created_at desc
  limit 50;
$$;
revoke execute on function public.my_feedback() from public, anon;
grant execute on function public.my_feedback() to authenticated;
