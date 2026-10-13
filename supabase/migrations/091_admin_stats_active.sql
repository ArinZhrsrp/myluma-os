-- ============================================================
-- LUMA — migration 091: the Admin page numbers (Accounts, Dawn, Glow, Zenith, New in 7 days) count active accounts only.
--   Deactivated accounts are counted separately as "deactivated". Depends on 036 and 065 (disabled_at). Safe to re-run.
-- ============================================================
create or replace function luma.admin_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare v jsonb;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  select jsonb_build_object(
    'total', count(*) filter (where disabled_at is null),
    'dawn', count(*) filter (where disabled_at is null and plan = 'dawn'),
    'glow', count(*) filter (where disabled_at is null and plan = 'glow'),
    'zenith', count(*) filter (where disabled_at is null and plan = 'zenith'),
    'new_7d', count(*) filter (where disabled_at is null and created_at > now() - interval '7 days'),
    'deactivated', count(*) filter (where disabled_at is not null))
  into v from luma.profiles;
  return v;
end;
$$;
revoke execute on function luma.admin_stats() from public, anon;
grant execute on function luma.admin_stats() to authenticated;
