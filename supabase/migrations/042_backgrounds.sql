-- ============================================================
-- LUMA — migration 042: your own uploaded wallpaper is saved with your account.
-- The picture is stored in a private bucket (one folder per person); a new upload replaces and deletes the old one.
-- Depends on 001 (profiles.preferences / background_url). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('luma-backgrounds', 'luma-backgrounds', false, 5242880)   -- 5 MB; the app shrinks pictures to about 1920 px first
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Users read their own wallpaper" on storage.objects;
create policy "Users read their own wallpaper"
  on storage.objects for select to authenticated
  using (bucket_id = 'luma-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload their own wallpaper" on storage.objects;
create policy "Users upload their own wallpaper"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'luma-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own wallpaper" on storage.objects;
create policy "Users delete their own wallpaper"
  on storage.objects for delete to authenticated
  using (bucket_id = 'luma-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
