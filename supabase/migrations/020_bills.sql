-- ============================================================
-- LUMA — migration 020: Bills module.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- one row per bill. `due_date` is the (first) due date: a "once" bill is due on it, a "monthly" bill on the same
-- day every month from it, a "yearly" bill on the same day every year.
create table if not exists luma.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  amount numeric not null check (amount > 0),
  category text not null default 'Other' check (category in ('Internet', 'Electricity', 'Water', 'Phone', 'Insurance', 'Credit card', 'Rent', 'Subscription', 'Loan', 'Other')),
  recurrence text not null default 'monthly' check (recurrence in ('once', 'monthly', 'yearly')),
  due_date date not null,
  note text not null default '' check (length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bills_user on luma.bills (user_id, due_date);

alter table luma.bills enable row level security;

drop policy if exists "Users manage their own bills" on luma.bills;
create policy "Users manage their own bills"
  on luma.bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_bills_updated_at on luma.bills;
create trigger set_luma_bills_updated_at
  before update on luma.bills
  for each row execute function luma.set_updated_at();

-- one row per bill per due date that was paid (no row = not paid)
create table if not exists luma.bill_payments (
  bill_id uuid not null references luma.bills(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  due_date date not null,
  amount numeric not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  primary key (bill_id, due_date)
);

create index if not exists bill_payments_user on luma.bill_payments (user_id, due_date desc);

alter table luma.bill_payments enable row level security;

drop policy if exists "Users manage their own bill payments" on luma.bill_payments;
create policy "Users manage their own bill payments"
  on luma.bill_payments for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from luma.bills b where b.id = bill_id and b.user_id = auth.uid())
  );

grant all on luma.bills to anon, authenticated;
grant all on luma.bill_payments to anon, authenticated;
