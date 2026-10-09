-- ============================================================
-- LUMA — migration 069: gifts you can use later.
--   • An administrator can send free access as a GIFT instead of switching it on at once: the person sees it under
--     Settings → "Your plan and add-ons" and starts it with "Use now" whenever they like, up to the "use by" date.
--     Nothing starts and no time is lost until they press it. A person can hold up to 3 unused gifts at a time.
--   • Using a gift adds the time to what they already have (or starts it now). It never uses up their own free trial.
--   • They get a notification when it arrives (tapping it opens the gift) and a reminder 7 days and 1 day before it expires.
-- Depends on 044, 062, 064 (notify with a reference), 065. Safe to re-run.
-- ============================================================

create table if not exists luma.addon_gifts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  addon      text not null check (addon in ('work', 'study')),
  days       integer check (days between 1 and 366),
  months     integer check (months between 1 and 24),
  message    text not null default '' check (length(message) <= 120),
  claim_by   timestamptz,                          -- the last moment it can be used (null = no deadline)
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  check ((days is not null)::int + (months is not null)::int = 1)
);
create index if not exists addon_gifts_user_idx on luma.addon_gifts (user_id, created_at desc);
alter table luma.addon_gifts enable row level security;
drop policy if exists "Read own gifts" on luma.addon_gifts;
create policy "Read own gifts" on luma.addon_gifts for select to authenticated using (user_id = auth.uid());
revoke all on luma.addon_gifts from anon, authenticated;
grant select on luma.addon_gifts to authenticated;

-- the gifts a person can see: the ones waiting, and the ones used or expired in the last 60 days
create or replace function luma.my_gifts()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'addon', g.addon, 'days', g.days, 'months', g.months, 'message', g.message, 'claim_by', g.claim_by, 'created_at', g.created_at, 'claimed_at', g.claimed_at,
      'state', case when g.claimed_at is not null then 'used' when g.claim_by is not null and g.claim_by <= now() then 'expired' else 'waiting' end)
    order by (g.claimed_at is null and (g.claim_by is null or g.claim_by > now())) desc, g.created_at desc), '[]'::jsonb)
  from luma.addon_gifts g
  where g.user_id = auth.uid() and (g.claimed_at is null and (g.claim_by is null or g.claim_by > now()) or greatest(g.claimed_at, g.claim_by, g.created_at) > now() - interval '60 days');
$$;
revoke execute on function luma.my_gifts() from public, anon;
grant execute on function luma.my_gifts() to authenticated;

-- start a gift now
create or replace function luma.claim_gift(p_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare g record; v_old timestamptz; v_active boolean; v_base timestamptz; v_end timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into g from luma.addon_gifts where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'That gift was not found'; end if;
  if g.claimed_at is not null then raise exception 'You have already used this gift'; end if;
  if g.claim_by is not null and g.claim_by <= now() then raise exception 'This gift has expired'; end if;
  select expires_at, (expires_at is null or expires_at > now()) into v_old, v_active from luma.user_addons where user_id = auth.uid() and addon = g.addon;
  v_active := coalesce(v_active, false);
  if v_active and v_old is null then raise exception 'You already have % with no end date, so there is nothing to add', initcap(g.addon); end if;
  v_base := case when v_active then v_old else now() end;
  v_end := v_base + case when g.days is not null then make_interval(days => g.days) else make_interval(months => g.months) end;
  insert into luma.user_addons as ua (user_id, addon, source, started_at, expires_at, granted_by)
    values (auth.uid(), g.addon, 'admin', now(), v_end, g.granted_by)
  on conflict (user_id, addon) do update set source = 'admin', started_at = case when v_active then ua.started_at else now() end, expires_at = v_end;
  update luma.addon_gifts set claimed_at = now() where id = g.id;
  perform luma.notify(auth.uid(), 'system', '🎉 ' || initcap(g.addon) || ' is on', 'Your free ' || initcap(g.addon) || ' access runs until ' || to_char(v_end at time zone luma.user_tz(auth.uid()), 'FMDD Mon YYYY') || '.', 'dashboard');
  return v_end;
end;
$$;
revoke execute on function luma.claim_gift(uuid) from public, anon;
grant execute on function luma.claim_gift(uuid) to authenticated;

-- admin: send a gift to many people (each can hold up to 3 unused gifts)
create or replace function luma.admin_bulk_gift(p_users uuid[], p_addon text, p_days integer default null, p_months integer default null, p_claim_days integer default 60, p_note text default '')
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare v_user uuid; v_id uuid; v_given int := 0; v_skipped int := 0; v_note text := left(btrim(coalesce(p_note, '')), 120); v_by timestamptz; v_len text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_addon not in ('work', 'study') then raise exception 'Unknown add-on'; end if;
  if p_users is null or cardinality(p_users) = 0 then raise exception 'Pick at least one person'; end if;
  if cardinality(p_users) > 500 then raise exception 'Up to 500 people at a time'; end if;
  if (p_days is not null)::int + (p_months is not null)::int <> 1 then raise exception 'Choose how long the gift lasts'; end if;
  v_by := case when p_claim_days is null then null else now() + make_interval(days => least(greatest(p_claim_days, 1), 730)) end;
  v_len := case when p_days is not null then p_days || ' day' || case when p_days = 1 then '' else 's' end else p_months || ' month' || case when p_months = 1 then '' else 's' end end;
  foreach v_user in array p_users loop
    continue when not exists (select 1 from luma.profiles where id = v_user and disabled_at is null);
    if (select count(*) from luma.addon_gifts g where g.user_id = v_user and g.claimed_at is null and (g.claim_by is null or g.claim_by > now())) >= 3 then v_skipped := v_skipped + 1; continue; end if;
    insert into luma.addon_gifts (user_id, addon, days, months, message, claim_by, granted_by)
      values (v_user, p_addon, case when p_days is not null then least(greatest(p_days, 1), 366) end, case when p_months is not null then least(greatest(p_months, 1), 24) end, v_note, v_by, auth.uid()) returning id into v_id;
    perform luma.notify(v_user, 'gift', '🎁 A free ' || initcap(p_addon) || ' gift is waiting', v_len || ' of ' || initcap(p_addon) || ' mode. Start it whenever you like' || case when v_by is null then '.' else ', before ' || to_char(v_by at time zone luma.user_tz(v_user), 'FMDD Mon YYYY') || '.' end || case when v_note <> '' then ' ' || v_note else '' end, 'settings', v_id);
    v_given := v_given + 1;
  end loop;
  perform luma.admin_log('bulk_gift', null, '', jsonb_build_object('addon', p_addon, 'given', v_given, 'skipped', v_skipped, 'days', p_days, 'months', p_months, 'claim_days', p_claim_days, 'note', v_note));
  return jsonb_build_object('given', v_given, 'skipped', v_skipped);
end;
$$;
revoke execute on function luma.admin_bulk_gift(uuid[], text, integer, integer, integer, text) from public, anon;
grant execute on function luma.admin_bulk_gift(uuid[], text, integer, integer, integer, text) to authenticated;

-- reminders 7 days and 1 day before an unused gift expires
create or replace function luma.run_gift_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare r record; v_days int; v_title text; v_count int := 0;
begin
  for r in select g.* from luma.addon_gifts g where g.claimed_at is null and g.claim_by is not null and g.claim_by > now() and g.claim_by <= now() + interval '7 days' loop
    v_days := ceil(extract(epoch from (r.claim_by - now())) / 86400)::int;
    continue when v_days not in (1, 7);
    v_title := '⏳ Your free ' || initcap(r.addon) || ' gift ends ' || case when v_days = 1 then 'tomorrow' else 'in 7 days' end;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.title = v_title and n.ref = r.id and n.created_at > now() - interval '20 hours');
    perform luma.notify(r.user_id, 'gift', v_title, 'Open Settings → Your plan and add-ons and tap Use now before ' || to_char(r.claim_by at time zone luma.user_tz(r.user_id), 'FMDD Mon YYYY') || '.', 'settings', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_gift_reminders() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-gift-reminders') then perform cron.unschedule('luma-gift-reminders'); end if;
  perform cron.schedule('luma-gift-reminders', '10 * * * *', 'select luma.run_gift_reminders()');
exception when others then
  raise notice 'Could not schedule the gift reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
