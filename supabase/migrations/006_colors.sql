-- ============================================================
-- LUMA — migration 006: user-chosen colours for document categories
-- and note tags. Depends on 003 (document_categories) and 005 (notes).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- Category colour: a #rrggbb hex. NULL = not chosen yet (the app falls back
-- to a stable colour derived from the category's id).
alter table luma.document_categories
  add column if not exists color text;

alter table luma.document_categories
  drop constraint if exists document_categories_color_hex;
alter table luma.document_categories
  add constraint document_categories_color_hex check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- Tags are plain text on notes, so their colours live in their own table:
-- one row per (user, tag name), case-insensitive.
create table if not exists luma.note_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists note_tags_user_name
  on luma.note_tags (user_id, lower(name));

alter table luma.note_tags enable row level security;

drop policy if exists "Users manage their own tag colours" on luma.note_tags;
create policy "Users manage their own tag colours"
  on luma.note_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.note_tags to anon, authenticated;
