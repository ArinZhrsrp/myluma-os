-- ============================================================
-- LUMA — migration 048: invite people to a calendar event (every plan).
--   • You can invite your ACCEPTED CONTACTS to an event you made. They get a notification, and the event is
--     in their calendar as "invited" until they accept (then it is a normal entry for them) or decline.
--   • Everyone on an event can see who is on it (name and whether they are going).
--   • Invitees only ever see the one event they were invited to — nothing else of yours. The event stays yours:
--     only you can change or delete it (deleting it removes it for everyone).
--   • Everything goes through the functions below; the table itself can't be read or written directly.
-- Depends on 001 (contacts), 008 (notifications), 027 (events). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.event_invites (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references luma.events(id) on delete cascade,
  inviter_id   uuid not null references auth.users(id) on delete cascade,
  invitee_id   uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, invitee_id)
);
create index if not exists event_invites_invitee on luma.event_invites (invitee_id, status);
alter table luma.event_invites enable row level security;
revoke all on luma.event_invites from anon, authenticated;

create or replace function luma.person_name(p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email, 'Someone')
  from luma.profiles p where p.id = p_user;
$$;
revoke execute on function luma.person_name(uuid) from public, anon, authenticated;

-- invite accepted contacts to one of your events; returns how many were newly invited
create or replace function luma.invite_to_event(p_event uuid, p_users uuid[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev record;
  v_user uuid;
  v_count int := 0;
  v_total int;
  v_row luma.event_invites;
begin
  select * into v_ev from luma.events where id = p_event and user_id = auth.uid();
  if not found then raise exception 'You can only invite people to your own events'; end if;
  select count(*) into v_total from luma.event_invites where event_id = p_event and status <> 'declined';
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not exists (select 1 from luma.contacts c where c.status = 'accepted'
                   and ((c.requester_id = auth.uid() and c.addressee_id = v_user) or (c.addressee_id = auth.uid() and c.requester_id = v_user))) then
      raise exception 'You can only invite people who are in your contacts';
    end if;
    select * into v_row from luma.event_invites where event_id = p_event and invitee_id = v_user;
    if found and v_row.status <> 'declined' then continue; end if;   -- already invited
    if v_total >= 30 then raise exception 'An event can have up to 30 guests'; end if;
    insert into luma.event_invites (event_id, inviter_id, invitee_id) values (p_event, auth.uid(), v_user)
      on conflict (event_id, invitee_id) do update set status = 'pending', responded_at = null, created_at = now();
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'event_invite', '📅 ' || luma.person_name(auth.uid()) || ' invited you to ' || v_ev.title,
      to_char(v_ev.event_date, 'FMDay, FMDD Mon') || case when v_ev.all_day then ' · all day' else ' · ' || to_char(v_ev.start_time, 'FMHH12:MI am') end || '. Open your calendar to accept or decline.', 'calendar');
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.invite_to_event(uuid, uuid[]) from public, anon;
grant execute on function luma.invite_to_event(uuid, uuid[]) to authenticated;

-- the invited person accepts or declines (or leaves an event they accepted)
create or replace function luma.respond_event_invite(p_event uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_inv luma.event_invites; v_title text;
begin
  select * into v_inv from luma.event_invites where event_id = p_event and invitee_id = auth.uid();
  if not found then raise exception 'No invitation found'; end if;
  update luma.event_invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = v_inv.id;
  select title into v_title from luma.events where id = p_event;
  perform luma.notify(v_inv.inviter_id, 'event_invite_reply',
    (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' is coming to ' else ' can''t make ' end) || coalesce(v_title, 'your event'),
    'Open your calendar to see who is on the guest list.', 'calendar');
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
revoke execute on function luma.respond_event_invite(uuid, boolean) from public, anon;
grant execute on function luma.respond_event_invite(uuid, boolean) to authenticated;

-- the organiser removes a guest
create or replace function luma.uninvite_from_event(p_event uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from luma.events where id = p_event and user_id = auth.uid()) then raise exception 'Not your event'; end if;
  delete from luma.event_invites where event_id = p_event and invitee_id = p_user;
  return true;
end;
$$;
revoke execute on function luma.uninvite_from_event(uuid, uuid) from public, anon;
grant execute on function luma.uninvite_from_event(uuid, uuid) to authenticated;

-- events other people invited me to (pending and accepted), with who organised them
create or replace function luma.my_invited_events()
returns table (
  id uuid, title text, category text, event_date date, all_day boolean, start_time time, end_time time, repeats text, note text,
  created_at timestamptz, owner_id uuid, owner_name text, my_status text
)
language sql
stable
security definer set search_path = ''
as $$
  select e.id, e.title, e.category, e.event_date, e.all_day, e.start_time, e.end_time, e.repeats, e.note,
         e.created_at, e.user_id, luma.person_name(e.user_id), i.status
  from luma.event_invites i
  join luma.events e on e.id = i.event_id
  where i.invitee_id = auth.uid() and i.status in ('pending', 'accepted')
  order by e.event_date;
$$;
revoke execute on function luma.my_invited_events() from public, anon;
grant execute on function luma.my_invited_events() to authenticated;

-- who is on an event: the organiser and the guests (the organiser also sees who declined)
create or replace function luma.event_attendees(p_event uuid)
returns table (user_id uuid, name text, status text, is_owner boolean)
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_owner uuid; v_is_owner boolean;
begin
  select e.user_id into v_owner from luma.events e where e.id = p_event;
  if v_owner is null then return; end if;
  v_is_owner := v_owner = auth.uid();
  if not v_is_owner and not exists (select 1 from luma.event_invites i where i.event_id = p_event and i.invitee_id = auth.uid() and i.status in ('pending', 'accepted')) then
    raise exception 'Not allowed';
  end if;
  return query
    select v_owner, luma.person_name(v_owner), 'accepted'::text, true
    union all
    select i.invitee_id, luma.person_name(i.invitee_id), i.status, false
    from luma.event_invites i
    where i.event_id = p_event and (v_is_owner or i.status in ('pending', 'accepted'))
    order by 4 desc, 2;
end;
$$;
revoke execute on function luma.event_attendees(uuid) from public, anon;
grant execute on function luma.event_attendees(uuid) to authenticated;
