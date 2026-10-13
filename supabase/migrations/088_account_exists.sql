-- Lets the login and forgot-password screens tell people when no account
-- uses the email they typed. Returns only true/false.
create or replace function public.account_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function public.account_exists(text) from public;
grant execute on function public.account_exists(text) to anon, authenticated;
