-- ============================================================
-- LUMA — migration 092: a person can reply to the note an administrator left on their feedback.
--   • luma.feedback_replies: one row per reply. Only the person who sent the feedback can add one (up to 10 a day, 1000 characters);
--     that person and the administrators can read them.
--   • Every administrator is told about a new reply (same notification as new feedback, opening the Feedback inbox).
-- Depends on 081. Safe to re-run.
-- ============================================================

create table if not exists luma.feedback_replies (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references luma.feedback (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists feedback_replies_fb_idx on luma.feedback_replies (feedback_id, created_at);

alter table luma.feedback_replies enable row level security;
drop policy if exists feedback_replies_read on luma.feedback_replies;
drop policy if exists feedback_replies_insert on luma.feedback_replies;
create policy feedback_replies_read on luma.feedback_replies for select to authenticated
  using (user_id = auth.uid() or luma.is_admin() or exists (select 1 from luma.feedback f where f.id = feedback_id and f.user_id = auth.uid()));
create policy feedback_replies_insert on luma.feedback_replies for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from luma.feedback f where f.id = feedback_id and f.user_id = auth.uid()));
revoke all on luma.feedback_replies from anon, authenticated;
grant select, insert on luma.feedback_replies to authenticated;

create or replace function luma.feedback_reply_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select count(*) from luma.feedback_replies where user_id = new.user_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You can send up to 10 replies a day. Please try again tomorrow.';
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;
drop trigger if exists feedback_reply_guard on luma.feedback_replies;
create trigger feedback_reply_guard before insert on luma.feedback_replies for each row execute function luma.feedback_reply_guard();

create or replace function luma.feedback_reply_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid; v_f record;
begin
  select module, part into v_f from luma.feedback where id = new.feedback_id;
  for v_a in select a.user_id from luma.admin_users a where a.user_id <> new.user_id limit 20 loop
    perform luma.notify(v_a, 'feedback', '💬 Reply on feedback: ' || coalesce(v_f.module, ''), left(new.body, 120), 'adminfeedback', new.feedback_id);
  end loop;
  return null;
end;
$$;
drop trigger if exists feedback_reply_notify on luma.feedback_replies;
create trigger feedback_reply_notify after insert on luma.feedback_replies for each row execute function luma.feedback_reply_notify();

-- make the API see the new table straight away
notify pgrst, 'reload schema';
