-- ============================================================
-- LUMA — migration 099: a trace of every deleted document, and a notice to the people it was shared with.
--   • luma.document_deletions keeps one row per deleted document: what it was, who owned it, who deleted it (the owner, an administrator,
--     or the system, e.g. when an account or a semester is removed), when, and who it had been shared with.
--     The owner can read their own rows and administrators can read all of them. The rows stay when the account is deleted.
--   • Everyone the document was shared with gets a notification (and so a push): "<name> deleted a shared document".
-- Depends on 003, 004, 008. Safe to re-run.
-- ============================================================

create table if not exists luma.document_deletions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  owner_id    uuid,                                   -- no foreign key on purpose: the trace outlives the account
  name        text not null,
  mime_type   text,
  size_bytes  bigint,
  space       text,
  storage_path text,
  deleted_by  uuid,
  via         text not null default 'owner' check (via in ('owner', 'admin', 'system')),
  shared_with uuid[] not null default '{}',
  deleted_at  timestamptz not null default now()
);
create index if not exists document_deletions_owner_idx on luma.document_deletions (owner_id, deleted_at desc);
create index if not exists document_deletions_time_idx on luma.document_deletions (deleted_at desc);

alter table luma.document_deletions enable row level security;
drop policy if exists document_deletions_read on luma.document_deletions;
create policy document_deletions_read on luma.document_deletions for select to authenticated using (owner_id = auth.uid() or luma.is_admin());
revoke all on luma.document_deletions from anon, authenticated;
grant select on luma.document_deletions to authenticated;

create or replace function luma.log_document_delete()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_recips uuid[]; v_via text; v_who text; v_r uuid;
begin
  select coalesce(array_agg(s.shared_with), '{}') into v_recips from luma.document_shares s where s.document_id = old.id;
  v_via := case when auth.uid() is null then 'system' when auth.uid() = old.user_id then 'owner' when luma.is_admin() then 'admin' else 'owner' end;
  insert into luma.document_deletions (document_id, owner_id, name, mime_type, size_bytes, space, storage_path, deleted_by, via, shared_with)
    values (old.id, old.user_id, old.name, old.mime_type, old.size_bytes, to_jsonb(old) ->> 'space', old.storage_path, auth.uid(), v_via, v_recips);
  if v_via <> 'owner' then v_who := 'A document'; else v_who := coalesce(luma.display_name(old.user_id), 'Someone'); end if;
  foreach v_r in array v_recips loop
    if v_r is distinct from auth.uid() then
      perform luma.notify(v_r, 'document_deleted',
        case when v_via = 'owner' then v_who || ' deleted a shared document' else 'A shared document was removed' end,
        '“' || old.name || '” is no longer in Documents → Shared with me.', 'documents');
    end if;
  end loop;
  return old;
end;
$$;
drop trigger if exists log_document_delete on luma.documents;
create trigger log_document_delete before delete on luma.documents for each row execute function luma.log_document_delete();
