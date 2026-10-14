-- ============================================================
-- LUMA — migration 100: luma.user_devices lists the phones and computers signed in to one account (Settings → Your devices).
--   Each device registers itself on open (id kept on the device, a readable name, last seen). People only ever see their own rows.
-- Safe to re-run.
-- ============================================================
create table if not exists luma.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  label text not null default 'Unknown device',
  kind text not null default 'computer',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);
alter table luma.user_devices enable row level security;
drop policy if exists user_devices_own on luma.user_devices;
create policy user_devices_own on luma.user_devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on luma.user_devices from anon, authenticated;
grant select, insert, update, delete on luma.user_devices to authenticated;

-- registers this device, or refreshes its "last seen"
create or replace function luma.touch_device(p_device text, p_label text, p_kind text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into luma.user_devices (user_id, device_id, label, kind)
    values (auth.uid(), left(p_device, 64), left(coalesce(nullif(p_label, ''), 'Unknown device'), 80), case when p_kind in ('phone', 'tablet', 'computer') then p_kind else 'computer' end)
  on conflict (user_id, device_id) do update set last_seen = now(), label = excluded.label, kind = excluded.kind;
end;
$$;
revoke execute on function luma.touch_device(text, text, text) from public, anon;
grant execute on function luma.touch_device(text, text, text) to authenticated;
