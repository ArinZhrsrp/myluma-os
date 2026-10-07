-- ============================================================
-- LUMA — migration 004: share documents with accepted contacts.
-- Depends on 001 (contacts) and 003 (documents + storage bucket).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.document_shares (
  document_id uuid not null references luma.documents(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  shared_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, shared_with),
  check (shared_with <> shared_by)
);

create index if not exists document_shares_shared_with on luma.document_shares (shared_with);

-- Helpers are security definer so the policies below never trigger each
-- other's RLS (documents ↔ document_shares would otherwise recurse).
create or replace function luma.owns_document(p_doc uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (select 1 from luma.documents d where d.id = p_doc and d.user_id = auth.uid());
$$;

create or replace function luma.is_accepted_contact(p_other uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from luma.contacts c
    where c.status = 'accepted'
      and ((c.requester_id = auth.uid() and c.addressee_id = p_other)
        or (c.addressee_id = auth.uid() and c.requester_id = p_other))
  );
$$;

-- true if a document shared with the caller lives at this Storage path
create or replace function luma.can_read_shared_file(p_path text)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from luma.documents d
    join luma.document_shares s on s.document_id = d.id
    where d.storage_path = p_path and s.shared_with = auth.uid()
  );
$$;

alter table luma.document_shares enable row level security;

drop policy if exists "Owner and recipient can view a share" on luma.document_shares;
create policy "Owner and recipient can view a share"
  on luma.document_shares for select
  using (auth.uid() = shared_by or auth.uid() = shared_with);

-- only your own documents, only with people you're connected to
drop policy if exists "Owner can share with an accepted contact" on luma.document_shares;
create policy "Owner can share with an accepted contact"
  on luma.document_shares for insert
  with check (
    shared_by = auth.uid()
    and luma.owns_document(document_id)
    and luma.is_accepted_contact(shared_with)
  );

-- owner can unshare; recipient can remove it from their own list
drop policy if exists "Owner or recipient can remove a share" on luma.document_shares;
create policy "Owner or recipient can remove a share"
  on luma.document_shares for delete
  using (auth.uid() = shared_by or auth.uid() = shared_with);

-- recipients can read the shared documents row (read-only)...
drop policy if exists "Recipients can view shared documents" on luma.documents;
create policy "Recipients can view shared documents"
  on luma.documents for select
  using (exists (
    select 1 from luma.document_shares s
    where s.document_id = documents.id and s.shared_with = auth.uid()
  ));

-- ...and download the file itself
drop policy if exists "Recipients can read shared document files" on storage.objects;
create policy "Recipients can read shared document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'luma-documents' and luma.can_read_shared_file(name));

-- Documents others have shared with the caller, with the owner's name
-- joined in (profiles are not readable across users directly).
create or replace function luma.list_shared_documents()
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
  owner_email text
)
language sql security definer stable set search_path = ''
as $$
  select d.id, d.name, d.mime_type, d.size_bytes, d.storage_path, d.created_at,
         s.created_at, d.user_id, p.first_name, p.last_name, p.email
  from luma.document_shares s
  join luma.documents d on d.id = s.document_id
  join luma.profiles p on p.id = d.user_id
  where s.shared_with = auth.uid()
  order by s.created_at desc;
$$;

grant all on luma.document_shares to anon, authenticated;
grant execute on function luma.list_shared_documents() to authenticated;
grant execute on function luma.owns_document(uuid), luma.is_accepted_contact(uuid), luma.can_read_shared_file(text) to authenticated;
