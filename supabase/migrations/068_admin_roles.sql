-- ============================================================
-- LUMA — migration 068: make someone an administrator (or remove it) from the Admin page.
--   • Only an administrator can do it, never for their own account (so there is always at least one administrator),
--     and a deactivated account can not be made an administrator. Every change is written to the admin log.
-- Depends on 036, 065. Safe to re-run.
-- ============================================================

create or replace function luma.admin_set_admin(p_user uuid, p_admin boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_email text; v_is boolean;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_user = auth.uid() then raise exception 'You can not change your own administrator access'; end if;
  select email, (disabled_at is not null) into v_email, v_is from luma.profiles where id = p_user;
  if not found then raise exception 'No such user'; end if;
  if p_admin then
    if v_is then raise exception 'Reactivate this account before making it an administrator'; end if;
    insert into luma.admin_users (user_id) values (p_user) on conflict do nothing;
    perform luma.notify(p_user, 'system', '🛡️ You are now an administrator', 'You can open the Admin page from the menu.', 'admin');
  else
    delete from luma.admin_users where user_id = p_user;
  end if;
  perform luma.admin_log(case when p_admin then 'make_admin' else 'remove_admin' end, p_user, v_email, '{}'::jsonb);
end;
$$;
revoke execute on function luma.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function luma.admin_set_admin(uuid, boolean) to authenticated;
