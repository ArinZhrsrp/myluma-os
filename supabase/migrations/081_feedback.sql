-- ============================================================
-- LUMA — migration 081: feedback to the developer.
--   • luma.feedback: what a person sends from the new Feedback page: the module and the part of it, what kind (bug / idea / question / praise),
--     their comments, an optional picture, and a little context (page, version, mode, screen). Nothing else about them is attached
--     except a snapshot of their name and email so a reply is possible even if they later delete their account.
--   • At most 10 messages per person per day. People can read their own; administrators can read everything and set a status + a note
--     (admin_feedback_update); the person is told when the status becomes Planned or Done. Every administrator is told about new feedback.
--   • Private storage bucket luma-feedback (5 MB, images only), one folder per person; administrators can open any picture.
-- Depends on 036 (admin), 008 (notify), 048 (person_name). Safe to re-run.
-- ============================================================

create table if not exists luma.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  user_label  text not null default '',
  kind        text not null default 'idea' check (kind in ('bug', 'idea', 'question', 'praise')),
  module      text not null check (length(btrim(module)) between 1 and 60),
  part        text not null default '' check (length(part) <= 80),
  message     text not null check (length(btrim(message)) between 3 and 4000),
  image_path  text check (image_path is null or length(image_path) <= 300),
  context     jsonb not null default '{}'::jsonb check (length(context::text) <= 2000),
  status      text not null default 'new' check (status in ('new', 'seen', 'planned', 'done', 'wontfix')),
  admin_note  text not null default '' check (length(admin_note) <= 1000),
  handled_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists feedback_status_idx on luma.feedback (status, created_at desc);
create index if not exists feedback_user_idx on luma.feedback (user_id, created_at desc);

alter table luma.feedback enable row level security;
drop policy if exists feedback_read on luma.feedback;
drop policy if exists feedback_insert on luma.feedback;
create policy feedback_read on luma.feedback for select to authenticated using (user_id = auth.uid() or luma.is_admin());
create policy feedback_insert on luma.feedback for insert to authenticated with check (user_id = auth.uid());
revoke all on luma.feedback from anon, authenticated;
grant select, insert on luma.feedback to authenticated;

create or replace function luma.feedback_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_label text;
begin
  if new.user_id is null then raise exception 'Not signed in'; end if;
  if (select count(*) from luma.feedback where user_id = new.user_id and created_at > now() - interval '24 hours') >= 10 then raise exception 'You can send up to 10 messages a day. Please try again tomorrow.'; end if;
  if new.image_path is not null and new.image_path not like new.user_id::text || '/%' then raise exception 'That picture is not yours'; end if;
  select btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) || ' <' || coalesce(p.email, '') || '>' into v_label from luma.profiles p where p.id = new.user_id;
  new.user_label := left(coalesce(v_label, ''), 200);
  new.message := btrim(new.message); new.part := btrim(new.part); new.status := 'new'; new.admin_note := ''; new.handled_by := null;
  return new;
end;
$$;
drop trigger if exists feedback_guard on luma.feedback;
create trigger feedback_guard before insert on luma.feedback for each row execute function luma.feedback_guard();

-- every administrator is told (up to 20)
create or replace function luma.feedback_notify_admins()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid;
begin
  for v_a in select a.user_id from luma.admin_users a where a.user_id <> new.user_id limit 20 loop
    perform luma.notify(v_a, 'feedback', '💡 New feedback: ' || new.module || case when new.part <> '' then ' › ' || new.part else '' end, left(new.message, 120), 'adminfeedback', new.id);
  end loop;
  return null;
end;
$$;
drop trigger if exists feedback_notify on luma.feedback;
create trigger feedback_notify after insert on luma.feedback for each row execute function luma.feedback_notify_admins();

create or replace function luma.admin_feedback_update(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_f record;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_status not in ('new', 'seen', 'planned', 'done', 'wontfix') then raise exception 'Unknown status'; end if;
  select * into v_f from luma.feedback where id = p_id;
  if not found then raise exception 'Not found'; end if;
  update luma.feedback set status = p_status, admin_note = left(coalesce(p_note, ''), 1000), handled_by = auth.uid(), updated_at = now() where id = p_id;
  if v_f.user_id is not null and p_status in ('planned', 'done') and p_status <> v_f.status then
    perform luma.notify(v_f.user_id, 'feedback_reply', case when p_status = 'done' then '✅ Your feedback was done: ' else '🗓 Your feedback is planned: ' end || v_f.module, coalesce(nullif(btrim(p_note), ''), left(v_f.message, 100)), 'feedback', p_id);
  end if;
end;
$$;
revoke execute on function luma.admin_feedback_update(uuid, text, text) from public, anon;
grant execute on function luma.admin_feedback_update(uuid, text, text) to authenticated;

create or replace function luma.admin_feedback_delete(p_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  delete from luma.feedback where id = p_id;
end;
$$;
revoke execute on function luma.admin_feedback_delete(uuid) from public, anon;
grant execute on function luma.admin_feedback_delete(uuid) to authenticated;

-- ---------- pictures ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('luma-feedback', 'luma-feedback', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload feedback pictures to their own folder" on storage.objects;
create policy "Users upload feedback pictures to their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'luma-feedback' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users and administrators read feedback pictures" on storage.objects;
create policy "Users and administrators read feedback pictures" on storage.objects for select to authenticated
  using (bucket_id = 'luma-feedback' and ((storage.foldername(name))[1] = auth.uid()::text or luma.is_admin()));
drop policy if exists "Users delete their own feedback pictures" on storage.objects;
create policy "Users delete their own feedback pictures" on storage.objects for delete to authenticated
  using (bucket_id = 'luma-feedback' and ((storage.foldername(name))[1] = auth.uid()::text or luma.is_admin()));
