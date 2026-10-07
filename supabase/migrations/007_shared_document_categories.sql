-- ============================================================
-- LUMA — migration 007: let a recipient file a shared document under
-- one of their OWN categories. Depends on 003 and 004.
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- The category lives on the share row (it is the recipient's private filing,
-- the owner's own category for the document is unaffected). Deleting the
-- category just un-files the shared document.
alter table luma.document_shares
  add column if not exists recipient_category_id uuid
  references luma.document_categories(id) on delete set null;

-- Recipients can't update share rows directly (no update policy), so filing
-- goes through this function, which checks the caller really is the recipient
-- and that the category is theirs. NULL un-files it.
create or replace function luma.set_shared_document_category(p_document uuid, p_category uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_category is not null and not exists (
    select 1 from luma.document_categories c where c.id = p_category and c.user_id = auth.uid()
  ) then
    raise exception 'Invalid category.';
  end if;

  update luma.document_shares
  set recipient_category_id = p_category
  where document_id = p_document and shared_with = auth.uid();

  if not found then
    raise exception 'That document is not shared with you.';
  end if;
end;
$$;

grant execute on function luma.set_shared_document_category(uuid, uuid) to authenticated;

-- list_shared_documents gains recipient_category_id; the return type
-- changes, so drop and recreate rather than "create or replace".
drop function if exists luma.list_shared_documents();
create function luma.list_shared_documents()
returns table (
  id uuid,
  name text,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  created_at timestamptz,
  shared_at timestamptz,
  owner_id uuid,
  owner_first_name text,
  owner_last_name text,
  owner_email text,
  recipient_category_id uuid
)
language sql security definer stable set search_path = ''
as $$
  select d.id, d.name, d.mime_type, d.size_bytes, d.storage_path, d.created_at,
         s.created_at, d.user_id, p.first_name, p.last_name, p.email,
         s.recipient_category_id
  from luma.document_shares s
  join luma.documents d on d.id = s.document_id
  join luma.profiles p on p.id = d.user_id
  where s.shared_with = auth.uid()
  order by s.created_at desc;
$$;

grant execute on function luma.list_shared_documents() to authenticated;
