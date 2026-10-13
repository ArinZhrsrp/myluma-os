-- ============================================================
-- LUMA — migration 094: changes show up in the app without a refresh.
--   Adds the person's profile (plan, deactivation), add-ons and contacts to Supabase Realtime, so the app hears about
--   a plan or add-on change, a deactivation, or a new contact request the moment it happens.
--   (Row-level security still decides who hears what: each person only gets their own rows.)
-- Safe to re-run.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_addons', 'contacts'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = t) then
      execute format('alter publication supabase_realtime add table luma.%I', t);
    end if;
  end loop;
end $$;
