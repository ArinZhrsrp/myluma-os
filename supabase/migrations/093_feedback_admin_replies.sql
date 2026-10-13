-- ============================================================
-- LUMA — migration 093: administrators can reply on a feedback too (a two-way thread with the person).
--   • feedback_replies.from_admin tells whose reply it is (set by the database, not by the page).
--   • A reply from an administrator tells the person who sent the feedback; a reply from the person tells the administrators.
--   • The 10-a-day limit is for people; administrators are not limited.
-- Depends on 092. Safe to re-run.
-- ============================================================

alter table luma.feedback_replies add column if not exists from_admin boolean not null default false;

drop policy if exists feedback_replies_insert on luma.feedback_replies;
create policy feedback_replies_insert on luma.feedback_replies for insert to authenticated
  with check (user_id = auth.uid() and (luma.is_admin() or exists (select 1 from luma.feedback f where f.id = feedback_id and f.user_id = auth.uid())));

create or replace function luma.feedback_reply_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.from_admin := luma.is_admin();
  if not new.from_admin and (select count(*) from luma.feedback_replies where user_id = new.user_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You can send up to 10 replies a day. Please try again tomorrow.';
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;

create or replace function luma.feedback_reply_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid; v_f record;
begin
  select module, part, user_id into v_f from luma.feedback where id = new.feedback_id;
  if new.from_admin then
    if v_f.user_id is not null and v_f.user_id <> new.user_id then
      perform luma.notify(v_f.user_id, 'feedback_reply', '💬 New reply on your feedback: ' || coalesce(v_f.module, ''), left(new.body, 120), 'feedback', new.feedback_id);
    end if;
  else
    for v_a in select a.user_id from luma.admin_users a where a.user_id <> new.user_id limit 20 loop
      perform luma.notify(v_a, 'feedback', '💬 Reply on feedback: ' || coalesce(v_f.module, ''), left(new.body, 120), 'adminfeedback', new.feedback_id);
    end loop;
  end if;
  return null;
end;
$$;

notify pgrst, 'reload schema';
