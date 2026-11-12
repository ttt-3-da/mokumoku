-- `npx supabase db reset` のときにマイグレーションの後で実行される（本番には適用されない）。
-- ローカル開発で画面を触るためのデモユーザーと部屋。
--
--   ユーザーID: demo_mochi   パスワード: mokumoku-demo
--   ユーザーID: demo_kinako  パスワード: mokumoku-demo
--
-- 何度流しても同じ結果になるよう on conflict do nothing にしている。

do $$
declare
  v_users constant jsonb := '[
    {"id": "d0000000-0000-0000-0000-00000000000a", "username": "demo_mochi",  "display_name": "もちこ"},
    {"id": "d0000000-0000-0000-0000-00000000000b", "username": "demo_kinako", "display_name": "きなこ"}
  ]';
  v_u jsonb;
  v_email text;
begin
  for v_u in select * from jsonb_array_elements(v_users) loop
    v_email := (v_u ->> 'username') || '@users.mokumoku.invalid';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', (v_u ->> 'id')::uuid, 'authenticated', 'authenticated',
      v_email, extensions.crypt('mokumoku-demo', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('username', v_u ->> 'username', 'display_name', v_u ->> 'display_name'),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      (v_u ->> 'id')::uuid, (v_u ->> 'id')::uuid, v_u ->> 'id',
      jsonb_build_object('sub', v_u ->> 'id', 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict do nothing;
  end loop;
end;
$$;

update public.avatars set color = 'sakura', eyes = 'smile', head = 'ribbon'
where user_id = 'd0000000-0000-0000-0000-00000000000a';
update public.avatars set color = 'kinako', eyes = 'glasses', mouth = 'smile', cheeks = 'orange'
where user_id = 'd0000000-0000-0000-0000-00000000000b';

insert into public.unlocks (user_id, item_id) values
  ('d0000000-0000-0000-0000-00000000000a', 'head:leaf'),
  ('d0000000-0000-0000-0000-00000000000a', 'desk:mug'),
  ('d0000000-0000-0000-0000-00000000000b', 'head:leaf')
on conflict do nothing;

insert into public.rooms (id, owner_id, name, description, icon, tags, timer_mode, focus_minutes, break_minutes, theme)
values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a',
   'しずかな図書館', 'ポモドーロ25分・休憩5分。おしゃべりなしで集中しよう。', '📚', '{資格,読書}', 'pomodoro', 25, 5, 'library'),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000b',
   'もくもくカフェ', 'タイマーなしで自由に。', '☕', '{プログラミング}', 'free', 25, 5, 'cafe')
on conflict (id) do nothing;
