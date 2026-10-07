-- ============================================================
-- LUMA — migration 023: Money module + country on profiles.
-- Depends on 001 (profiles), 020 (bills). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ---------- country (chosen at sign-up / in Edit profile) ----------
-- Malaysian salary deductions (EPF, SOCSO, EIS, PCB …) are only worked out when this is 'Malaysia'.
alter table luma.profiles add column if not exists country text;

create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into luma.profiles (id, first_name, last_name, email, country)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    nullif(new.raw_user_meta_data ->> 'country', '')
  );
  return new;
end;
$$;

-- ---------- income + budget settings (one row per user) ----------
-- gross_salary = monthly gross pay. For Malaysia the app works out EPF / SOCSO / EIS / LINDUNG 24 Jam / PCB from it;
-- for other countries it is simply the monthly income you receive.
create table if not exists luma.money_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  gross_salary numeric not null default 0 check (gross_salary >= 0),
  epf_rate numeric not null default 11 check (epf_rate >= 0 and epf_rate <= 11),
  marital text not null default 'single' check (marital in ('single', 'married')),
  children smallint not null default 0 check (children between 0 and 30),
  other_relief numeric not null default 0 check (other_relief >= 0),
  pay_day smallint not null default 25 check (pay_day between 1 and 31),
  monthly_budget numeric not null default 0 check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table luma.money_settings enable row level security;

drop policy if exists "Users manage their own money settings" on luma.money_settings;
create policy "Users manage their own money settings"
  on luma.money_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_money_settings_updated_at on luma.money_settings;
create trigger set_luma_money_settings_updated_at
  before update on luma.money_settings
  for each row execute function luma.set_updated_at();

-- ---------- income / expense entries you log by hand ----------
-- (Bills and subscriptions you mark as paid count as spending automatically — they come from luma.bill_payments.)
create table if not exists luma.money_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount numeric not null check (amount > 0),
  category text not null default 'Other' check (length(category) <= 40),
  name text not null default '' check (length(name) <= 80),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists money_entries_user_date on luma.money_entries (user_id, entry_date desc);

alter table luma.money_entries enable row level security;

drop policy if exists "Users manage their own money entries" on luma.money_entries;
create policy "Users manage their own money entries"
  on luma.money_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.money_settings to anon, authenticated;
grant all on luma.money_entries to anon, authenticated;
