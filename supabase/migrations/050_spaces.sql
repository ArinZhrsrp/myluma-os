-- ============================================================
-- LUMA — migration 050: what you create in Work or Study mode stays in that mode.
--   • Every item in these tables now has a "space": personal (default), work or study. The app files each new item under the mode
--     you are in, and shows only that mode's items — except in Personal mode, where Work / Study items appear only while
--     "Show Work / Study in Personal" is on (Settings → Preferences). Turn it off and they are gone from Personal again.
--   • Items you already have stay in Personal.
--   • A work / study tag is only accepted while you have that add-on; otherwise the item is kept as personal.
-- Tables: tasks, events, reminders, notes, documents, habits, goals, bills, money_entries.
-- Depends on 044. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.check_space()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.space <> 'personal' and not luma.has_addon(new.user_id, new.space) then
    new.space := 'personal';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'events', 'reminders', 'notes', 'documents', 'habits', 'goals', 'bills', 'money_entries'] loop
    execute format('alter table luma.%I add column if not exists space text not null default ''personal''', t);
    execute format('alter table luma.%I drop constraint if exists %I', t, t || '_space_check');
    execute format('alter table luma.%I add constraint %I check (space in (''personal'', ''work'', ''study''))', t, t || '_space_check');
    execute format('create index if not exists %I on luma.%I (user_id, space)', t || '_space_idx', t);
    execute format('drop trigger if exists check_space on luma.%I', t);
    execute format('create trigger check_space before insert or update of space on luma.%I for each row execute function luma.check_space()', t);
  end loop;
end $$;

