-- =========================================================
-- Phase 6: avatars（もちのパーツ）/ unlocks（解放済みアイテム）
-- 画像は保存せず、パーツIDだけを保存して表示時に SVG を組み立てる。
-- パーツIDの一覧は src/lib/avatar.ts と一致させること。
-- =========================================================

create table public.avatars (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  color      text not null default 'shiro'
             check (color in ('shiro', 'sakura', 'yomogi', 'kinako', 'goma', 'ramune', 'yuzu', 'murasakiimo')),
  eyes       text not null default 'dot'
             check (eyes in ('dot', 'smile', 'sparkle', 'sleepy', 'glasses')),
  mouth      text not null default 'omega'
             check (mouth in ('omega', 'small', 'smile', 'frown')),
  cheeks     text not null default 'pink'
             check (cheeks in ('none', 'pink', 'orange')),
  head       text not null default 'none'
             check (head in ('none', 'ribbon', 'leaf', 'crown')),
  desk       text not null default 'none'
             check (desk in ('none', 'mug', 'lamp', 'plant', 'pet')),
  hachimaki  text not null default 'red'
             check (hachimaki in ('red', 'indigo')),
  updated_at timestamptz not null default now()
);

alter table public.avatars enable row level security;

-- アバターは在室表示・タイムラインで他人にも見せるので、ログインユーザーは全員読める
create policy "avatars: authenticated can read"
  on public.avatars for select
  to authenticated
  using (true);

-- 書き込みは save_avatar RPC のみ（解放していないアイテムを使えないようにするため）
revoke all on public.avatars from anon, authenticated;
grant select on public.avatars to authenticated;

-- ---------------------------------------------------------
-- 解放済みアイテム。item_id は「パーツ種別:ID」（例 'desk:mug'）
-- 解放判定はフェーズ12で退室処理に組み込む
-- ---------------------------------------------------------
create table public.unlocks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     text not null check (item_id in (
                'head:leaf', 'head:crown', 'hachimaki:indigo',
                'desk:mug', 'desk:lamp', 'desk:plant', 'desk:pet')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.unlocks enable row level security;

create policy "unlocks: authenticated can read"
  on public.unlocks for select
  to authenticated
  using (true);

revoke all on public.unlocks from anon, authenticated;
grant select on public.unlocks to authenticated;

-- ---------------------------------------------------------
-- プロフィールができたらデフォルトのもちを作る（既存ユーザーにも作る）
-- ---------------------------------------------------------
create or replace function public.handle_new_profile_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.avatars (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_profile_avatar() from public, anon, authenticated;

create trigger on_profile_created_avatar
  after insert on public.profiles
  for each row execute function public.handle_new_profile_avatar();

insert into public.avatars (user_id)
select id from public.profiles
on conflict do nothing;

-- アバターを JSON で返す（Presence・タイムライン・入室前画面で使う形）
create or replace function public.avatar_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('color', a.color, 'eyes', a.eyes, 'mouth', a.mouth, 'cheeks', a.cheeks,
                               'head', a.head, 'desk', a.desk, 'hachimaki', a.hachimaki)
     from public.avatars a where a.user_id = p_user_id),
    '{}'::jsonb);
$$;

revoke execute on function public.avatar_json(uuid) from public, anon;
grant execute on function public.avatar_json(uuid) to authenticated;

-- ---------------------------------------------------------
-- アバター保存 RPC。解放制のアイテムは unlocks にあるときだけ使える
-- ---------------------------------------------------------
create or replace function public.save_avatar(
  p_color text, p_eyes text, p_mouth text, p_cheeks text,
  p_head text, p_desk text, p_hachimaki text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  foreach v_item in array array['head:' || p_head, 'desk:' || p_desk, 'hachimaki:' || p_hachimaki] loop
    if v_item in ('head:leaf', 'head:crown', 'hachimaki:indigo',
                  'desk:mug', 'desk:lamp', 'desk:plant', 'desk:pet')
       and not exists (select 1 from public.unlocks where user_id = v_uid and item_id = v_item) then
      raise exception 'item_locked';
    end if;
  end loop;

  begin
    insert into public.avatars as a (user_id, color, eyes, mouth, cheeks, head, desk, hachimaki, updated_at)
    values (v_uid, p_color, p_eyes, p_mouth, p_cheeks, p_head, p_desk, p_hachimaki, now())
    on conflict (user_id) do update
      set color = excluded.color, eyes = excluded.eyes, mouth = excluded.mouth,
          cheeks = excluded.cheeks, head = excluded.head, desk = excluded.desk,
          hachimaki = excluded.hachimaki, updated_at = now();
  exception
    when check_violation or not_null_violation then
      raise exception 'invalid_avatar';
  end;

  return public.avatar_json(v_uid);
end;
$$;

revoke execute on function public.save_avatar(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_avatar(text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------
-- タイムラインと入室前画面にアバターを付ける
-- （戻り値の列が変わるので作り直す）
-- ---------------------------------------------------------
drop function public.list_timeline(timestamptz, int, text);

create function public.list_timeline(
  p_before timestamptz default null,
  p_limit int default 20,
  p_username text default null
)
returns table (
  id uuid, body text, created_at timestamptz, username text, display_name text,
  task text, minutes int, pomodoros int, room_name text, room_icon text, reactions jsonb,
  avatar jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.body, p.created_at, pr.username, pr.display_name,
    s.task,
    public.session_minutes(s.started_at, s.ended_at),
    s.pomodoros,
    case when public.can_view_room(r.id) then r.name end,
    case when public.can_view_room(r.id) then r.icon end,
    coalesce((
      select jsonb_agg(jsonb_build_object('emoji', x.emoji, 'count', x.cnt, 'reacted', x.mine))
      from (
        select pr2.emoji, count(*) as cnt, bool_or(pr2.user_id = auth.uid()) as mine
        from public.post_reactions pr2
        where pr2.post_id = p.id
        group by pr2.emoji
      ) x
    ), '[]'::jsonb),
    public.avatar_json(p.user_id)
  from public.posts p
  join public.profiles pr      on pr.id = p.user_id
  join public.study_sessions s on s.id = p.session_id
  join public.rooms r          on r.id = s.room_id
  where auth.uid() is not null
    and (p_before is null or p.created_at < p_before)
    and (p_username is null or pr.username = lower(p_username))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.list_timeline(timestamptz, int, text) from public, anon;
grant execute on function public.list_timeline(timestamptz, int, text) to authenticated;
