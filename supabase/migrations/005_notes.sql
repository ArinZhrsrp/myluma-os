-- ============================================================
-- LUMA — migration 005: Notes & Docs module.
-- Depends on 001 (luma schema, luma.set_updated_at()) and 003/004
-- (documents, which notes can reference). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  tag text not null default 'Personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated on luma.notes (user_id, updated_at desc);

alter table luma.notes enable row level security;

drop policy if exists "Users manage their own notes" on luma.notes;
create policy "Users manage their own notes"
  on luma.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_notes_updated_at on luma.notes;
create trigger set_luma_notes_updated_at
  before update on luma.notes
  for each row execute function luma.set_updated_at();

-- ---------- note ↔ document links ----------
-- A note references documents from the Documents menu (own files, or files
-- shared with the user). Deleting either side removes the link only.
create table if not exists luma.note_documents (
  note_id uuid not null references luma.notes(id) on delete cascade,
  document_id uuid not null references luma.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, document_id)
);

create index if not exists note_documents_document on luma.note_documents (document_id);

alter table luma.note_documents enable row level security;

drop policy if exists "Users manage links on their own notes" on luma.note_documents;
create policy "Users manage links on their own notes"
  on luma.note_documents for all
  using (exists (select 1 from luma.notes n where n.id = note_id and n.user_id = auth.uid()))
  with check (
    exists (select 1 from luma.notes n where n.id = note_id and n.user_id = auth.uid())
    -- and the document must be one the caller can already see
    and exists (select 1 from luma.documents d where d.id = document_id)
  );

grant all on luma.notes, luma.note_documents to anon, authenticated;
