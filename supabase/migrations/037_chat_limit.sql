-- ============================================================
-- LUMA — migration 037: daily limit on chat messages to contacts (50 a day, every plan).
-- The day follows each sender's own time zone and resets at midnight. The number lives in luma.plan_limits
-- (key 'chat_messages'); change a row to change the limit for a plan, or set it to NULL for unlimited.
-- Depends on 001 (messages), 028 (luma.user_tz), 033 (plan limits). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

insert into luma.plan_limits (plan, key, value) values
  ('dawn', 'chat_messages', 50), ('glow', 'chat_messages', 50), ('zenith', 'chat_messages', 50)
on conflict (plan, key) do update set value = excluded.value;

-- messages this sender has sent since local midnight
create or replace function luma.messages_sent_today(p_user uuid)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::int from luma.messages m
  where m.sender_id = p_user
    and m.created_at >= (date_trunc('day', timezone(luma.user_tz(p_user), now())) at time zone luma.user_tz(p_user));
$$;
revoke execute on function luma.messages_sent_today(uuid) from public, anon, authenticated;

create or replace function luma.enforce_message_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_limit int := luma.limit_of(new.sender_id, 'chat_messages');
begin
  if v_limit is not null and luma.messages_sent_today(new.sender_id) >= v_limit then
    raise exception 'Daily limit reached: you can send up to % chat messages a day. It resets at midnight.', v_limit;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_chat_limit on luma.messages;
create trigger enforce_chat_limit before insert on luma.messages
  for each row execute function luma.enforce_message_limit();

-- how many are left today (NULL = unlimited); the chat shows it
create or replace function luma.chat_left_today()
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select case when luma.limit_of(auth.uid(), 'chat_messages') is null then null
              else greatest(0, luma.limit_of(auth.uid(), 'chat_messages') - luma.messages_sent_today(auth.uid())) end;
$$;
revoke execute on function luma.chat_left_today() from public, anon;
grant execute on function luma.chat_left_today() to authenticated;
