-- =========================================================
-- 部屋の名前・説明・アイコン・タグを RPC（POST）で変える
-- Mac の Safari で rooms への PATCH が事前の確認（OPTIONS）のあと送られず、保存できない人がいた
-- （ToDo のチェックと同じ。20261202000100 を参照）。
-- security invoker なので、これまでと同じ権限（オーナーだけ・列の権限・RLS・NGワードのトリガー）がそのまま効く
-- =========================================================

create or replace function public.update_room_info(p_room_id uuid, p_name text, p_description text, p_icon text, p_tags text[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.rooms
     set name = p_name, description = p_description, icon = p_icon, tags = p_tags
   where id = p_room_id;
  if not found then
    raise exception 'forbidden';
  end if;
end;
$$;
revoke execute on function public.update_room_info(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.update_room_info(uuid, text, text, text, text[]) to authenticated;
