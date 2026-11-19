-- =========================================================
-- プロフィールの項目ごとに、ほかの人に見せる・見せないをワンタップで切りかえる
-- 項目: totals（今週の合計・連続日数・累計）、week（今週の学習時間）、grass（草カレンダー）、
--       tags（タグ別の割合）、goal（週の目標）、badges（実績バッジ）、items（集めたアイテム）
-- 本人には全部見える。隠した項目は、ほかの人にはサーバーから返さない。
-- =========================================================

alter table public.profiles
  add column hidden_sections text[] not null default '{}'
  check (hidden_sections <@ array['totals', 'week', 'grass', 'tags', 'goal', 'badges', 'items']::text[]);

create or replace function public.set_profile_section_hidden(p_section text, p_hidden boolean)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_section not in ('totals', 'week', 'grass', 'tags', 'goal', 'badges', 'items') then
    raise exception 'invalid_section';
  end if;
  update public.profiles
  set hidden_sections = case
        when p_hidden then array(select distinct unnest(hidden_sections || p_section) order by 1)
        else array_remove(hidden_sections, p_section)
      end
  where id = v_uid
  returning hidden_sections into v_result;
  return v_result;
end;
$$;
revoke execute on function public.set_profile_section_hidden(text, boolean) from public, anon;
grant execute on function public.set_profile_section_hidden(text, boolean) to authenticated;

-- 見る人にとって、その項目が隠されているか（本人には隠さない）
create or replace function public.profile_section_hidden(p_user_id uuid, p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is distinct from auth.uid()
     and coalesce((select p_section = any(hidden_sections) from public.profiles where id = p_user_id), false);
$$;
revoke execute on function public.profile_section_hidden(uuid, text) from public, anon, authenticated;

-- ---------- 統計：中身はそのまま残し、外側で隠した項目を抜く ----------
alter function public.get_profile_stats(text) rename to profile_stats_full;
revoke execute on function public.profile_stats_full(text) from public, anon, authenticated;

create function public.get_profile_stats(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stats jsonb := public.profile_stats_full(p_username);
  v_user  uuid;
begin
  if v_stats is null then
    return null;
  end if;
  select id into v_user from public.profiles where username = lower(p_username);
  if public.profile_section_hidden(v_user, 'totals') then
    v_stats := v_stats - array['total_minutes', 'total_sessions', 'total_pomodoros', 'week_minutes', 'streak_days'];
  end if;
  if public.profile_section_hidden(v_user, 'week') then
    v_stats := v_stats - 'week';
  end if;
  if public.profile_section_hidden(v_user, 'grass') then
    v_stats := v_stats - 'calendar';
  end if;
  if public.profile_section_hidden(v_user, 'tags') then
    v_stats := v_stats - 'tags';
  end if;
  return v_stats;
end;
$$;
revoke execute on function public.get_profile_stats(text) from public, anon;
grant execute on function public.get_profile_stats(text) to authenticated;

-- ---------- 週の目標 ----------
alter function public.get_weekly_progress(text) rename to weekly_progress_full;
revoke execute on function public.weekly_progress_full(text) from public, anon, authenticated;

create function public.get_weekly_progress(p_username text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_username is not null
         and public.profile_section_hidden((select id from public.profiles where username = lower(p_username)), 'goal')
      then null
    else public.weekly_progress_full(p_username)
  end;
$$;
revoke execute on function public.get_weekly_progress(text) from public, anon;
grant execute on function public.get_weekly_progress(text) to authenticated;

-- ---------- 実績バッジ ----------
alter function public.list_user_badges(text) rename to user_badges_full;
revoke execute on function public.user_badges_full(text) from public, anon, authenticated;

create function public.list_user_badges(p_username text)
returns table (badge_id text, earned_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.badge_id, b.earned_at
  from public.user_badges_full(p_username) b
  where not public.profile_section_hidden((select id from public.profiles where username = lower(p_username)), 'badges');
$$;
revoke execute on function public.list_user_badges(text) from public, anon;
grant execute on function public.list_user_badges(text) to authenticated;
