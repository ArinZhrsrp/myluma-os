-- LUMA — 087: birthdays, so an administrator can send a wish or gift a plan / trial.
--
--   • luma.profiles.birthday (optional date): asked on Register and in Settings → Profile → Edit. Only the person and administrators can read it
--     (it is part of the profile row, which other people cannot read except the name and e-mail the app already shows contacts).
--   • luma.birthday_rows(days) — who has a birthday today or in the next N days, counted in each person's own time zone (29 Feb counts on 28 Feb
--     in years that are not leap years). Used by the two functions below; nobody else can call it.
--   • luma.admin_birthdays(days)    — the Admin → Birthdays list (administrators only).
--   • luma.admin_birthday_wish(user, message) — sends a "Happy birthday" notification (once a day per person) and writes the admin log.
--   • luma.run_birthday_alerts() + cron job `luma-birthday-alerts` (hourly): at 9 am in each administrator's own time zone, one notification
--     "N birthdays today" (and who is coming up in the next 7 days), opening Admin.
--   • luma.handle_new_user() also reads `birthday` from the sign-up metadata (an invalid date is ignored).
--
-- Depends on 001, 028, 036, 065, 086. Safe to re-run.

alter table luma.profiles add column if not exists birthday date;
alter table luma.profiles drop constraint if exists profiles_birthday_check;
alter table luma.profiles add constraint profiles_birthday_check check (birthday is null or (birthday >= date '1900-01-01' and birthday <= date '2100-01-01'));

-- the day a birthday falls on in a given year (29 February → 28 February in a year that is not a leap year)
create or replace function luma.bday_in_year(p_birthday date, p_year integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(month from p_birthday) = 2 and extract(day from p_birthday) = 29
         and not (p_year % 4 = 0 and (p_year % 100 <> 0 or p_year % 400 = 0)) then make_date(p_year, 2, 28)
    else make_date(p_year, extract(month from p_birthday)::int, extract(day from p_birthday)::int) end;
$$;

create or replace function luma.birthday_rows(p_days integer)
returns table (id uuid, first_name text, last_name text, email text, birthday date, next_on date, days_until integer, turning integer, plan text, addons text[], wished_on timestamptz)
language sql
stable
security definer set search_path = ''
as $$
  with x as (
    select p.id, p.first_name, p.last_name, p.email, p.birthday, p.plan, (timezone(luma.user_tz(p.id), now()))::date as today
    from luma.profiles p where p.birthday is not null and p.disabled_at is null
  ), y as (
    select x.*, case when luma.bday_in_year(x.birthday, extract(year from x.today)::int) >= x.today then luma.bday_in_year(x.birthday, extract(year from x.today)::int)
                     else luma.bday_in_year(x.birthday, extract(year from x.today)::int + 1) end as next_on
    from x
  )
  select y.id, y.first_name, y.last_name, y.email, y.birthday, y.next_on, (y.next_on - y.today)::int,
         (extract(year from y.next_on)::int - extract(year from y.birthday)::int),
         y.plan,
         coalesce((select array_agg(a.addon order by a.addon) from luma.user_addons a where a.user_id = y.id and (a.expires_at is null or a.expires_at > now())), '{}'::text[]),
         (select max(g.created_at) from luma.admin_audit g where g.action = 'birthday_wish' and g.target_user = y.id and g.created_at > now() - interval '300 days')
  from y
  where (y.next_on - y.today) <= greatest(coalesce(p_days, 30), 0)
  order by (y.next_on - y.today), y.first_name nulls last, y.email;
$$;
revoke execute on function luma.birthday_rows(integer) from public, anon, authenticated;

create or replace function luma.admin_birthdays(p_days integer default 30)
returns table (id uuid, first_name text, last_name text, email text, birthday date, next_on date, days_until integer, turning integer, plan text, addons text[], wished_on timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query select * from luma.birthday_rows(least(coalesce(p_days, 30), 366));
end;
$$;
revoke execute on function luma.admin_birthdays(integer) from public, anon;
grant execute on function luma.admin_birthdays(integer) to authenticated;

create or replace function luma.admin_birthday_wish(p_user uuid, p_message text default '')
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_first text; v_email text; v_msg text := left(btrim(coalesce(p_message, '')), 200);
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  select p.first_name, p.email into v_first, v_email from luma.profiles p where p.id = p_user and p.birthday is not null;
  if not found then raise exception 'No such person, or no birthday saved'; end if;
  if exists (select 1 from luma.notifications n where n.user_id = p_user and n.type = 'birthday' and n.created_at > now() - interval '20 hours') then
    raise exception 'A birthday wish was already sent in the last day';
  end if;
  perform luma.notify(p_user, 'birthday', '🎂 Happy birthday' || case when coalesce(v_first, '') <> '' then ', ' || v_first else '' end || '!',
    case when v_msg <> '' then v_msg else 'Wishing you a wonderful year, from all of us at LUMA.' end, 'dashboard', null);
  perform luma.admin_log('birthday_wish', p_user, v_email, jsonb_build_object('message', v_msg));
end;
$$;
revoke execute on function luma.admin_birthday_wish(uuid, text) from public, anon;
grant execute on function luma.admin_birthday_wish(uuid, text) to authenticated;

-- ---------- the daily alert to administrators ----------
create or replace function luma.run_birthday_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  a record; v_now timestamp; v_today text; v_soon text; v_n int; v_count int := 0;
begin
  for a in select u.user_id from luma.admin_users u loop
    v_now := timezone(luma.user_tz(a.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    continue when exists (select 1 from luma.notifications n where n.user_id = a.user_id and n.type = 'admin_birthday' and n.created_at > now() - interval '20 hours');
    select count(*), string_agg(coalesce(nullif(btrim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')), ''), r.email), ', ' order by r.first_name)
      into v_n, v_today from luma.birthday_rows(0) r where r.days_until = 0 and r.id <> a.user_id;
    select string_agg(coalesce(nullif(btrim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')), ''), r.email) || ' (' || case when r.days_until = 1 then 'tomorrow' else 'in ' || r.days_until || ' days' end || ')', ', ' order by r.days_until, r.first_name)
      into v_soon from luma.birthday_rows(7) r where r.days_until between 1 and 7 and r.id <> a.user_id;
    continue when coalesce(v_n, 0) = 0 and v_soon is null;
    insert into luma.notifications (user_id, type, title, body, link)
    values (a.user_id, 'admin_birthday',
      case when coalesce(v_n, 0) > 0 then '🎂 ' || v_n || ' birthday' || case when v_n = 1 then '' else 's' end || ' today' else '🎂 Birthdays coming up' end,
      trim(both ' ' from coalesce(case when v_n > 0 then 'Today: ' || v_today || '. ' end, '') || coalesce(case when v_soon is not null then 'Coming up: ' || v_soon || '. ' end, '') || 'Open Admin → Birthdays to send a wish or gift a plan.'),
      'admin');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_birthday_alerts() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-birthday-alerts') then perform cron.unschedule('luma-birthday-alerts'); end if;
  perform cron.schedule('luma-birthday-alerts', '20 * * * *', 'select luma.run_birthday_alerts()');
exception when others then
  raise notice 'Could not schedule the birthday alert job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;

-- ---------- a birthday typed on the sign-up form ----------
create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text := btrim(coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', ''), ''));
  v_first text; v_last text; v_birthday date;
begin
  v_first := coalesce(nullif(btrim(v_meta ->> 'first_name'), ''), nullif(btrim(v_meta ->> 'given_name'), ''), nullif(split_part(v_full, ' ', 1), ''));
  v_last  := coalesce(nullif(btrim(v_meta ->> 'last_name'), ''), nullif(btrim(v_meta ->> 'family_name'), ''),
                      nullif(btrim(substr(v_full, length(split_part(v_full, ' ', 1)) + 1)), ''));
  begin v_birthday := nullif(v_meta ->> 'birthday', '')::date; exception when others then v_birthday := null; end;
  if v_birthday is not null and (v_birthday < date '1900-01-01' or v_birthday > current_date) then v_birthday := null; end if;
  insert into luma.profiles (id, first_name, last_name, email, country, timezone, birthday)
  values (new.id, v_first, v_last, new.email, nullif(v_meta ->> 'country', ''), nullif(v_meta ->> 'timezone', ''), v_birthday);
  return new;
end;
$$;
