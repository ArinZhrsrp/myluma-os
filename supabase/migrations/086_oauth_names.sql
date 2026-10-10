-- LUMA — 086: sign-up with Google or Apple fills in the person's name.
--
--   The sign-up form sends first_name / last_name in the account's metadata. Google sends given_name / family_name / full_name / name,
--   and Apple sends full_name / name (only the very first time), so a new account made with them had an empty name. luma.handle_new_user()
--   now takes the form's names first, then given_name / family_name, then splits full_name / name at the first space.
--   Country and time zone are not sent by either provider: the app fills them from the browser on the first sign-in (app/core/start.js).
--
-- Depends on 001 and 028 (the previous version of this function). Safe to re-run.

create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text := btrim(coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', ''), ''));
  v_first text; v_last text;
begin
  v_first := coalesce(nullif(btrim(v_meta ->> 'first_name'), ''), nullif(btrim(v_meta ->> 'given_name'), ''), nullif(split_part(v_full, ' ', 1), ''));
  v_last  := coalesce(nullif(btrim(v_meta ->> 'last_name'), ''), nullif(btrim(v_meta ->> 'family_name'), ''),
                      nullif(btrim(substr(v_full, length(split_part(v_full, ' ', 1)) + 1)), ''));
  insert into luma.profiles (id, first_name, last_name, email, country, timezone)
  values (new.id, v_first, v_last, new.email, nullif(v_meta ->> 'country', ''), nullif(v_meta ->> 'timezone', ''));
  return new;
end;
$$;
