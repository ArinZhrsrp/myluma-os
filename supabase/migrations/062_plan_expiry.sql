-- ============================================================
-- LUMA — migration 062: plans and add-ons run for a period (they are monthly).
--   • profiles.plan_expires_at — when a Glow / Zenith plan ends. Empty = no end date (every existing paid account stays as it is).
--     Add-ons already have an end date (user_addons.expires_at).
--   • When a plan ends the account goes back to Dawn automatically (nothing is deleted), and the person is told. They are also warned
--     7 days and 1 day before a plan or add-on ends, and told when an add-on has ended.
--   • Admin: set a plan or an add-on for 1, 3, 6 or 12 months, until a date, or with no end — or ADD time to what is left ("extend").
--   • Users see when their plan / add-ons end (Settings, Plans popup) and can ask to renew over WhatsApp.
-- Depends on 033, 036, 040, 044. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.profiles add column if not exists plan_expires_at timestamptz;

-- people can't change when their own plan ends
create or replace function luma.protect_plan()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and coalesce(current_setting('luma.allow_plan_change', true), '') <> 'on' then
    if tg_op = 'INSERT' then new.plan := 'dawn'; new.plan_expires_at := null; else new.plan := old.plan; new.plan_expires_at := old.plan_expires_at; end if;
  end if;
  return new;
end;
$$;

-- the app asks for plan, limits, add-ons and when the plan ends in one call
create or replace function luma.my_limits()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'plan', luma.plan_of(auth.uid()),
    'plan_expires_at', (select p.plan_expires_at from luma.profiles p where p.id = auth.uid()),
    'limits', coalesce((select jsonb_object_agg(l.key, l.value) from luma.plan_limits l where l.plan = luma.plan_of(auth.uid())), '{}'::jsonb),
    'addons', coalesce((select jsonb_agg(a.addon order by a.addon) from luma.user_addons a
                        where a.user_id = auth.uid() and (a.expires_at is null or a.expires_at > now())), '[]'::jsonb),
    'addon_info', coalesce((select jsonb_object_agg(a.addon, jsonb_build_object('source', a.source, 'expires_at', a.expires_at)) from luma.user_addons a
                            where a.user_id = auth.uid() and (a.expires_at is null or a.expires_at > now())), '{}'::jsonb),
    'trials_used', coalesce((select jsonb_agg(a.addon order by a.addon) from luma.user_addons a
                             where a.user_id = auth.uid() and a.trial_started_at is not null), '[]'::jsonb));
$$;
revoke execute on function luma.my_limits() from public, anon;
grant execute on function luma.my_limits() to authenticated;

-- ---------- admin: set a plan with a duration ----------
-- p_months / p_until: how long it runs (neither = no end date). p_extend: when the person is already on that plan, add the time to what is left.
drop function if exists luma.admin_set_plan(uuid, text);
create or replace function luma.admin_set_plan(p_user uuid, p_plan text, p_months integer default null, p_until date default null, p_extend boolean default false)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare v_old text; v_old_end timestamptz; v_end timestamptz; v_base timestamptz;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_plan not in ('dawn', 'glow', 'zenith') then raise exception 'Unknown plan'; end if;
  select plan, plan_expires_at into v_old, v_old_end from luma.profiles where id = p_user;
  if not found then raise exception 'No such user'; end if;
  if p_plan = 'dawn' then
    v_end := null;                                        -- the free plan never ends
  elsif p_until is not null then
    v_end := ((p_until + 1)::timestamp at time zone luma.user_tz(p_user));   -- until the end of that day, in the person's time zone
  elsif p_months is not null then
    v_base := case when p_extend and v_old = p_plan and v_old_end is not null and v_old_end > now() then v_old_end else now() end;
    v_end := v_base + make_interval(months => greatest(p_months, 1));
  else
    v_end := null;                                        -- no end date
  end if;
  perform set_config('luma.allow_plan_change', 'on', true);
  update luma.profiles set plan = p_plan, plan_expires_at = v_end where id = p_user;
  perform set_config('luma.allow_plan_change', 'off', true);
  if p_user <> auth.uid() and (v_old <> p_plan or v_old_end is distinct from v_end) then
    perform luma.notify(p_user, 'system', '🎉 Your plan is now ' || initcap(p_plan),
      case when p_plan = 'dawn' then 'You are on the free Dawn plan.'
           else 'Thank you! Your new limits are active' || case when v_end is null then '.' else ' until ' || to_char(v_end at time zone luma.user_tz(p_user), 'FMDD Mon YYYY') || '.' end || ' Open Settings to see everything included.' end, 'settings');
  end if;
  return jsonb_build_object('plan', p_plan, 'plan_expires_at', v_end);
end;
$$;
revoke execute on function luma.admin_set_plan(uuid, text, integer, date, boolean) from public, anon;
grant execute on function luma.admin_set_plan(uuid, text, integer, date, boolean) to authenticated;

-- ---------- admin: switch an add-on on for a duration (or off) ----------
drop function if exists luma.admin_set_addon(uuid, text, boolean, integer);
create or replace function luma.admin_set_addon(p_user uuid, p_addon text, p_on boolean, p_months integer default null, p_until date default null, p_extend boolean default false)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare v_old timestamptz; v_active boolean; v_end timestamptz; v_base timestamptz;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  if not exists (select 1 from luma.profiles where id = p_user) then raise exception 'No such user'; end if;
  if p_on then
    select expires_at, (expires_at is null or expires_at > now()) into v_old, v_active from luma.user_addons where user_id = p_user and addon = p_addon;
    if p_until is not null then v_end := ((p_until + 1)::timestamp at time zone luma.user_tz(p_user));
    elsif p_months is not null then
      v_base := case when p_extend and coalesce(v_active, false) and v_old is not null then v_old else now() end;
      v_end := v_base + make_interval(months => greatest(p_months, 1));
    else v_end := null; end if;
    insert into luma.user_addons as ua (user_id, addon, source, started_at, expires_at, granted_by) values (p_user, p_addon, 'admin', now(), v_end, auth.uid())
      on conflict (user_id, addon) do update set source = 'admin', started_at = case when p_extend and coalesce(v_active, false) then ua.started_at else now() end, granted_by = auth.uid(), expires_at = v_end;
    if p_user <> auth.uid() then
      perform luma.notify(p_user, 'system', '🎉 ' || initcap(p_addon) || ' mode is on',
        'The ' || initcap(p_addon) || ' add-on is active' || case when v_end is null then '.' else ' until ' || to_char(v_end at time zone luma.user_tz(p_user), 'FMDD Mon YYYY') || '.' end || ' Switch to it at the top of the menu.', 'dashboard');
    end if;
  else
    update luma.user_addons set expires_at = now() where user_id = p_user and addon = p_addon and (expires_at is null or expires_at > now());
    v_end := now();
  end if;
  return jsonb_build_object('addon', p_addon, 'on', p_on, 'expires_at', v_end);
end;
$$;
revoke execute on function luma.admin_set_addon(uuid, text, boolean, integer, date, boolean) from public, anon;
grant execute on function luma.admin_set_addon(uuid, text, boolean, integer, date, boolean) to authenticated;

-- the Admin list shows when each plan and add-on ends
drop function if exists luma.admin_list_users(text, integer);
create or replace function luma.admin_list_users(p_search text default '', p_limit integer default 200)
returns table (
  id uuid, email text, first_name text, last_name text, plan text, country text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, is_admin boolean, addons text[],
  plan_expires_at timestamptz, addon_expiry jsonb
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

-- ---------- the daily job: plans that ended go back to Dawn; warnings 7 days and 1 day before ----------
create or replace function luma.run_plan_expiry()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare r record; v_count int := 0; v_days int; v_title text; v_tz text;
begin
  -- plans that have ended
  for r in select id, plan from luma.profiles where plan <> 'dawn' and plan_expires_at is not null and plan_expires_at <= now() loop
    perform set_config('luma.allow_plan_change', 'on', true);
    update luma.profiles set plan = 'dawn', plan_expires_at = null where id = r.id;
    perform set_config('luma.allow_plan_change', 'off', true);
    perform luma.notify(r.id, 'system', 'Your ' || initcap(r.plan) || ' plan has ended', 'You are back on the free Dawn plan and everything you made is kept. Renew any time from Settings → your plan.', 'settings');
    v_count := v_count + 1;
  end loop;
  -- plans about to end
  for r in select id, plan, plan_expires_at from luma.profiles where plan <> 'dawn' and plan_expires_at > now() and plan_expires_at <= now() + interval '7 days' loop
    v_days := ceil(extract(epoch from (r.plan_expires_at - now())) / 86400)::int;
    continue when v_days not in (1, 7);
    v_title := '⏳ Your ' || initcap(r.plan) || ' plan ends ' || case when v_days = 1 then 'tomorrow' else 'in 7 days' end;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.id and n.title = v_title and n.created_at > now() - interval '20 hours');
    v_tz := luma.user_tz(r.id);
    perform luma.notify(r.id, 'system', v_title, 'It runs until ' || to_char(r.plan_expires_at at time zone v_tz, 'FMDD Mon YYYY') || '. Open Settings → your plan to renew on WhatsApp.', 'settings');
    v_count := v_count + 1;
  end loop;
  -- add-ons about to end, and ones that just ended
  for r in select a.user_id, a.addon, a.expires_at from luma.user_addons a where a.expires_at is not null and a.expires_at between now() - interval '1 day' and now() + interval '7 days' loop
    if r.expires_at <= now() then
      v_title := 'Your ' || initcap(r.addon) || ' add-on has ended';
      continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.title = v_title and n.created_at > now() - interval '3 days');
      perform luma.notify(r.user_id, 'system', v_title, 'Everything you made is kept, but you can not add new ' || initcap(r.addon) || ' items until it is switched on again. Renew from Settings → your plan.', 'settings');
    else
      v_days := ceil(extract(epoch from (r.expires_at - now())) / 86400)::int;
      continue when v_days not in (1, 7);
      v_title := '⏳ Your ' || initcap(r.addon) || ' add-on ends ' || case when v_days = 1 then 'tomorrow' else 'in 7 days' end;
      continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.title = v_title and n.created_at > now() - interval '20 hours');
      perform luma.notify(r.user_id, 'system', v_title, 'Open Settings → your plan to renew on WhatsApp.', 'settings');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_plan_expiry() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-plan-expiry') then perform cron.unschedule('luma-plan-expiry'); end if;
  perform cron.schedule('luma-plan-expiry', '5 * * * *', 'select luma.run_plan_expiry()');
exception when others then
  raise notice 'Could not schedule the plan expiry job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
