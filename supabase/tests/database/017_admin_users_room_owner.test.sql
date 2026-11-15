-- 管理のユーザー一覧と、部屋のオーナー表示の pgTAP テスト
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000017a1', 'au1@users.mokumoku.invalid', '{"username":"au1"}'),
  ('00000000-0000-0000-0000-0000000017a2', 'au2@users.mokumoku.invalid', '{"username":"au2"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000017a1';
insert into public.rooms (id, owner_id, name, visibility, timer_mode, focus_minutes, break_minutes, is_persistent)
values ('17000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000017a2', 'オーナーの部屋', 'public', 'free', 25, 5, true);

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a2","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_list_users() $$, 'P0001', 'admin_only', '管理者でないと一覧は見られない');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}', true);
select ok((select count(*) from public.admin_list_users() where username in ('au1', 'au2')) = 2, '管理者は全員を見られる');
select is((select rooms_owned from public.admin_list_users() where username = 'au2'), 1, '作った部屋の数');
select is((select username from public.room_owners(array['17000000-0000-0000-0000-000000000001'::uuid])), 'au2', '部屋を作った人がわかる');

select * from finish();
rollback;
