-- ============================================================
-- LUMA — migration 089: an administrator can start a chat with any account (to ask about feedback, etc.).
--   • luma.admin_start_chat(user) opens an accepted contact between the administrator and that person, so the
--     conversation appears in both people's Contacts and works like any other chat (the person can still remove it).
--   • These chats do not count toward anybody's contact limit. Every use is written to the admin log.
-- Depends on 001, 033, 036, 065. Safe to re-run.
-- ============================================================

alter table luma.contacts add column if not exists admin_chat boolean not null default false;

-- same rule as before (033), but a chat started by an administrator is not counted and is never blocked
create or replace function luma.enforce_contact_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_limit int;
  v_n int;
begin
  if new.admin_chat then return new; end if;
  if tg_op = 'INSERT' then v_user := new.requester_id;
  elsif new.status = 'accepted' and old.status <> 'accepted' then v_user := new.addressee_id;
  else return new; end if;
  v_limit := luma.limit_of(v_user, 'contacts');
  if v_limit is null then return new; end if;
  select count(*) into v_n from luma.contacts c
    where c.id <> new.id and not c.admin_chat
      and ((c.status = 'accepted' and (c.requester_id = v_user or c.addressee_id = v_user))
        or (c.status = 'pending' and c.requester_id = v_user));
  if v_n >= v_limit then
    raise exception 'Plan limit: the % plan allows up to % contacts. Upgrade your plan in Settings to add more.', initcap(luma.plan_of(v_user)), v_limit;
  end if;
  return new;
end;
$$;

create or replace function luma.admin_start_chat(p_user uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_email text; v_off timestamptz; v_id uuid; v_status text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_user = auth.uid() then raise exception 'You can not chat with yourself'; end if;
  select email, disabled_at into v_email, v_off from luma.profiles where id = p_user;
  if not found then raise exception 'No such user'; end if;
  if v_off is not null then raise exception 'This account is deactivated'; end if;

  select id, status into v_id, v_status from luma.contacts
    where least(requester_id, addressee_id) = least(auth.uid(), p_user)
      and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
  if v_id is null then
    insert into luma.contacts (requester_id, addressee_id, status, admin_chat)
      values (auth.uid(), p_user, 'accepted', true) returning id into v_id;
  elsif v_status <> 'accepted' then
    update luma.contacts set requester_id = auth.uid(), addressee_id = p_user, status = 'accepted', admin_chat = true where id = v_id;
  end if;
  perform luma.admin_log('start_chat', p_user, v_email, '{}'::jsonb);
  return v_id;
end;
$$;
revoke execute on function luma.admin_start_chat(uuid) from public, anon;
grant execute on function luma.admin_start_chat(uuid) to authenticated;
