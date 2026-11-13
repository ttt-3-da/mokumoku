-- =========================================================
-- 週の目標・先週のまとめ・記録のグラフ用データ・実績バッジ・定例の部屋
-- 日付は日本時間、週は月曜始まり。セッションは「入室した日」に数える
-- =========================================================

-- ---------------------------------------------------------
-- 共通：コインの理由と通知の種類を増やす
-- ---------------------------------------------------------
alter table public.coin_transactions drop constraint coin_transactions_reason_check;
alter table public.coin_transactions add constraint coin_transactions_reason_check
  check (reason in ('signup', 'study', 'pomodoro', 'streak', 'purchase', 'goal', 'badge'));

-- 通知：フォロー以外（バッジ・定例の部屋）は「誰が」がないので actor を空にできるようにする
alter table public.notifications alter column actor_id drop not null;
alter table public.notifications add column room_id uuid references public.rooms (id) on delete cascade;
alter table public.notifications add column detail text;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'badge', 'schedule'));

drop function public.list_notifications(int);
create function public.list_notifications(p_limit int default 50)
returns table (id uuid, kind text, created_at timestamptz, read_at timestamptz,
               actor_username text, actor_display_name text, actor_avatar jsonb, is_following boolean,
               room_id uuid, room_name text, room_icon text, detail text)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.kind, n.created_at, n.read_at, p.username, p.display_name,
         case when p.id is not null then public.avatar_json(p.id) end,
         coalesce(exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id), false),
         r.id, r.name, r.icon, n.detail
  from public.notifications n
  left join public.profiles p on p.id = n.actor_id
  left join public.rooms r    on r.id = n.room_id and r.deleted_at is null
  where n.user_id = auth.uid()
    and (n.actor_id is null or p.is_public)
    and (n.kind <> 'schedule' or r.id is not null)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.count_unread_notifications()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.notifications n
  left join public.profiles p on p.id = n.actor_id
  left join public.rooms r    on r.id = n.room_id and r.deleted_at is null
  where n.user_id = auth.uid() and n.read_at is null
    and (n.actor_id is null or p.is_public)
    and (n.kind <> 'schedule' or r.id is not null);
$$;

revoke execute on function public.list_notifications(int) from public, anon;
grant execute on function public.list_notifications(int) to authenticated;

-- 日本時間でその日を含む週の月曜
create or replace function public.jst_week_start(p_day date)
returns date
language sql
immutable
set search_path = public
as $$
  select p_day - (extract(isodow from p_day)::int - 1);
$$;

-- ---------------------------------------------------------
-- 実績バッジ
-- 名前・説明・絵は src/lib/badges.ts。ここでは ID ともらえるコインだけ持つ
-- ---------------------------------------------------------
create table public.badge_defs (
  id    text primary key,
  coins int  not null check (coins between 0 and 100)
);

alter table public.badge_defs enable row level security;
create policy "badge_defs: read" on public.badge_defs for select to authenticated using (true);
revoke all on public.badge_defs from anon, authenticated;
grant select on public.badge_defs to authenticated;

insert into public.badge_defs (id, coins) values
  ('first_session', 5), ('early_bird', 10), ('night_owl', 10), ('long_2h', 15),
  ('day_3h', 10), ('day_5h', 20), ('day_8h', 30),
  ('pomo_1', 5), ('pomo_10', 10), ('pomo_100', 30), ('pomo_day_8', 20),
  ('streak_3', 5), ('streak_7', 10), ('streak_14', 20), ('streak_30', 30),
  ('total_10h', 10), ('total_50h', 20), ('total_100h', 30), ('total_300h', 30),
  ('rooms_5', 10), ('weekly_goal', 10), ('note_first', 5),
  ('first_follow', 5), ('first_purchase', 5), ('theme_buy', 10), ('room_create', 5);

create table public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null references public.badge_defs (id),
  earned_at  timestamptz not null default now(),
  session_id uuid references public.study_sessions (id) on delete set null,
  primary key (user_id, badge_id)
);

create index user_badges_session_idx on public.user_badges (session_id);

alter table public.user_badges enable row level security;
create policy "user_badges: read own or public" on public.user_badges for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = user_badges.user_id and p.is_public)
  );
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;

-- バッジを渡す（まだ持っていなければ）。コインとお知らせも一緒に
create or replace function public.grant_badge_internal(p_user_id uuid, p_badge text, p_session_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int;
begin
  insert into public.user_badges (user_id, badge_id, session_id)
  values (p_user_id, p_badge, p_session_id)
  on conflict do nothing;
  if not found then
    return false;
  end if;

  select coins into v_coins from public.badge_defs where id = p_badge;
  if v_coins > 0 then
    insert into public.coin_transactions (user_id, amount, reason, detail, session_id)
    values (p_user_id, v_coins, 'badge', 'badge:' || p_badge, p_session_id);
  end if;
  insert into public.notifications (user_id, kind, detail) values (p_user_id, 'badge', p_badge);
  return true;
end;
$$;

revoke execute on function public.grant_badge_internal(uuid, text, uuid) from public, anon, authenticated;

-- セッションを閉じたときのバッジ判定。条件は src/lib/badges.ts の説明と一致させること
create or replace function public.evaluate_badges_internal(p_user_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s         public.study_sessions;
  v_minutes   int;
  v_hour      int;
  v_day       date;
  v_day_min   int;
  v_day_pomo  int;
  v_total     int;
  v_pomo      int;
  v_rooms     int;
  v_streak    int;
  v_badge     text;
begin
  select * into v_s from public.study_sessions where id = p_session_id and ended_at is not null;
  if not found then
    return;
  end if;
  v_minutes := public.session_minutes(v_s.started_at, v_s.ended_at);
  if v_minutes < 1 then
    return;
  end if;
  v_hour := extract(hour from v_s.started_at at time zone 'Asia/Tokyo')::int;
  v_day  := public.jst_date(v_s.started_at);

  select coalesce(sum(public.session_minutes(started_at, ended_at)), 0),
         coalesce(sum(pomodoros), 0),
         count(distinct room_id) filter (where public.session_minutes(started_at, ended_at) >= 1),
         coalesce(sum(public.session_minutes(started_at, ended_at)) filter (where public.jst_date(started_at) = v_day), 0),
         coalesce(sum(pomodoros) filter (where public.jst_date(started_at) = v_day), 0)
    into v_total, v_pomo, v_rooms, v_day_min, v_day_pomo
  from public.study_sessions
  where user_id = p_user_id and ended_at is not null;

  v_streak := public.current_streak(p_user_id);

  for v_badge in
    select b from (values
      ('first_session', true),
      ('early_bird',    v_hour between 5 and 7 and v_minutes >= 25),
      ('night_owl',     (v_hour >= 22 or v_hour < 3) and v_minutes >= 25),
      ('long_2h',       v_minutes >= 120),
      ('day_3h',        v_day_min >= 180),
      ('day_5h',        v_day_min >= 300),
      ('day_8h',        v_day_min >= 480),
      ('pomo_1',        v_pomo >= 1),
      ('pomo_10',       v_pomo >= 10),
      ('pomo_100',      v_pomo >= 100),
      ('pomo_day_8',    v_day_pomo >= 8),
      ('streak_3',      v_streak >= 3),
      ('streak_7',      v_streak >= 7),
      ('streak_14',     v_streak >= 14),
      ('streak_30',     v_streak >= 30),
      ('total_10h',     v_total >= 10 * 60),
      ('total_50h',     v_total >= 50 * 60),
      ('total_100h',    v_total >= 100 * 60),
      ('total_300h',    v_total >= 300 * 60),
      ('rooms_5',       v_rooms >= 5)
    ) as c (b, ok)
    where ok
  loop
    perform public.grant_badge_internal(p_user_id, v_badge, p_session_id);
  end loop;
end;
$$;

revoke execute on function public.evaluate_badges_internal(uuid, uuid) from public, anon, authenticated;

-- 勉強以外のバッジはトリガーで渡す
create or replace function public.badge_on_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  case tg_table_name
    when 'follows' then
      perform public.grant_badge_internal(new.follower_id, 'first_follow');
    when 'owned_items' then
      perform public.grant_badge_internal(new.user_id, 'first_purchase');
    when 'room_owned_themes' then
      if new.bought_by is not null then
        perform public.grant_badge_internal(new.bought_by, 'theme_buy');
      end if;
    when 'rooms' then
      perform public.grant_badge_internal(new.owner_id, 'room_create');
    when 'study_sessions' then
      if coalesce(btrim(new.note), '') <> '' then
        perform public.grant_badge_internal(new.user_id, 'note_first', new.id);
      end if;
  end case;
  return new;
end;
$$;

revoke execute on function public.badge_on_event() from public, anon, authenticated;

create trigger follows_badge after insert on public.follows
  for each row execute function public.badge_on_event();
create trigger owned_items_badge after insert on public.owned_items
  for each row execute function public.badge_on_event();
create trigger room_owned_themes_badge after insert on public.room_owned_themes
  for each row execute function public.badge_on_event();
create trigger rooms_badge after insert on public.rooms
  for each row execute function public.badge_on_event();
create trigger study_sessions_note_badge after update of note on public.study_sessions
  for each row when (new.note is distinct from old.note) execute function public.badge_on_event();

-- プロフィールに並べるバッジ（本人か、公開している人のもの）
create or replace function public.list_user_badges(p_username text)
returns table (badge_id text, earned_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.badge_id, b.earned_at
  from public.profiles p
  join public.user_badges b on b.user_id = p.id
  where p.username = lower(p_username)
    and (p.id = auth.uid() or p.is_public)
  order by b.earned_at;
$$;

revoke execute on function public.list_user_badges(text) from public, anon;
grant execute on function public.list_user_badges(text) to authenticated;

-- ---------------------------------------------------------
-- 週の目標（1週間の勉強時間。3〜100時間）
-- ---------------------------------------------------------
alter table public.profiles add column weekly_goal_minutes int
  check (weekly_goal_minutes is null or weekly_goal_minutes between 180 and 6000);
grant update (weekly_goal_minutes) on public.profiles to authenticated;

-- 目標を達成したら、その週に1回だけ 🪙20 と「週の目標」バッジ
create or replace function public.award_goal_internal(p_user_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal    int;
  v_week    date;
  v_minutes int;
begin
  select weekly_goal_minutes into v_goal from public.profiles where id = p_user_id;
  if v_goal is null then
    return;
  end if;
  select public.jst_week_start(public.jst_date(started_at)) into v_week
  from public.study_sessions where id = p_session_id;
  if v_week is null then
    return;
  end if;

  select coalesce(sum(public.session_minutes(started_at, ended_at)), 0) into v_minutes
  from public.study_sessions
  where user_id = p_user_id and ended_at is not null
    and public.jst_date(started_at) >= v_week and public.jst_date(started_at) < v_week + 7;

  if v_minutes >= v_goal and not exists (
    select 1 from public.coin_transactions
    where user_id = p_user_id and reason = 'goal' and detail = 'goal:' || v_week
  ) then
    insert into public.coin_transactions (user_id, amount, reason, detail, session_id)
    values (p_user_id, 20, 'goal', 'goal:' || v_week, p_session_id);
    perform public.grant_badge_internal(p_user_id, 'weekly_goal', p_session_id);
  end if;
end;
$$;

revoke execute on function public.award_goal_internal(uuid, uuid) from public, anon, authenticated;

-- 今週の進み具合。本人か、統計を公開している人のものだけ
create or replace function public.get_weekly_progress(p_username text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id, weekly_goal_minutes from public.profiles
    where (p_username is null and id = auth.uid()) or (p_username is not null and username = lower(p_username))
  ),
  week as (select public.jst_week_start(public.jst_date(now())) as start)
  select jsonb_build_object(
    'goal', t.weekly_goal_minutes,
    'minutes', coalesce((
      select sum(public.session_minutes(s.started_at, s.ended_at))
      from public.study_sessions s, week
      where s.user_id = t.id and s.ended_at is not null and public.jst_date(s.started_at) >= week.start
    ), 0),
    'achieved', exists (
      select 1 from public.coin_transactions c, week
      where c.user_id = t.id and c.reason = 'goal' and c.detail = 'goal:' || week.start
    )
  )
  from target t
  where public.can_view_stats(t.id);
$$;

-- 先週のまとめ（自分だけ）。合計・その前の週・一番がんばった日・よく使ったタグ
create or replace function public.last_week_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select public.jst_week_start(public.jst_date(now())) - 7 as start
  ),
  s as (
    select public.jst_date(ss.started_at) as d, public.session_minutes(ss.started_at, ss.ended_at) as m, r.tags
    from public.study_sessions ss
    join public.rooms r on r.id = ss.room_id, bounds
    where ss.user_id = auth.uid() and ss.ended_at is not null
      and public.jst_date(ss.started_at) >= bounds.start - 7
      and public.jst_date(ss.started_at) < bounds.start + 7
  ),
  last as (select s.* from s, bounds where s.d >= bounds.start),
  best as (select d, sum(m)::int as m from last group by d order by sum(m) desc, d limit 1),
  tags as (
    select t, sum(m) as m from last, unnest(last.tags) as t group by t order by sum(m) desc, t limit 3
  )
  select jsonb_build_object(
    'week_start', (select start from bounds),
    'total', coalesce((select sum(m) from last), 0),
    'prev_total', coalesce((select sum(m) from s, bounds where s.d < bounds.start), 0),
    'best_day', (select jsonb_build_object('date', d, 'minutes', m) from best),
    'tags', coalesce((select jsonb_agg(t order by m desc, t) from tags), '[]'::jsonb)
  );
$$;

-- 記録のグラフ用：自分のセッション（1分以上）を期間ぶん返す。集計は画面側でする
create or replace function public.list_my_study_stats(p_from timestamptz)
returns table (started_at timestamptz, ended_at timestamptz, minutes int, pomodoros int,
               room_name text, room_icon text, tags text[])
language sql
stable
security definer
set search_path = public
as $$
  select s.started_at, s.ended_at, public.session_minutes(s.started_at, s.ended_at), s.pomodoros,
         case when r.deleted_at is null then r.name else '削除された部屋' end,
         case when r.deleted_at is null then r.icon else '🗑️' end,
         case when r.deleted_at is null then r.tags else '{}' end
  from public.study_sessions s
  join public.rooms r on r.id = s.room_id
  where s.user_id = auth.uid() and s.ended_at is not null
    and s.started_at >= greatest(p_from, now() - interval '400 days')
    and public.session_minutes(s.started_at, s.ended_at) >= 1
  order by s.started_at;
$$;

revoke execute on function public.get_weekly_progress(text), public.last_week_summary(),
  public.list_my_study_stats(timestamptz) from public, anon;
grant execute on function public.get_weekly_progress(text), public.last_week_summary(),
  public.list_my_study_stats(timestamptz) to authenticated;

-- ---------------------------------------------------------
-- セッションを閉じる処理に、目標とバッジの判定を足す
-- ---------------------------------------------------------
create or replace function public.close_session_internal(p_session_id uuid, p_ended_at timestamptz)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
  v_room    public.rooms;
  v_end     timestamptz;
begin
  select * into v_session from public.study_sessions
  where id = p_session_id and ended_at is null
  for update;
  if not found then
    return null;
  end if;

  select * into v_room from public.rooms where id = v_session.room_id;
  v_end := greatest(p_ended_at, v_session.started_at);

  update public.study_sessions
  set ended_at  = v_end,
      pomodoros = v_session.pomodoros
                + case when v_room.timer_mode = 'pomodoro'
                       then public.count_pomodoros(v_room.timer_started_at, v_room.focus_minutes,
                                                   v_room.break_minutes, v_session.started_at, v_end)
                       else 0 end
  where id = v_session.id
  returning * into v_session;

  perform public.evaluate_unlocks_internal(v_session.user_id, v_session.id);
  perform public.award_coins_internal(v_session.user_id, v_session.id);
  perform public.award_goal_internal(v_session.user_id, v_session.id);
  perform public.evaluate_badges_internal(v_session.user_id, v_session.id);

  return v_session;
end;
$$;

revoke execute on function public.close_session_internal(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 定例の部屋：曜日（1=月〜7=日）と開始時刻（日本時間）
-- ---------------------------------------------------------
alter table public.rooms add column schedule_days smallint[] not null default '{}'
  check (schedule_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);
alter table public.rooms add column schedule_time time
  check (schedule_time is null or schedule_time = date_trunc('minute', schedule_time));
alter table public.rooms add constraint rooms_schedule_pair
  check ((cardinality(schedule_days) = 0) = (schedule_time is null));

create index rooms_scheduled_idx on public.rooms (schedule_time)
  where schedule_time is not null and closed_at is null;

-- オーナー・モデレーターが設定する。曜日が空なら定例をやめる
create or replace function public.set_room_schedule(p_room_id uuid, p_days int[], p_time time)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days smallint[];
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'forbidden';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_days from unnest(coalesce(p_days, '{}')) d;
  if not v_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] then
    raise exception 'invalid_schedule';
  end if;
  if cardinality(v_days) > 0 and p_time is null then
    raise exception 'invalid_schedule';
  end if;

  update public.rooms
  set schedule_days = v_days,
      schedule_time = case when cardinality(v_days) > 0 then date_trunc('minute', p_time)::time end
  where id = p_room_id and deleted_at is null;
end;
$$;

revoke execute on function public.set_room_schedule(uuid, int[], time) from public, anon;
grant execute on function public.set_room_schedule(uuid, int[], time) to authenticated;

-- その部屋の定例が「日本時間の p_at（分単位）」に始まるか
create or replace function public.schedule_matches(p_days smallint[], p_time time, p_at timestamp)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_time is not null
     and extract(isodow from p_at)::smallint = any (p_days)
     and p_time = date_trunc('minute', p_at)::time;
$$;

-- 毎分 cron から呼ぶ：開始時刻ならポモドーロを始め、30分前なら参加したことのある人にお知らせ
create or replace function public.run_room_schedules()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now  timestamptz := date_trunc('minute', now());
  v_jst  timestamp   := date_trunc('minute', now() at time zone 'Asia/Tokyo');
  v_room public.rooms;
begin
  for v_room in
    select * from public.rooms
    where schedule_time is not null and closed_at is null and deleted_at is null
      and timer_mode = 'pomodoro'
      and public.schedule_matches(schedule_days, schedule_time, v_jst)
      and (timer_started_at is null or timer_started_at < v_now)
    for update
  loop
    -- start_timer と同じく、やり直す前のタイマーで完了したポモドーロを入室中の人に足しておく
    if v_room.timer_started_at is not null then
      update public.study_sessions s
      set pomodoros = s.pomodoros + public.count_pomodoros(
            v_room.timer_started_at, v_room.focus_minutes, v_room.break_minutes, s.started_at, v_now)
      where s.room_id = v_room.id and s.ended_at is null;
    end if;
    update public.rooms set timer_started_at = v_now where id = v_room.id;
  end loop;

  insert into public.notifications (user_id, kind, room_id)
  select m.user_id, 'schedule', r.id
  from public.rooms r
  join public.room_members m on m.room_id = r.id and m.status = 'active'
  where r.schedule_time is not null and r.closed_at is null and r.deleted_at is null
    and public.schedule_matches(r.schedule_days, r.schedule_time, v_jst + interval '30 minutes')
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.room_id = r.id and n.kind = 'schedule'
        and n.created_at > now() - interval '10 minutes'
    );
end;
$$;

revoke execute on function public.run_room_schedules() from public, anon, authenticated;

select cron.schedule('mokumoku-schedules', '* * * * *', 'select public.run_room_schedules()');

-- ロビーの「もうすぐ始まる定例」：30分前〜始まって10分まで。
-- 参加したことのある部屋と、フォロー中の人の部屋だけ
create or replace function public.list_upcoming_schedules()
returns table (room_id uuid, name text, icon text, starts_at timestamptz, timer_mode public.timer_mode)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name, r.icon, st.at, r.timer_mode
  from public.rooms r
  cross join lateral (
    select ((public.jst_date(now()) + o) + r.schedule_time) at time zone 'Asia/Tokyo' as at
    from generate_series(-1, 1) o
    where extract(isodow from public.jst_date(now()) + o)::smallint = any (r.schedule_days)
  ) st
  where r.schedule_time is not null and r.closed_at is null and r.deleted_at is null
    and st.at between now() - interval '10 minutes' and now() + interval '30 minutes'
    and public.can_view_room(r.id)
    and (
      exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid() and m.status = 'active')
      or exists (
        select 1 from public.follows f join public.profiles p on p.id = f.followee_id and p.is_public
        where f.follower_id = auth.uid() and f.followee_id = r.owner_id
      )
    )
  order by st.at, r.name;
$$;

revoke execute on function public.list_upcoming_schedules() from public, anon;
grant execute on function public.list_upcoming_schedules() to authenticated;
