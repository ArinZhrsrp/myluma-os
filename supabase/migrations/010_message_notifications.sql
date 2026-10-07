-- ============================================================
-- LUMA — migration 010: notify the receiver when a chat message arrives.
-- Depends on 001 (messages), 008 (notifications) and 009 (actor_id / ref).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- One notification per conversation while it's unread: a new message replaces
-- the previous unread "message" notification from the same sender, so a burst
-- of messages shows as a single, always-latest entry instead of flooding the
-- bell. (Each replacement is a fresh row, so the receiver still gets a live
-- pop-up for every message.)
create or replace function luma.notify_new_message()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_contact luma.contacts%rowtype;
  v_target uuid;
begin
  select * into v_contact from luma.contacts where id = new.contact_id;
  if not found then
    return new;
  end if;

  v_target := case when v_contact.requester_id = new.sender_id then v_contact.addressee_id else v_contact.requester_id end;

  delete from luma.notifications
  where user_id = v_target and type = 'message' and ref = new.contact_id
    and actor_id = new.sender_id and read_at is null;

  insert into luma.notifications (user_id, type, title, body, link, actor_id, ref)
  values (
    v_target, 'message',
    luma.display_name(new.sender_id) || ' sent you a message',
    left(new.body, 120),
    'contacts', new.sender_id, new.contact_id
  );

  return new;
end;
$$;

drop trigger if exists notify_on_new_message on luma.messages;
create trigger notify_on_new_message
  after insert on luma.messages
  for each row execute function luma.notify_new_message();
