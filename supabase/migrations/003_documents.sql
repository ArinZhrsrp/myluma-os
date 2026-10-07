-- ============================================================
-- LUMA — migration 003: Documents module (files + categories).
-- Depends on 001 (luma schema, luma.set_updated_at(), luma.profiles).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ---------- categories ----------
-- Per-user, fully editable (rename / add / delete). Seeded with defaults
-- for every user so the UI never has a special "built-in" case.
create table if not exists luma.document_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- Categories can nest (parent_id). Deleting a parent promotes its children
-- to top level rather than deleting them.
alter table luma.document_categories
  add column if not exists parent_id uuid references luma.document_categories(id) on delete set null;

-- names are unique among siblings, not globally ("Receipts" may exist under
-- both "Finance" and "Health")
drop index if exists luma.document_categories_user_name;
create unique index if not exists document_categories_user_parent_name
  on luma.document_categories (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- a parent must be the caller's own category and may not create a cycle
create or replace function luma.check_category_parent()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_cur uuid := new.parent_id;
  v_depth int := 0;
begin
  while v_cur is not null loop
    if v_cur = new.id then
      raise exception 'A category cannot be placed inside itself or its own subcategory.';
    end if;
    select parent_id into v_cur from luma.document_categories
      where id = v_cur and user_id = new.user_id;
    if not found and v_cur is not null then
      raise exception 'Invalid parent category.';
    end if;
    v_depth := v_depth + 1;
    if v_depth > 5 then raise exception 'Categories can be nested at most 5 levels deep.'; end if;
  end loop;
  if new.parent_id is not null and not exists (
    select 1 from luma.document_categories where id = new.parent_id and user_id = new.user_id
  ) then
    raise exception 'Invalid parent category.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_document_category_parent on luma.document_categories;
create trigger check_document_category_parent
  before insert or update of parent_id on luma.document_categories
  for each row execute function luma.check_category_parent();

alter table luma.document_categories enable row level security;

drop policy if exists "Users manage their own document categories" on luma.document_categories;
create policy "Users manage their own document categories"
  on luma.document_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function luma.seed_document_categories(p_user uuid)
returns void
language sql
security definer set search_path = ''
as $$
  insert into luma.document_categories (user_id, name)
  select p_user, n
  from unnest(array['Contracts','Receipts','Finance','ID','Health','Warranty','Other']) as n
  where not exists (select 1 from luma.document_categories c where c.user_id = p_user);
$$;

-- seed on signup (profiles row is created by 001's auth trigger)...
create or replace function luma.seed_categories_on_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform luma.seed_document_categories(new.id);
  return new;
end;
$$;

drop trigger if exists seed_document_categories_on_profile on luma.profiles;
create trigger seed_document_categories_on_profile
  after insert on luma.profiles
  for each row execute function luma.seed_categories_on_profile();

-- ...and backfill everyone who signed up before this migration
-- (skips users who already have any categories, so deleted defaults stay deleted)
insert into luma.document_categories (user_id, name)
select p.id, n
from luma.profiles p
cross join unnest(array['Contracts','Receipts','Finance','ID','Health','Warranty','Other']) as n
where not exists (select 1 from luma.document_categories c where c.user_id = p.id);

-- ---------- documents ----------
-- Metadata row per uploaded file; the bytes live in Storage at storage_path.
-- Deleting a category leaves its documents uncategorised (category_id null).
create table if not exists luma.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references luma.document_categories(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  mime_type text,
  size_bytes bigint not null default 0,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_created on luma.documents (user_id, created_at desc);
create index if not exists documents_category on luma.documents (category_id);

alter table luma.documents enable row level security;

drop policy if exists "Users manage their own documents" on luma.documents;
create policy "Users manage their own documents"
  on luma.documents for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- a document can only be filed under one of the caller's own categories
    and (category_id is null or exists (
      select 1 from luma.document_categories c
      where c.id = category_id and c.user_id = auth.uid()
    ))
  );

drop trigger if exists set_luma_documents_updated_at on luma.documents;
create trigger set_luma_documents_updated_at
  before update on luma.documents
  for each row execute function luma.set_updated_at();

grant all on luma.document_categories, luma.documents to anon, authenticated;
grant execute on function luma.seed_document_categories(uuid) to postgres;
revoke execute on function luma.seed_document_categories(uuid) from public, anon, authenticated;

-- ---------- Storage ----------
-- Private bucket, 25 MB per file. Objects live under "<user_id>/…" and
-- policies only let a user touch their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('luma-documents', 'luma-documents', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Users read their own document files" on storage.objects;
create policy "Users read their own document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'luma-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload to their own document folder" on storage.objects;
create policy "Users upload to their own document folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'luma-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own document files" on storage.objects;
create policy "Users delete their own document files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'luma-documents' and (storage.foldername(name))[1] = auth.uid()::text);
