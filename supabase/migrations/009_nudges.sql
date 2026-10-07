-- ============================================================
-- LUMA — migration 009: nudge a contact ("hey, read my message").
-- Depends on 001 (contacts) and 008 (notifications).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- who triggered the notification, and which contact/chat it refers to
-- (so clicking a nudge can open that exact chat)
alter table luma.notifications add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table luma.notifications add column if not exists ref uuid;

create index if not exists notifications_nudge_rate
  on luma.notifications (user_id, actor_id, created_at desc) where type = 'nudge';

-- Sends a 'nudge' notification to the other person in an accepted contact.
-- Only the two participants can use it, and the same sender can nudge the
-- same person at most once every 3 minutes (so it can't be used to spam).
-- The limit is per sender → receiver: being nudged by someone never stops you
-- from nudging them back.
-- Returns ok / reason ('sent' | 'not_found' | 'too_soon') / retry_after (seconds).
create or replace function luma.nudge_contact(p_contact uuid)
returns table (ok boolean, reason text, retry_after int)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_contact luma.contacts%rowtype;
  v_target uuid;
  v_last timestamptz;
  v_wait int := 180; -- seconds between nudges to the same person
begin
  select * into v_contact
  from luma.contacts c
  where c.id = p_contact
    and c.status = 'accepted'
    and (c.requester_id = auth.uid() or c.addressee_id = auth.uid());

  if not found then
    return query select false, 'not_found', 0;
    return;
  end if;

  v_target := case when v_contact.requester_id = auth.uid() then v_contact.addressee_id else v_contact.requester_id end;

  select max(n.created_at) into v_last
  from luma.notifications n
  where n.user_id = v_target and n.actor_id = auth.uid() and n.type = 'nudge';

  if v_last is not null and v_last > now() - make_interval(secs => v_wait) then
    return query select false, 'too_soon',
      greatest(1, ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - now())))::int);
    return;
  end if;

  insert into luma.notifications (user_id, type, title, body, link, actor_id, ref)
  values (
    v_target, 'nudge',
    luma.display_name(auth.uid()) || ' nudged you 👋',
    'You have a message waiting — open the chat to read it.',
    'contacts', auth.uid(), p_contact
  );

  return query select true, 'sent', 0;
end;
$$;

grant execute on function luma.nudge_contact(uuid) to authenticated;
