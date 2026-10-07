-- ============================================================
-- LUMA — migration 029: Lumi assistant daily usage limit.
-- Depends on 001 and 028 (luma.user_tz). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- how many assistant requests each user has made per day, per kind ('chat' questions, 'insights' for Analytics)
create table if not exists luma.assistant_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  kind text not null default 'chat',
  used integer not null default 0,
  primary key (user_id, day, kind)
);

alter table luma.assistant_usage enable row level security;

drop policy if exists "Users read their own assistant usage" on luma.assistant_usage;
create policy "Users read their own assistant usage"
  on luma.assistant_usage for select
  using (auth.uid() = user_id);

grant select on luma.assistant_usage to authenticated;

-- uses one request; returns how many are LEFT today, or -1 when the daily limit is already reached.
-- "Today" follows the user's own time zone.
create or replace function luma.use_assistant(p_kind text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = luma, public
as $$
declare
  v_day date := (timezone(luma.user_tz(auth.uid()), now()))::date;
  v_used integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into luma.assistant_usage (user_id, day, kind, used) values (auth.uid(), v_day, p_kind, 0)
    on conflict do nothing;
  update luma.assistant_usage set used = used + 1
    where user_id = auth.uid() and day = v_day and kind = p_kind and used < p_limit
    returning used into v_used;
  if v_used is null then return -1; end if;
  return p_limit - v_used;
end;
$$;

-- gives one request back (used when the AI provider failed, so a failed answer doesn't cost the user a question)
create or replace function luma.refund_assistant(p_kind text)
returns void
language plpgsql
security definer
set search_path = luma, public
as $$
begin
  update luma.assistant_usage set used = greatest(0, used - 1)
    where user_id = auth.uid() and day = (timezone(luma.user_tz(auth.uid()), now()))::date and kind = p_kind;
end;
$$;

-- how many are left today, without using one
create or replace function luma.assistant_left(p_kind text, p_limit integer)
returns integer
language sql
security definer
set search_path = luma, public
stable
as $$
  select p_limit - coalesce((select used from luma.assistant_usage
    where user_id = auth.uid() and day = (timezone(luma.user_tz(auth.uid()), now()))::date and kind = p_kind), 0);
$$;

revoke execute on function luma.use_assistant(text, integer) from public, anon;
revoke execute on function luma.refund_assistant(text) from public, anon;
revoke execute on function luma.assistant_left(text, integer) from public, anon;
grant execute on function luma.use_assistant(text, integer) to authenticated;
grant execute on function luma.refund_assistant(text) to authenticated;
grant execute on function luma.assistant_left(text, integer) to authenticated;
