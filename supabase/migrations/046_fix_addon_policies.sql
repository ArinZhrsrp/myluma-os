-- ============================================================
-- LUMA — migration 046: fix "permission denied for function has_addon" when saving Study data.
--   The security rules on the Study tables call the add-on check as the signed-in user, but luma.has_addon(user, addon)
--   is (on purpose) not callable by users — it would let anyone look up other people's add-ons.
--   • luma.has_my_addon(addon) answers only for the caller (auth.uid()), and IS callable by signed-in users.
--   • The Study rules now use it. Use it for the Work tables' rules too.
-- Depends on 044, 045. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.has_my_addon(p_addon text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from luma.user_addons a
                 where a.user_id = auth.uid() and a.addon = p_addon and (a.expires_at is null or a.expires_at > now()));
$$;
revoke execute on function luma.has_my_addon(text) from public, anon;
grant execute on function luma.has_my_addon(text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['study_courses', 'study_classes', 'study_tasks'] loop
    execute format('drop policy if exists %I on luma.%I', t || '_insert', t);
    execute format('drop policy if exists %I on luma.%I', t || '_update', t);
    execute format('create policy %I on luma.%I for insert to authenticated with check (user_id = auth.uid() and luma.has_my_addon(''study''))', t || '_insert', t);
    execute format('create policy %I on luma.%I for update to authenticated using (user_id = auth.uid() and luma.has_my_addon(''study'')) with check (user_id = auth.uid())', t || '_update', t);
  end loop;
end $$;
