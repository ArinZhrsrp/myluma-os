-- ============================================================
-- LUMA — migration 040: monthly plan statistics for the Admin page.
--   • EVERY plan change is now recorded in luma.plan_changes — from the Admin page, from the SQL Editor, or anywhere else.
--   • luma.admin_monthly_stats(): per month — accounts at the end of the month, new sign-ups, how many were on Dawn / Glow / Zenith
--     at the end of that month, and how many upgrades and downgrades happened in it. (Months are cut at midnight UTC.)
-- Depends on 033 and 036. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.log_plan_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.plan is distinct from old.plan then
    insert into luma.plan_changes (user_id, old_plan, new_plan, changed_by) values (new.id, old.plan, new.plan, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists log_plan_change on luma.profiles;
create trigger log_plan_change after update of plan on luma.profiles
  for each row execute function luma.log_plan_change();

-- the Admin page's plan change no longer writes the log itself (the trigger above does)
create or replace function luma.admin_set_plan(p_user uuid, p_plan text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_old text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_plan not in ('dawn', 'glow', 'zenith') then raise exception 'Unknown plan'; end if;
  select plan into v_old from luma.profiles where id = p_user;
  if not found then raise exception 'No such user'; end if;
  if v_old = p_plan then return p_plan; end if;
  perform set_config('luma.allow_plan_change', 'on', true);
  update luma.profiles set plan = p_plan where id = p_user;
  perform set_config('luma.allow_plan_change', 'off', true);
  if p_user <> auth.uid() then
    perform luma.notify(p_user, 'system', '🎉 Your plan is now ' || initcap(p_plan),
      case when p_plan = 'dawn' then 'You are on the free Dawn plan.' else 'Thank you! Your new limits are active. Open Settings to see everything included.' end, 'settings');
  end if;
  return p_plan;
end;
$$;
revoke execute on function luma.admin_set_plan(uuid, text) from public, anon;
grant execute on function luma.admin_set_plan(uuid, text) to authenticated;

-- one row per month, newest first. The plan someone was on at the end of a month is worked out from the change log.
create or replace function luma.admin_monthly_stats(p_months integer default 12)
returns table (
  period date, total_accounts integer, new_signups integer,
  on_dawn integer, on_glow integer, on_zenith integer, upgrades integer, downgrades integer
)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query
  with months as (
    select (date_trunc('month', now()) - make_interval(months => n))::date as m
    from generate_series(0, least(greatest(coalesce(p_months, 12), 1), 36) - 1) as n
  ),
  bounds as (select m, (m + interval '1 month')::timestamptz as m_end from months),
  snap as (
    select b.m, p.id,
      case
        when p.created_at >= b.m_end then null
        else coalesce(
          (select c.new_plan from luma.plan_changes c where c.user_id = p.id and c.changed_at < b.m_end order by c.changed_at desc limit 1),
          (select c.old_plan from luma.plan_changes c where c.user_id = p.id and c.changed_at >= b.m_end order by c.changed_at asc limit 1),
          p.plan)
      end as plan_at
    from bounds b cross join luma.profiles p
  )
  select b.m,
    count(s.plan_at)::int,
    (select count(*)::int from luma.profiles p where p.created_at >= b.m and p.created_at < b.m_end),
    (count(*) filter (where s.plan_at = 'dawn'))::int,
    (count(*) filter (where s.plan_at = 'glow'))::int,
    (count(*) filter (where s.plan_at = 'zenith'))::int,
    (select count(*)::int from luma.plan_changes c where c.changed_at >= b.m and c.changed_at < b.m_end
       and (case c.new_plan when 'dawn' then 0 when 'glow' then 1 else 2 end) > (case coalesce(c.old_plan, 'dawn') when 'dawn' then 0 when 'glow' then 1 else 2 end)),
    (select count(*)::int from luma.plan_changes c where c.changed_at >= b.m and c.changed_at < b.m_end
       and (case c.new_plan when 'dawn' then 0 when 'glow' then 1 else 2 end) < (case coalesce(c.old_plan, 'dawn') when 'dawn' then 0 when 'glow' then 1 else 2 end))
  from bounds b join snap s on s.m = b.m
  group by b.m, b.m_end
  order by b.m desc;
end;
$$;
revoke execute on function luma.admin_monthly_stats(integer) from public, anon;
grant execute on function luma.admin_monthly_stats(integer) to authenticated;
