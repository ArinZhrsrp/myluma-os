-- ============================================================
-- LUMA — migration 074: Work companies.
--   • luma.work_companies: the companies (employers / clients' workplaces) a person works for. Several can be active at once.
--   • Every Work project belongs to one company. A project made without one goes into the owner's first active company
--     (a company called "My company" is made if there is none); projects that already exist are moved into "My company".
--   • A company has a start date (optional, chosen by you) and an end date, which is filled in with today's date when it is archived
--     (and cleared again on restore).
--   • A company can also hold your position there (job title, optional, up to 80 characters). Name, position, start date and end date can all be edited.
--   • Archiving a company puts all of its projects, tasks, folders and notes on ice: they stay readable but can't be changed,
--     until the company is restored. Only an archived company can be deleted (this deletes its projects too).
-- Depends on 071–073. Safe to re-run.
-- ============================================================

create table if not exists luma.work_companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  archived_at timestamptz,
  start_date  date,
  end_date    date,
  position    text not null default '' check (length(position) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table luma.work_companies add column if not exists start_date date;
alter table luma.work_companies add column if not exists end_date date;
alter table luma.work_companies add column if not exists position text not null default '';
alter table luma.work_companies drop constraint if exists work_companies_position_check;
alter table luma.work_companies add constraint work_companies_position_check check (length(position) <= 80);
alter table luma.work_companies drop constraint if exists work_companies_dates_check;
alter table luma.work_companies add constraint work_companies_dates_check check (start_date is null or end_date is null or start_date <= end_date);
create index if not exists work_companies_owner_idx on luma.work_companies (owner_id, created_at);

alter table luma.work_companies enable row level security;
drop policy if exists work_companies_read on luma.work_companies;
drop policy if exists work_companies_insert on luma.work_companies;
drop policy if exists work_companies_update on luma.work_companies;
drop policy if exists work_companies_delete on luma.work_companies;
create policy work_companies_read on luma.work_companies for select to authenticated using (owner_id = auth.uid());
create policy work_companies_insert on luma.work_companies for insert to authenticated with check (owner_id = auth.uid() and luma.has_my_addon('work'));
create policy work_companies_update on luma.work_companies for update to authenticated using (owner_id = auth.uid() and luma.has_my_addon('work')) with check (owner_id = auth.uid());
create policy work_companies_delete on luma.work_companies for delete to authenticated using (owner_id = auth.uid() and archived_at is not null);
revoke all on luma.work_companies from anon, authenticated;
grant select, insert, update, delete on luma.work_companies to authenticated;

create or replace function luma.work_company_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from luma.work_companies where owner_id = new.owner_id) >= 20 then raise exception 'You can have up to 20 companies'; end if;
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then raise exception 'A company can not change owner'; end if;
  new.name := btrim(new.name); new.position := btrim(new.position);
  -- archiving stamps the end date; restoring clears it
  if new.archived_at is not null and (tg_op = 'INSERT' or old.archived_at is null) and new.end_date is null then new.end_date := (new.archived_at at time zone 'Asia/Kuala_Lumpur')::date; end if;
  if new.archived_at is null and tg_op = 'UPDATE' and old.archived_at is not null then new.end_date := null; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists work_companies_guard on luma.work_companies;
create trigger work_companies_guard before insert or update on luma.work_companies for each row execute function luma.work_company_guard();

alter table luma.work_projects add column if not exists company_id uuid references luma.work_companies (id) on delete cascade;
create index if not exists work_projects_company_idx on luma.work_projects (company_id);

-- projects that already exist go into a company called "My company"
insert into luma.work_companies (owner_id, name)
select distinct p.owner_id, 'My company' from luma.work_projects p
where p.company_id is null and not exists (select 1 from luma.work_companies c where c.owner_id = p.owner_id);
update luma.work_projects p set company_id = (select c.id from luma.work_companies c where c.owner_id = p.owner_id order by c.created_at limit 1) where p.company_id is null;

create or replace function luma.work_project_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_arch timestamptz; v_owner uuid;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from luma.work_projects where owner_id = new.owner_id) >= 60 then raise exception 'You can have up to 60 projects'; end if;
    if new.company_id is null then
      select id into new.company_id from luma.work_companies where owner_id = new.owner_id and archived_at is null order by created_at limit 1;
      if new.company_id is null then insert into luma.work_companies (owner_id, name) values (new.owner_id, 'My company') returning id into new.company_id; end if;
    end if;
  elsif new.company_id is distinct from old.company_id then raise exception 'A project can not move to another company';
  end if;
  select archived_at, owner_id into v_arch, v_owner from luma.work_companies where id = new.company_id;
  if v_owner is distinct from new.owner_id then raise exception 'That is not your company'; end if;
  if v_arch is not null then raise exception 'This company is archived: restore it to change its projects'; end if;
  new.updated_at := now();
  return new;
end;
$$;

-- nothing in an archived company can be changed (members included)
create or replace function luma.work_can_edit(p_project uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(luma.work_role(p_project, auth.uid()) in ('owner', 'member'), false) and luma.has_my_addon('work')
     and not exists (select 1 from luma.work_projects p join luma.work_companies c on c.id = p.company_id where p.id = p_project and c.archived_at is not null);
$$;
revoke execute on function luma.work_can_edit(uuid) from public, anon;
grant execute on function luma.work_can_edit(uuid) to authenticated;

-- shared projects say whether their company is archived
create or replace function luma.my_work_shared()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'client', p.client, 'color', p.color, 'status', p.status, 'deadline', p.deadline, 'kind', p.kind,
    'owner_id', p.owner_id, 'owner_name', luma.person_name(p.owner_id), 'my_role', m.role, 'my_status', m.status,
    'archived', exists (select 1 from luma.work_companies c where c.id = p.company_id and c.archived_at is not null),
    'tasks', (select count(*) from luma.work_tasks t where t.project_id = p.id and m.status = 'accepted'),
    'done', (select count(*) from luma.work_tasks t where t.project_id = p.id and t.status = 'done' and m.status = 'accepted')) order by p.updated_at desc), '[]'::jsonb)
  from luma.work_project_members m join luma.work_projects p on p.id = m.project_id
  where m.user_id = auth.uid() and m.status in ('pending', 'accepted');
$$;
revoke execute on function luma.my_work_shared() from public, anon;
grant execute on function luma.my_work_shared() to authenticated;
