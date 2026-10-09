-- LUMA — 083: two sizes of the Work add-on — "Work" and "Work Pro".
--
--   Before this, how many companies / projects / people / tasks Work allowed depended on the person's *plan* (Dawn, Glow, Zenith), so
--   someone on Dawn who paid for Work was still stuck with 2 companies. Now the Work add-on sets those limits, and the plan has no say:
--
--                                Work    Work Pro
--     companies                    5        20
--     projects                    20        60
--     people on a project          8        15
--     tasks in a project         600      1500
--
--   • luma.user_addons.tier ('standard' | 'pro') says which size a person has (only used for Work). Free trials and gifts are "standard".
--   • The numbers live in luma.plan_limits under the plan names 'work' and 'work_pro' (Admin → Plan limits edits them).
--   • luma.limit_of(user, 'work_…') now looks at the Work size of the person who owns the project / company (no add-on = the Work size).
--   • luma.my_limits() returns those numbers as 'work_…' keys and the size in addon_info.work.tier.
--   • luma.admin_set_addon(…, p_tier) sets the size; luma.admin_list_users() also returns addon_tier.
--
-- Depends on 033, 044, 062, 065, 077, 082. Safe to re-run.

alter table luma.user_addons add column if not exists tier text not null default 'standard' check (tier in ('standard', 'pro'));

alter table luma.plan_limits drop constraint if exists plan_limits_plan_check;
alter table luma.plan_limits add constraint plan_limits_plan_check check (plan in ('dawn', 'glow', 'zenith', 'work', 'work_pro'));

delete from luma.plan_limits where key like 'work\_%' and plan in ('dawn', 'glow', 'zenith');
insert into luma.plan_limits (plan, key, value) values
  ('work',     'work_companies', 5),  ('work',     'work_projects', 20), ('work',     'work_people', 8),  ('work',     'work_tasks', 600),
  ('work_pro', 'work_companies', 20), ('work_pro', 'work_projects', 60), ('work_pro', 'work_people', 15), ('work_pro', 'work_tasks', 1500)
on conflict (plan, key) do nothing;

-- which Work size does this person have right now? (without the add-on: the normal size)
create or replace function luma.work_tier_plan(p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select case when exists (select 1 from luma.user_addons a where a.user_id = p_user and a.addon = 'work' and a.tier = 'pro'
                           and (a.expires_at is null or a.expires_at > now())) then 'work_pro' else 'work' end;
$$;
revoke execute on function luma.work_tier_plan(uuid) from public, anon, authenticated;

create or replace function luma.limit_of(p_user uuid, p_key text)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select l.value from luma.plan_limits l
  where l.key = p_key and l.plan = case when p_key like 'work\_%' then luma.work_tier_plan(p_user) else luma.plan_of(p_user) end;
$$;
revoke execute on function luma.limit_of(uuid, text) from public, anon, authenticated;

create or replace function luma.my_limits()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'plan', luma.plan_of(auth.uid()),
    'plan_expires_at', (select p.plan_expires_at from luma.profiles p where p.id = auth.uid()),
    'limits', coalesce((select jsonb_object_agg(l.key, l.value) from luma.plan_limits l where l.plan = luma.plan_of(auth.uid()) and l.key not like 'work\_%'), '{}'::jsonb)
           || coalesce((select jsonb_object_agg(l.key, l.value) from luma.plan_limits l where l.plan = luma.work_tier_plan(auth.uid()) and l.key like 'work\_%'), '{}'::jsonb),
    'addons', coalesce((select jsonb_agg(a.addon order by a.addon) from luma.user_addons a
                        where a.user_id = auth.uid() and (a.expires_at is null or a.expires_at > now())), '[]'::jsonb),
    'addon_info', coalesce((select jsonb_object_agg(a.addon, jsonb_build_object('source', a.source, 'expires_at', a.expires_at, 'tier', a.tier)) from luma.user_addons a
                            where a.user_id = auth.uid() and (a.expires_at is null or a.expires_at > now())), '{}'::jsonb),
    'trials_used', coalesce((select jsonb_agg(a.addon order by a.addon) from luma.user_addons a
                             where a.user_id = auth.uid() and a.trial_started_at is not null), '[]'::jsonb));
$$;
revoke execute on function luma.my_limits() from public, anon;
grant execute on function luma.my_limits() to authenticated;

-- ---------- admin: give an add-on, now with the Work size ----------
drop function if exists luma.admin_set_addon(uuid, text, boolean, integer, date, boolean);
create or replace function luma.admin_set_addon(p_user uuid, p_addon text, p_on boolean, p_months integer default null, p_until date default null, p_extend boolean default false, p_tier text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare v_old timestamptz; v_active boolean; v_end timestamptz; v_base timestamptz; v_tier text; v_name text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  if p_tier is not null and p_tier not in ('standard', 'pro') then raise exception 'Unknown size'; end if;
  if not exists (select 1 from luma.profiles where id = p_user) then raise exception 'No such user'; end if;
  if p_on then
    select expires_at, (expires_at is null or expires_at > now()), tier into v_old, v_active, v_tier from luma.user_addons where user_id = p_user and addon = p_addon;
    v_tier := case when p_addon <> 'work' then 'standard' else coalesce(p_tier, v_tier, 'standard') end;
    if p_until is not null then v_end := ((p_until + 1)::timestamp at time zone luma.user_tz(p_user));
    elsif p_months is not null then
      v_base := case when p_extend and coalesce(v_active, false) and v_old is not null then v_old else now() end;
      v_end := v_base + make_interval(months => greatest(p_months, 1));
    else v_end := null; end if;
    insert into luma.user_addons as ua (user_id, addon, source, started_at, expires_at, granted_by, tier) values (p_user, p_addon, 'admin', now(), v_end, auth.uid(), v_tier)
      on conflict (user_id, addon) do update set source = 'admin', started_at = case when p_extend and coalesce(v_active, false) then ua.started_at else now() end, granted_by = auth.uid(), expires_at = v_end, tier = v_tier;
    v_name := initcap(p_addon) || case when v_tier = 'pro' then ' Pro' else '' end;
    if p_user <> auth.uid() then
      perform luma.notify(p_user, 'system', '🎉 ' || v_name || ' mode is on',
        'The ' || v_name || ' add-on is active' || case when v_end is null then '.' else ' until ' || to_char(v_end at time zone luma.user_tz(p_user), 'FMDD Mon YYYY') || '.' end || ' Switch to it at the top of the menu.', 'dashboard');
    end if;
  else
    update luma.user_addons set expires_at = now() where user_id = p_user and addon = p_addon and (expires_at is null or expires_at > now());
    v_end := now();
  end if;
  return jsonb_build_object('addon', p_addon, 'on', p_on, 'expires_at', v_end, 'tier', v_tier);
end;
$$;
revoke execute on function luma.admin_set_addon(uuid, text, boolean, integer, date, boolean, text) from public, anon;
grant execute on function luma.admin_set_addon(uuid, text, boolean, integer, date, boolean, text) to authenticated;

-- ---------- admin list: also the Work size ----------
drop function if exists luma.admin_list_users(text, integer);
create or replace function luma.admin_list_users(p_search text default '', p_limit integer default 200)
returns table (
  id uuid, email text, first_name text, last_name text, plan text, country text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, is_admin boolean, addons text[],
  plan_expires_at timestamptz, addon_expiry jsonb, disabled_at timestamptz, disabled_reason text, trials_used text[], addon_source jsonb, addon_tier jsonb
)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select p.id, p.email, p.first_name, p.last_name, p.plan, to_jsonb(p) ->> 'country',
           p.created_at, u.last_sign_in_at, u.email_confirmed_at,
           exists (select 1 from luma.admin_users a where a.user_id = p.id),
           coalesce((select array_agg(x.addon order by x.addon) from luma.user_addons x
                     where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())), '{}'::text[]),
           p.plan_expires_at,
           coalesce((select jsonb_object_agg(x.addon, x.expires_at) from luma.user_addons x
                     where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())), '{}'::jsonb),
           p.disabled_at, p.disabled_reason,
           coalesce((select array_agg(x.addon order by x.addon) from luma.user_addons x where x.user_id = p.id and x.trial_started_at is not null), '{}'::text[]),
           coalesce((select jsonb_object_agg(x.addon, x.source) from luma.user_addons x
                     where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())), '{}'::jsonb),
           coalesce((select jsonb_object_agg(x.addon, x.tier) from luma.user_addons x
                     where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())), '{}'::jsonb)
    from luma.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p_search, '') = ''
       or p.email ilike '%' || p_search || '%'
       or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || p_search || '%'
    order by p.created_at desc
    limit least(coalesce(p_limit, 200), 500);
end;
$$;
revoke execute on function luma.admin_list_users(text, integer) from public, anon;
grant execute on function luma.admin_list_users(text, integer) to authenticated;

-- ---------- limits editor: the two Work sizes show up as columns ----------
create or replace function luma.admin_plan_limits()
returns table (plan text, key text, value integer)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query select l.plan, l.key, l.value from luma.plan_limits l
    order by l.key, case l.plan when 'dawn' then 1 when 'glow' then 2 when 'zenith' then 3 when 'work' then 4 else 5 end;
end;
$$;
revoke execute on function luma.admin_plan_limits() from public, anon;
grant execute on function luma.admin_plan_limits() to authenticated;
