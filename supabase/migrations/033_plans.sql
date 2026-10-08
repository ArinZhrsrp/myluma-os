-- ============================================================
-- LUMA — migration 033: plans (Dawn / Glow / Zenith) and their limits.
--   • luma.profiles.plan is now dawn | glow | zenith. NEW accounts start on Dawn; everyone who already
--     had an account is moved to Zenith (so nobody loses anything).
--   • luma.plan_limits holds every limit in one place (NULL = unlimited) — edit a row to change a limit.
--   • The database blocks adding more than the plan allows (habits, goals, bills & subscriptions, custom
--     reminders, contacts) and uploads over the plan's file size / total storage.
--   • Users can NOT change their own plan (only you, in the SQL Editor or from a server).
-- Depends on 001, 003, 016, 019, 020, 031, 032. Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- To move someone to another plan:  update luma.profiles set plan = 'glow' where email = 'them@example.com';
-- ============================================================

-- ---------- plan column ----------
alter table luma.profiles drop constraint if exists profiles_plan_check;
alter table luma.profiles alter column plan set default 'dawn';
update luma.profiles set plan = 'zenith' where plan not in ('dawn', 'glow', 'zenith');
alter table luma.profiles add constraint profiles_plan_check check (plan in ('dawn', 'glow', 'zenith'));

-- signed-in users can never set or change a plan themselves
create or replace function luma.protect_plan()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.plan := 'dawn'; else new.plan := old.plan; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_luma_profiles_plan on luma.profiles;
create trigger protect_luma_profiles_plan
  before insert or update on luma.profiles
  for each row execute function luma.protect_plan();

-- ---------- limits ----------
create table if not exists luma.plan_limits (
  plan text not null check (plan in ('dawn', 'glow', 'zenith')),
  key text not null,
  value integer,                      -- NULL = unlimited
  primary key (plan, key)
);
alter table luma.plan_limits enable row level security;
drop policy if exists "Anyone signed in can read plan limits" on luma.plan_limits;
create policy "Anyone signed in can read plan limits" on luma.plan_limits for select using (true);
grant select on luma.plan_limits to authenticated;

insert into luma.plan_limits (plan, key, value) values
  ('dawn',   'lumi_questions', 3),   ('glow',   'lumi_questions', 10),  ('zenith', 'lumi_questions', 15),
  ('dawn',   'lumi_actions', 0),     ('glow',   'lumi_actions', 1),     ('zenith', 'lumi_actions', 1),
  ('dawn',   'insights', 0),         ('glow',   'insights', 3),         ('zenith', 'insights', 10),
  ('dawn',   'storage_mb', 50),      ('glow',   'storage_mb', 300),     ('zenith', 'storage_mb', 1000),
  ('dawn',   'file_mb', 5),          ('glow',   'file_mb', 20),         ('zenith', 'file_mb', 50),
  ('dawn',   'reminders', 5),        ('glow',   'reminders', 25),       ('zenith', 'reminders', null),
  ('dawn',   'habits', 5),           ('glow',   'habits', 10),          ('zenith', 'habits', null),
  ('dawn',   'goals', 3),            ('glow',   'goals', 5),            ('zenith', 'goals', null),
  ('dawn',   'bills', 5),            ('glow',   'bills', 12),           ('zenith', 'bills', null),
  ('dawn',   'contacts', 3),         ('glow',   'contacts', 12),        ('zenith', 'contacts', null),
  ('dawn',   'timing', 0),           ('glow',   'timing', 1),           ('zenith', 'timing', 1),
  ('dawn',   'payroll', 0),          ('glow',   'payroll', 1),          ('zenith', 'payroll', 1),
  ('dawn',   'own_wallpaper', 0),    ('glow',   'own_wallpaper', 0),    ('zenith', 'own_wallpaper', 1),
  ('dawn',   'wallpapers', 2),       ('glow',   'wallpapers', 5),       ('zenith', 'wallpapers', 5),
  ('dawn',   'themes', 1),           ('glow',   'themes', 3),           ('zenith', 'themes', 3)
on conflict (plan, key) do update set value = excluded.value;

create or replace function luma.plan_of(p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$ select coalesce((select p.plan from luma.profiles p where p.id = p_user), 'dawn'); $$;

create or replace function luma.limit_of(p_user uuid, p_key text)
returns integer
language sql
stable
security definer set search_path = ''
as $$ select l.value from luma.plan_limits l where l.plan = luma.plan_of(p_user) and l.key = p_key; $$;

revoke execute on function luma.plan_of(uuid) from public, anon, authenticated;
revoke execute on function luma.limit_of(uuid, text) from public, anon, authenticated;

-- the app (and the Lumi function) ask for the caller's plan and limits in one call
create or replace function luma.my_limits()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'plan', luma.plan_of(auth.uid()),
    'limits', coalesce((select jsonb_object_agg(l.key, l.value) from luma.plan_limits l where l.plan = luma.plan_of(auth.uid())), '{}'::jsonb));
$$;
revoke execute on function luma.my_limits() from public, anon;
grant execute on function luma.my_limits() to authenticated;

-- ---------- count limits ----------
-- args: limit key, extra WHERE condition, label used in the message
create or replace function luma.enforce_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid := (to_jsonb(new) ->> 'user_id')::uuid;
  v_limit int := luma.limit_of((to_jsonb(new) ->> 'user_id')::uuid, tg_argv[0]);
  v_n int;
begin
  if v_limit is null then return new; end if;
  execute format('select count(*) from luma.%I where user_id = $1 and (%s)', tg_table_name, coalesce(tg_argv[1], 'true')) into v_n using v_user;
  if v_n >= v_limit then
    raise exception 'Plan limit: the % plan allows up to % %. Upgrade your plan in Settings to add more.', initcap(luma.plan_of(v_user)), v_limit, tg_argv[2];
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_plan_habits on luma.habits;
create trigger enforce_plan_habits before insert on luma.habits
  for each row execute function luma.enforce_limit('habits', 'not archived', 'habits');
drop trigger if exists enforce_plan_goals on luma.goals;
create trigger enforce_plan_goals before insert on luma.goals
  for each row execute function luma.enforce_limit('goals', 'completed_at is null', 'active goals');
drop trigger if exists enforce_plan_bills on luma.bills;
create trigger enforce_plan_bills before insert on luma.bills
  for each row execute function luma.enforce_limit('bills', 'true', 'bills and subscriptions');
drop trigger if exists enforce_plan_reminders on luma.reminders;
create trigger enforce_plan_reminders before insert on luma.reminders
  for each row execute function luma.enforce_limit('reminders', 'true', 'custom reminders');

-- contacts: your accepted contacts plus the requests you have sent; accepting a request counts too
create or replace function luma.enforce_contact_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_limit int;
  v_n int;
begin
  if tg_op = 'INSERT' then v_user := new.requester_id;
  elsif new.status = 'accepted' and old.status <> 'accepted' then v_user := new.addressee_id;
  else return new; end if;
  v_limit := luma.limit_of(v_user, 'contacts');
  if v_limit is null then return new; end if;
  select count(*) into v_n from luma.contacts c
    where c.id <> new.id
      and ((c.status = 'accepted' and (c.requester_id = v_user or c.addressee_id = v_user))
        or (c.status = 'pending' and c.requester_id = v_user));
  if v_n >= v_limit then
    raise exception 'Plan limit: the % plan allows up to % contacts. Upgrade your plan in Settings to add more.', initcap(luma.plan_of(v_user)), v_limit;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_contacts on luma.contacts;
create trigger enforce_plan_contacts before insert or update on luma.contacts
  for each row execute function luma.enforce_contact_limit();

-- ---------- file size and total storage ----------
create or replace function luma.enforce_doc_limits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_file int := luma.limit_of(new.user_id, 'file_mb');
  v_store int := luma.limit_of(new.user_id, 'storage_mb');
  v_used bigint;
begin
  if v_file is not null and new.size_bytes > v_file::bigint * 1048576 then
    raise exception 'Plan limit: the % plan allows files up to % MB. Upgrade your plan in Settings for bigger files.', initcap(luma.plan_of(new.user_id)), v_file;
  end if;
  if v_store is not null then
    select coalesce(sum(d.size_bytes), 0) into v_used from luma.documents d where d.user_id = new.user_id;
    if v_used + new.size_bytes > v_store::bigint * 1048576 then
      raise exception 'Plan limit: the % plan includes % MB of file storage and it is full. Delete files or upgrade your plan in Settings.', initcap(luma.plan_of(new.user_id)), v_store;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_documents on luma.documents;
create trigger enforce_plan_documents before insert on luma.documents
  for each row execute function luma.enforce_doc_limits();

-- ---------- reminder timing is a Glow / Zenith feature ----------
create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3) then
    raise exception 'Plan limit: choosing reminder times is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_reminder_timing on luma.reminder_prefs;
create trigger enforce_plan_reminder_timing before insert or update on luma.reminder_prefs
  for each row execute function luma.enforce_reminder_timing();
