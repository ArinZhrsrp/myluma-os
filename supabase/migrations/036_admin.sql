-- ============================================================
-- LUMA — migration 036: super admin (the Admin page).
-- An admin can see every account and change anyone's plan (including their own). Admins are listed in
-- luma.admin_users, which can only be edited here in the SQL Editor — never from the app.
-- Depends on 001 and 033 (plans). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
--
-- To make an account an admin (register it normally first, then run):
--   insert into luma.admin_users (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
--   update luma.profiles set plan = 'zenith' where email = 'you@example.com';
-- ============================================================

create table if not exists luma.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table luma.admin_users enable row level security;   -- no policies: nobody can read or write it from the app
revoke all on luma.admin_users from anon, authenticated;

-- every plan change made from the Admin page is recorded
create table if not exists luma.plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_plan text,
  new_plan text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table luma.plan_changes enable row level security;
revoke all on luma.plan_changes from anon, authenticated;

create or replace function luma.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$ select exists (select 1 from luma.admin_users a where a.user_id = auth.uid()); $$;
revoke execute on function luma.is_admin() from public, anon;
grant execute on function luma.is_admin() to authenticated;

-- plan changes by normal users stay blocked; the admin function below switches this on for its own statement only
create or replace function luma.protect_plan()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and coalesce(current_setting('luma.allow_plan_change', true), '') <> 'on' then
    if tg_op = 'INSERT' then new.plan := 'dawn'; else new.plan := old.plan; end if;
  end if;
  return new;
end;
$$;

create or replace function luma.admin_list_users(p_search text default '', p_limit integer default 200)
returns table (
  id uuid, email text, first_name text, last_name text, plan text, country text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, is_admin boolean
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
           exists (select 1 from luma.admin_users a where a.user_id = p.id)
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
    'total', count(*),
    'dawn', count(*) filter (where plan = 'dawn'),
    'glow', count(*) filter (where plan = 'glow'),
    'zenith', count(*) filter (where plan = 'zenith'),
    'new_7d', count(*) filter (where created_at > now() - interval '7 days'))
  into v from luma.profiles;
  return v;
end;
$$;
revoke execute on function luma.admin_stats() from public, anon;
grant execute on function luma.admin_stats() to authenticated;

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
  perform set_config('luma.allow_plan_change', 'on', true);   -- only for this statement / transaction
  update luma.profiles set plan = p_plan where id = p_user;
  perform set_config('luma.allow_plan_change', 'off', true);
  insert into luma.plan_changes (user_id, old_plan, new_plan, changed_by) values (p_user, v_old, p_plan, auth.uid());
  if p_user <> auth.uid() then
    perform luma.notify(p_user, 'system', '🎉 Your plan is now ' || initcap(p_plan),
      case when p_plan = 'dawn' then 'You are on the free Dawn plan.' else 'Thank you! Your new limits are active. Open Settings to see everything included.' end, 'settings');
  end if;
  return p_plan;
end;
$$;
revoke execute on function luma.admin_set_plan(uuid, text) from public, anon;
grant execute on function luma.admin_set_plan(uuid, text) to authenticated;
