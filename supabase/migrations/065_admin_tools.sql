-- ============================================================
-- LUMA — migration 065: admin tools.
--   • Free trials by hand: the admin can start the 7-day trial for someone, or reset it so they can try again.
--   • Bulk free access: give an add-on to many people at once (a gift: it does NOT use up their own free trial).
--   • Deactivate / reactivate an account (they are signed out and cannot sign in until it is reactivated).
--     Deleting an account is done by the `account` Edge function (it also has to remove the person's files).
--   • An admin log: who did what, to whom, and when.
-- Depends on 036, 044, 062, 063. Safe to re-run.
-- ============================================================

-- ---------- deactivated accounts ----------
alter table luma.profiles add column if not exists disabled_at timestamptz;
alter table luma.profiles add column if not exists disabled_reason text not null default '';

-- people can not (re)activate themselves
create or replace function luma.protect_disabled()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and coalesce(current_setting('luma.allow_plan_change', true), '') <> 'on' then
    if tg_op = 'INSERT' then new.disabled_at := null; new.disabled_reason := '';
    else new.disabled_at := old.disabled_at; new.disabled_reason := old.disabled_reason; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_luma_profiles_disabled on luma.profiles;
create trigger protect_luma_profiles_disabled before insert or update on luma.profiles
  for each row execute function luma.protect_disabled();

-- ---------- the admin log ----------
create table if not exists luma.admin_audit (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid,
  action       text not null,
  target_user  uuid,                    -- no foreign key: the row stays after an account is deleted
  target_email text not null default '',
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on luma.admin_audit (created_at desc);
alter table luma.admin_audit enable row level security;
revoke all on luma.admin_audit from anon, authenticated;

create or replace function luma.admin_log(p_action text, p_target uuid, p_email text, p_detail jsonb)
returns void
language sql
security definer set search_path = ''
as $$ insert into luma.admin_audit (admin_id, action, target_user, target_email, detail) values (auth.uid(), p_action, p_target, coalesce(p_email, ''), coalesce(p_detail, '{}'::jsonb)); $$;
revoke execute on function luma.admin_log(text, uuid, text, jsonb) from public, anon, authenticated;

create or replace function luma.admin_recent_actions(p_limit integer default 50)
returns table (id uuid, action text, target_user uuid, target_email text, detail jsonb, created_at timestamptz, admin_name text)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query select a.id, a.action, a.target_user, a.target_email, a.detail, a.created_at, luma.person_name(a.admin_id)
    from luma.admin_audit a order by a.created_at desc limit least(coalesce(p_limit, 50), 200);
end;
$$;
revoke execute on function luma.admin_recent_actions(integer) from public, anon;
grant execute on function luma.admin_recent_actions(integer) to authenticated;

-- ---------- the list: also deactivated accounts, who has used the free trial, where each add-on came from ----------
drop function if exists luma.admin_list_users(text, integer);
create or replace function luma.admin_list_users(p_search text default '', p_limit integer default 200)
returns table (
  id uuid, email text, first_name text, last_name text, plan text, country text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, is_admin boolean, addons text[],
  plan_expires_at timestamptz, addon_expiry jsonb, disabled_at timestamptz, disabled_reason text, trials_used text[], addon_source jsonb
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

-- ---------- free trials by hand ----------
-- start the free trial for someone (it counts as their one trial); p_days = how long
create or replace function luma.admin_give_trial(p_user uuid, p_addon text, p_days integer default 7)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare v_end timestamptz; v_email text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  select email into v_email from luma.profiles where id = p_user; if not found then raise exception 'No such user'; end if;
  if luma.has_addon(p_user, p_addon) then raise exception 'They already have this add-on switched on'; end if;
  v_end := now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 60));
  insert into luma.user_addons as ua (user_id, addon, source, started_at, expires_at, trial_started_at, granted_by)
    values (p_user, p_addon, 'trial', now(), v_end, now(), auth.uid())
  on conflict (user_id, addon) do update set source = 'trial', started_at = now(), expires_at = v_end, trial_started_at = now(), granted_by = auth.uid();
  perform luma.notify(p_user, 'system', '🎉 Your ' || initcap(p_addon) || ' trial has started', 'You can use ' || initcap(p_addon) || ' mode free until ' || to_char(v_end at time zone luma.user_tz(p_user), 'FMDD Mon YYYY') || '.', 'dashboard');
  perform luma.admin_log('give_trial', p_user, v_email, jsonb_build_object('addon', p_addon, 'days', p_days));
  return v_end;
end;
$$;
revoke execute on function luma.admin_give_trial(uuid, text, integer) from public, anon;
grant execute on function luma.admin_give_trial(uuid, text, integer) to authenticated;

-- let someone try the free trial again
create or replace function luma.admin_reset_trial(p_user uuid, p_addon text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_email text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  select email into v_email from luma.profiles where id = p_user; if not found then raise exception 'No such user'; end if;
  update luma.user_addons set trial_started_at = null where user_id = p_user and addon = p_addon;
  perform luma.admin_log('reset_trial', p_user, v_email, jsonb_build_object('addon', p_addon));
end;
$$;
revoke execute on function luma.admin_reset_trial(uuid, text) from public, anon;
grant execute on function luma.admin_reset_trial(uuid, text) to authenticated;

-- ---------- bulk free access (a gift: their own free trial is left alone) ----------
create or replace function luma.admin_bulk_grant(p_users uuid[], p_addon text, p_days integer default null, p_months integer default null, p_until date default null, p_extend boolean default false, p_note text default '')
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid; v_old timestamptz; v_active boolean; v_end timestamptz; v_base timestamptz;
  v_given int := 0; v_extended int := 0; v_skipped int := 0; v_note text := left(btrim(coalesce(p_note, '')), 120);
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  if p_users is null or cardinality(p_users) = 0 then raise exception 'Pick at least one person'; end if;
  if cardinality(p_users) > 500 then raise exception 'Up to 500 people at a time'; end if;
  if (p_days is not null)::int + (p_months is not null)::int + (p_until is not null)::int <> 1 then raise exception 'Choose how long it lasts'; end if;
  foreach v_user in array p_users loop
    continue when not exists (select 1 from luma.profiles where id = v_user);
    select expires_at, (expires_at is null or expires_at > now()) into v_old, v_active from luma.user_addons where user_id = v_user and addon = p_addon;
    v_active := coalesce(v_active, false);
    if v_active and not p_extend then v_skipped := v_skipped + 1; continue; end if;
    if v_active and v_old is null then v_skipped := v_skipped + 1; continue; end if;      -- already has it with no end date
    if p_until is not null then v_end := ((p_until + 1)::timestamp at time zone luma.user_tz(v_user));
    else
      v_base := case when v_active then v_old else now() end;
      v_end := v_base + case when p_days is not null then make_interval(days => least(greatest(p_days, 1), 366)) else make_interval(months => least(greatest(p_months, 1), 24)) end;
    end if;
    insert into luma.user_addons as ua (user_id, addon, source, started_at, expires_at, granted_by)
      values (v_user, p_addon, 'admin', now(), v_end, auth.uid())
    on conflict (user_id, addon) do update set source = 'admin', started_at = case when v_active then ua.started_at else now() end, granted_by = auth.uid(), expires_at = v_end;
    if v_active then v_extended := v_extended + 1; else v_given := v_given + 1; end if;
    perform luma.notify(v_user, 'system', '🎁 Free ' || initcap(p_addon) || ' access',
      'You can use ' || initcap(p_addon) || ' mode free until ' || to_char(v_end at time zone luma.user_tz(v_user), 'FMDD Mon YYYY') || '.' || case when v_note <> '' then ' ' || v_note else '' end, 'dashboard');
  end loop;
  perform luma.admin_log('bulk_grant', null, '', jsonb_build_object('addon', p_addon, 'given', v_given, 'extended', v_extended, 'skipped', v_skipped,
    'days', p_days, 'months', p_months, 'until', p_until, 'note', v_note));
  return jsonb_build_object('given', v_given, 'extended', v_extended, 'skipped', v_skipped);
end;
$$;
revoke execute on function luma.admin_bulk_grant(uuid[], text, integer, integer, date, boolean, text) from public, anon;
grant execute on function luma.admin_bulk_grant(uuid[], text, integer, integer, date, boolean, text) to authenticated;

-- ---------- deactivate / reactivate ----------
create or replace function luma.admin_set_disabled(p_user uuid, p_disabled boolean, p_reason text default '')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_email text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_user = auth.uid() then raise exception 'You can not deactivate your own account'; end if;
  if exists (select 1 from luma.admin_users where user_id = p_user) then raise exception 'An administrator can not be deactivated'; end if;
  select email into v_email from luma.profiles where id = p_user; if not found then raise exception 'No such user'; end if;
  perform set_config('luma.allow_plan_change', 'on', true);
  update luma.profiles set disabled_at = case when p_disabled then now() end, disabled_reason = case when p_disabled then left(coalesce(p_reason, ''), 200) else '' end where id = p_user;
  perform set_config('luma.allow_plan_change', 'off', true);
  -- sign-in is refused while banned_until is set, and every open session is ended
  begin
    update auth.users set banned_until = case when p_disabled then 'infinity'::timestamptz else null end where id = p_user;
    if p_disabled then delete from auth.sessions where user_id = p_user; end if;
  exception when others then
    raise notice 'Could not update the sign-in ban (%)', sqlerrm;
  end;
  perform luma.admin_log(case when p_disabled then 'deactivate' else 'reactivate' end, p_user, v_email, jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)));
end;
$$;
revoke execute on function luma.admin_set_disabled(uuid, boolean, text) from public, anon;
grant execute on function luma.admin_set_disabled(uuid, boolean, text) to authenticated;
