-- 管理者が、ほかの人の表示名と自己紹介を書きかえる
create or replace function public.admin_set_user_text(p_user_id uuid, p_display_name text, p_bio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  perform public.require_admin();
  if char_length(v_name) not between 1 and 30 or char_length(coalesce(p_bio, '')) > 500 then
    raise exception 'invalid_profile_text';
  end if;
  update public.profiles set display_name = v_name, bio = coalesce(p_bio, '') where id = p_user_id;
  if not found then
    raise exception 'user_not_found';
  end if;
end;
$$;

revoke execute on function public.admin_set_user_text(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_text(uuid, text, text) to authenticated;
