-- ============================================================
-- LUMA — migration 064: split expenses (a Zenith feature).
--   • You record a shared bill: the total, who paid, and each person's share (equal, exact amounts, percent or shares —
--     the app works the amounts out; the database checks they add up to the total). Only people in your contacts can be added.
--   • The person who paid marks each person's share as paid. Nobody else can.
--   • Your own share is added to Money as an expense (category "Split") and follows the split when it is edited or deleted.
--   • Only Zenith can create or edit splits (plan_limits key 'split'). Anyone in a split can see it.
--   • All access goes through functions that check who is asking; the tables are closed to direct access.
-- Depends on 023 (money_entries), 033 (plans), 008 (notify), 048 (person_name), 054 (is_contact). Safe to re-run.
-- ============================================================

insert into luma.plan_limits (plan, key, value) values ('dawn', 'split', 0), ('glow', 'split', 0), ('zenith', 'split', 1)
on conflict (plan, key) do update set value = excluded.value;

create table if not exists luma.expense_splits (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (length(btrim(title)) between 1 and 80),
  total      numeric(12,2) not null check (total > 0),
  paid_by    uuid not null references auth.users (id) on delete cascade,
  split_date date not null default current_date,
  note       text not null default '' check (length(note) <= 300),
  method     text not null default 'equal' check (method in ('equal', 'exact', 'percent', 'shares')),
  subtotal   numeric(12,2),                                -- the amount before tax, when tax was added (total includes it)
  tax_label  text not null default '' check (length(tax_label) <= 40),   -- e.g. 'Service charge 10% + SST 6%'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- (a copy of this file run earlier created the table without these two columns)
alter table luma.expense_splits add column if not exists subtotal numeric(12,2);
alter table luma.expense_splits add column if not exists tax_label text not null default '';

create table if not exists luma.expense_split_members (
  split_id       uuid not null references luma.expense_splits (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  share          numeric(12,2) not null check (share >= 0),
  paid           boolean not null default false,       -- the person who paid has marked this share as paid back
  paid_at        timestamptz,
  last_nudged_at timestamptz,
  primary key (split_id, user_id)
);
create index if not exists expense_split_members_user_idx on luma.expense_split_members (user_id);
alter table luma.expense_splits enable row level security;
alter table luma.expense_split_members enable row level security;
revoke all on luma.expense_splits, luma.expense_split_members from anon, authenticated;

-- your share, as an expense in Money
alter table luma.money_entries add column if not exists split_id uuid references luma.expense_splits (id) on delete cascade;
create index if not exists money_entries_split_idx on luma.money_entries (split_id) where split_id is not null;

-- a notification that points at one item (the app scrolls to it and highlights it when the notification is opened)
create or replace function luma.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_ref uuid)
returns void
language sql
security definer set search_path = ''
as $$
  insert into luma.notifications (user_id, type, title, body, link, ref) values (p_user, p_type, p_title, p_body, p_link, p_ref);
$$;
revoke execute on function luma.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- create (p_id null) or edit a split. p_total is the final amount (tax included); p_subtotal / p_tax_label say how it was made up.
drop function if exists luma.save_split(uuid, text, numeric, uuid, date, text, text, jsonb);
create or replace function luma.save_split(p_id uuid, p_title text, p_total numeric, p_paid_by uuid, p_date date, p_note text, p_method text, p_members jsonb, p_subtotal numeric default null, p_tax_label text default '')
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid(); v_id uuid; v_title text := btrim(coalesce(p_title, '')); v_total numeric(12,2) := round(coalesce(p_total, 0), 2);
  m jsonb; v_user uuid; v_share numeric(12,2); v_sum numeric := 0; v_seen uuid[] := '{}'; v_old jsonb := '{}'::jsonb; v_old_payer uuid;
  v_paid boolean; v_mine numeric(12,2) := 0; v_payer_name text; v_me_name text; v_creating boolean := p_id is null; r record;
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  if coalesce(luma.limit_of(v_me, 'split'), 0) < 1 then raise exception 'Plan limit: splitting expenses is a Zenith feature. Upgrade your plan in Settings.'; end if;
  if v_title = '' or length(v_title) > 80 then raise exception 'Give the split a name (up to 80 characters)'; end if;
  if v_total <= 0 then raise exception 'The total must be more than 0'; end if;
  if p_method not in ('equal', 'exact', 'percent', 'shares') then raise exception 'Unknown way to split'; end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) < 2 or jsonb_array_length(p_members) > 13 then
    raise exception 'Pick between 1 and 12 people to split with'; end if;
  for m in select * from jsonb_array_elements(p_members) loop
    v_user := (m ->> 'user_id')::uuid; v_share := round(coalesce((m ->> 'share')::numeric, 0), 2);
    if v_share < 0 then raise exception 'A share can not be negative'; end if;
    if v_user = any (v_seen) then raise exception 'Someone is in the list twice'; end if;
    if v_user <> v_me and not luma.is_contact(v_me, v_user) then raise exception 'You can only split with people in your contacts'; end if;
    v_seen := v_seen || v_user; v_sum := v_sum + v_share;
    if v_user = v_me then v_mine := v_share; end if;
  end loop;
  if abs(v_sum - v_total) > 0.01 then raise exception 'The shares add up to RM %, but the total is RM %', to_char(v_sum, 'FM999999990.00'), to_char(v_total, 'FM999999990.00'); end if;
  if not (p_paid_by = any (v_seen)) then raise exception 'The person who paid must be in the split'; end if;

  if v_creating then
    insert into luma.expense_splits (owner_id, title, total, paid_by, split_date, note, method, subtotal, tax_label)
      values (v_me, v_title, v_total, p_paid_by, coalesce(p_date, current_date), left(coalesce(p_note, ''), 300), p_method, case when p_subtotal > 0 and p_subtotal <= v_total then round(p_subtotal, 2) end, left(coalesce(p_tax_label, ''), 40)) returning id into v_id;
  else
    select id, paid_by into v_id, v_old_payer from luma.expense_splits where id = p_id and owner_id = v_me;
    if not found then raise exception 'Only the person who created this split can change it'; end if;
    select coalesce(jsonb_object_agg(user_id::text, jsonb_build_object('share', share, 'paid', paid, 'paid_at', paid_at, 'nudge', last_nudged_at)), '{}'::jsonb)
      into v_old from luma.expense_split_members where split_id = v_id;
    update luma.expense_splits set title = v_title, total = v_total, paid_by = p_paid_by, split_date = coalesce(p_date, current_date),
      note = left(coalesce(p_note, ''), 300), method = p_method, updated_at = now(),
      subtotal = case when p_subtotal > 0 and p_subtotal <= v_total then round(p_subtotal, 2) end, tax_label = left(coalesce(p_tax_label, ''), 40) where id = v_id;
    delete from luma.expense_split_members where split_id = v_id;
  end if;

  for m in select * from jsonb_array_elements(p_members) loop
    v_user := (m ->> 'user_id')::uuid; v_share := round(coalesce((m ->> 'share')::numeric, 0), 2);
    -- the payer has nothing to pay back; someone whose share did not change keeps their "paid" mark
    v_paid := coalesce(v_user = p_paid_by or (not v_creating and v_old_payer = p_paid_by and (v_old -> v_user::text ->> 'paid')::boolean is true and (v_old -> v_user::text ->> 'share')::numeric = v_share), false);
    insert into luma.expense_split_members (split_id, user_id, share, paid, paid_at, last_nudged_at)
      values (v_id, v_user, v_share, v_paid, case when v_paid and v_user <> p_paid_by then coalesce((v_old -> v_user::text ->> 'paid_at')::timestamptz, now()) end, (v_old -> v_user::text ->> 'nudge')::timestamptz);
  end loop;

  -- my share in Money
  delete from luma.money_entries where split_id = v_id and user_id = v_me;
  if v_mine > 0 then
    insert into luma.money_entries (user_id, kind, amount, category, name, entry_date, split_id)
      values (v_me, 'expense', v_mine, 'Split', left(v_title, 80), coalesce(p_date, current_date), v_id);
  end if;

  -- tell everyone else
  v_me_name := luma.person_name(v_me); v_payer_name := luma.person_name(p_paid_by);
  for r in select user_id, share from luma.expense_split_members where split_id = v_id and user_id <> v_me loop
    perform luma.notify(r.user_id, 'split',
      '🧾 ' || v_me_name || (case when v_creating then ' split "' else ' updated the split "' end) || v_title || '" with you',
      case when r.user_id = p_paid_by then 'You paid RM ' || to_char(v_total, 'FM999999990.00') || '. The others will pay you back.'
           else 'Your share is RM ' || to_char(r.share, 'FM999999990.00') || ', paid by ' || (case when p_paid_by = v_me then 'them' else v_payer_name end) || '.' end,
      'split', v_id);
  end loop;
  return v_id;
end;
$$;
revoke execute on function luma.save_split(uuid, text, numeric, uuid, date, text, text, jsonb, numeric, text) from public, anon;
grant execute on function luma.save_split(uuid, text, numeric, uuid, date, text, text, jsonb, numeric, text) to authenticated;

create or replace function luma.delete_split(p_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; r record;
begin
  select title into v_title from luma.expense_splits where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Only the person who created this split can delete it'; end if;
  for r in select user_id from luma.expense_split_members where split_id = p_id and user_id <> auth.uid() loop
    perform luma.notify(r.user_id, 'split', '🗑️ ' || luma.person_name(auth.uid()) || ' deleted the split "' || v_title || '"', 'It is gone from your list.', 'split');
  end loop;
  delete from luma.expense_splits where id = p_id;   -- members and the Money entry go with it
end;
$$;
revoke execute on function luma.delete_split(uuid) from public, anon;
grant execute on function luma.delete_split(uuid) to authenticated;

-- every split I made or am in, with who owes what
create or replace function luma.my_splits()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'split_date') desc, (x ->> 'created_at') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', s.id, 'title', s.title, 'total', s.total, 'paid_by', s.paid_by, 'paid_by_name', luma.person_name(s.paid_by),
      'owner_id', s.owner_id, 'owner_name', luma.person_name(s.owner_id), 'split_date', s.split_date, 'note', s.note, 'method', s.method, 'subtotal', s.subtotal, 'tax_label', s.tax_label, 'created_at', s.created_at,
      'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', luma.person_name(m.user_id), 'share', m.share, 'paid', m.paid, 'paid_at', m.paid_at) order by m.share desc, m.user_id)
                  from luma.expense_split_members m where m.split_id = s.id)) as x
    from luma.expense_splits s
    where s.owner_id = auth.uid() or exists (select 1 from luma.expense_split_members mm where mm.split_id = s.id and mm.user_id = auth.uid())
    order by s.split_date desc, s.created_at desc
    limit 300
  ) q;
$$;
revoke execute on function luma.my_splits() from public, anon;
grant execute on function luma.my_splits() to authenticated;

-- the person who paid marks (or un-marks) someone's share as paid back
create or replace function luma.mark_split_paid(p_split uuid, p_user uuid, p_paid boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; v_payer uuid; v_share numeric;
begin
  select title, paid_by into v_title, v_payer from luma.expense_splits where id = p_split;
  if not found then raise exception 'That split no longer exists'; end if;
  if v_payer <> auth.uid() then raise exception 'Only the person who paid can mark shares as paid'; end if;
  if p_user = v_payer then raise exception 'The person who paid has nothing to pay back'; end if;
  update luma.expense_split_members set paid = coalesce(p_paid, true), paid_at = case when coalesce(p_paid, true) then now() end
    where split_id = p_split and user_id = p_user returning share into v_share;
  if not found then raise exception 'That person is not in this split'; end if;
  if coalesce(p_paid, true) then
    perform luma.notify(p_user, 'split', '✅ ' || luma.person_name(auth.uid()) || ' marked your share as paid', '"' || v_title || '" · RM ' || to_char(v_share, 'FM999999990.00'), 'split', p_split);
  end if;
end;
$$;
revoke execute on function luma.mark_split_paid(uuid, uuid, boolean) from public, anon;
grant execute on function luma.mark_split_paid(uuid, uuid, boolean) to authenticated;

-- the person who paid reminds someone (once every 6 hours)
create or replace function luma.nudge_split_member(p_split uuid, p_user uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; v_payer uuid; v_share numeric; v_last timestamptz; v_paid boolean;
begin
  select title, paid_by into v_title, v_payer from luma.expense_splits where id = p_split;
  if not found or v_payer <> auth.uid() then raise exception 'Only the person who paid can send a reminder'; end if;
  select share, last_nudged_at, paid into v_share, v_last, v_paid from luma.expense_split_members where split_id = p_split and user_id = p_user;
  if not found or p_user = v_payer or v_paid then return 'nothing_to_remind'; end if;
  if v_last is not null and v_last > now() - interval '6 hours' then return 'too_soon'; end if;
  update luma.expense_split_members set last_nudged_at = now() where split_id = p_split and user_id = p_user;
  perform luma.notify(p_user, 'split_nudge', '👋 ' || luma.person_name(auth.uid()) || ' is waiting for your share', '"' || v_title || '" · RM ' || to_char(v_share, 'FM999999990.00'), 'split', p_split);
  return 'sent';
end;
$$;
revoke execute on function luma.nudge_split_member(uuid, uuid) from public, anon;
grant execute on function luma.nudge_split_member(uuid, uuid) to authenticated;
