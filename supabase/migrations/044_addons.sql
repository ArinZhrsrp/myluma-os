-- ============================================================
-- LUMA — migration 044: add-ons (Work and Study).
--   • An add-on is bought on top of any plan (Dawn / Glow / Zenith). luma.user_addons holds who has what.
--   • Add-ons are granted by you (Admin page, or SQL) or started by the user as a one-time 7-day free trial.
--     Removing an add-on only ends it (expires_at = now()), so the "trial already used" history is kept.
--   • my_limits() now also returns the caller's active add-ons, which the app uses to unlock the Work / Study modes.
--   • luma.has_addon(user, addon) is for the Work / Study tables' security rules in the next steps.
-- Depends on 033, 036, 040. Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- Give someone an add-on by hand:  select luma.admin_set_addon('<user id>', 'work', true, null);
-- ============================================================

create table if not exists luma.user_addons (
  user_id          uuid not null references luma.profiles(id) on delete cascade,
  addon            text not null check (addon in ('work', 'study')),
  source           text not null default 'admin' check (source in ('admin', 'trial')),
  started_at       timestamptz not null default now(),
  expires_at       timestamptz,                -- NULL = no end date
  trial_started_at timestamptz,                -- set once, ever: the free trial can only be used once per add-on
  granted_by       uuid,
  primary key (user_id, addon)
);
alter table luma.user_addons enable row level security;
revoke all on luma.user_addons from anon, authenticated;
grant select on luma.user_addons to authenticated;
drop policy if exists user_addons_read on luma.user_addons;
create policy user_addons_read on luma.user_addons for select to authenticated using (user_id = auth.uid());

create or replace function luma.has_addon(p_user uuid, p_addon text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from luma.user_addons a
                 where a.user_id = p_user and a.addon = p_addon and (a.expires_at is null or a.expires_at > now()));
$$;
revoke execute on function luma.has_addon(uuid, text) from public, anon, authenticated;

-- the app asks for plan, limits and add-ons in one call
create or replace function luma.my_limits()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'plan', luma.plan_of(auth.uid()),
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

-- a user starts their own one-time 7-day trial
create or replace function luma.start_addon_trial(p_addon text)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare v_end timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  if luma.has_addon(auth.uid(), p_addon) then raise exception 'You already have this add-on'; end if;
  if exists (select 1 from luma.user_addons where user_id = auth.uid() and addon = p_addon and trial_started_at is not null) then
    raise exception 'The free trial was already used';
  end if;
  v_end := now() + interval '7 days';
  insert into luma.user_addons (user_id, addon, source, started_at, expires_at, trial_started_at)
    values (auth.uid(), p_addon, 'trial', now(), v_end, now())
  on conflict (user_id, addon) do update
    set source = 'trial', started_at = now(), expires_at = v_end, trial_started_at = now();
  perform luma.notify(auth.uid(), 'system', '🎉 Your ' || initcap(p_addon) || ' trial has started',
    'You can use the ' || initcap(p_addon) || ' mode free for 7 days.', 'dashboard');
  return v_end;
end;
$$;
revoke execute on function luma.start_addon_trial(text) from public, anon;
grant execute on function luma.start_addon_trial(text) to authenticated;

-- super admin: switch an add-on on (optionally for p_days days) or off for anyone
create or replace function luma.admin_set_addon(p_user uuid, p_addon text, p_on boolean, p_days integer default null)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  if not exists (select 1 from luma.profiles where id = p_user) then raise exception 'No such user'; end if;
  if p_on then
    insert into luma.user_addons (user_id, addon, source, started_at, expires_at, granted_by)
      values (p_user, p_addon, 'admin', now(), case when p_days is null then null else now() + make_interval(days => p_days) end, auth.uid())
    on conflict (user_id, addon) do update
      set source = 'admin', started_at = now(), granted_by = auth.uid(),
          expires_at = case when p_days is null then null else now() + make_interval(days => p_days) end;
    if p_user <> auth.uid() then
      perform luma.notify(p_user, 'system', '🎉 ' || initcap(p_addon) || ' mode is on',
        'The ' || initcap(p_addon) || ' add-on is now active. Switch to it at the top of the menu.', 'dashboard');
    end if;
  else
    update luma.user_addons set expires_at = now() where user_id = p_user and addon = p_addon and (expires_at is null or expires_at > now());
  end if;
  return p_on;
end;
$$;
revoke execute on function luma.admin_set_addon(uuid, text, boolean, integer) from public, anon;
grant execute on function luma.admin_set_addon(uuid, text, boolean, integer) to authenticated;

-- the Admin list also shows each account's active add-ons
drop function if exists luma.admin_list_users(text, integer);
create or replace function luma.admin_list_users(p_search text default '', p_limit integer default 200)
returns table (
  id uuid, email text, first_name text, last_name text, plan text, country text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, is_admin boolean, addons text[]
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
                     where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())), '{}'::text[])
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
