-- LUMA — 084: teams in Work (departments, squads, "Finance", "Design"…).
--
--   • A team belongs to one of YOUR companies and is a named list of people from your contacts (and you). Only you manage your teams.
--   • A task can be "for" a team (work_tasks.team_id). Picking a team in the task window ticks all its members as assignees (the app does
--     that), and you can still add or remove single people, including people who are not in the team.
--   • Someone can only be assigned if they are on the project. From a project you can add a whole team in one go (that is work_invite
--     with the team's people); people who have not accepted yet can be assigned once they do.
--   • People who work on your projects can see a team's name on a task (not its member list; that is for the owner).
--   • Limit: work_teams in plan_limits (Work 5, Work Pro 20). A team holds up to 50 people.
--
-- Depends on 071–083. Safe to re-run.

create table if not exists luma.work_teams (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references luma.work_companies (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  note       text not null default '' check (length(note) <= 140),
  color      text not null default '#fb923c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists work_teams_name_uq on luma.work_teams (owner_id, company_id, lower(btrim(name)));
create index if not exists work_teams_company_idx on luma.work_teams (company_id);

create table if not exists luma.work_team_members (
  team_id  uuid not null references luma.work_teams (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists work_team_members_user_idx on luma.work_team_members (user_id);

alter table luma.work_teams enable row level security;
alter table luma.work_team_members enable row level security;
revoke all on luma.work_teams, luma.work_team_members from anon, authenticated;
grant select on luma.work_teams, luma.work_team_members to authenticated;   -- writing goes through work_set_team / work_delete_team
drop policy if exists work_teams_owner_read on luma.work_teams;
create policy work_teams_owner_read on luma.work_teams for select to authenticated using (owner_id = auth.uid());
drop policy if exists work_team_members_owner_read on luma.work_team_members;
create policy work_team_members_owner_read on luma.work_team_members for select to authenticated
  using (exists (select 1 from luma.work_teams t where t.id = team_id and t.owner_id = auth.uid()));

alter table luma.work_tasks add column if not exists team_id uuid references luma.work_teams (id) on delete set null;
create index if not exists work_tasks_team_idx on luma.work_tasks (team_id);

-- a task can only be for a team that belongs to the project's owner (moving it to someone else's project just clears it)
create or replace function luma.work_task_team_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.team_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.team_id is not distinct from old.team_id and new.project_id = old.project_id then return new; end if;
  if exists (select 1 from luma.work_teams t join luma.work_projects p on p.id = new.project_id where t.id = new.team_id and t.owner_id = p.owner_id) then return new; end if;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then new.team_id := null; return new; end if;
  raise exception 'That team does not belong to this project''s owner';
end;
$$;
drop trigger if exists work_tasks_team_guard on luma.work_tasks;
create trigger work_tasks_team_guard before insert or update on luma.work_tasks for each row execute function luma.work_task_team_guard();

insert into luma.plan_limits (plan, key, value) values ('work', 'work_teams', 5), ('work_pro', 'work_teams', 20) on conflict (plan, key) do nothing;

-- ---------- create or change a team (and its people) in one go ----------
create or replace function luma.work_set_team(p_id uuid, p_company uuid, p_name text, p_note text, p_color text, p_members uuid[])
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid := p_id; v_name text := btrim(coalesce(p_name, '')); v_users uuid[]; v_u uuid; v_max int; v_comp uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not luma.has_my_addon('work') then raise exception 'The Work add-on is needed to manage teams'; end if;
  if length(v_name) = 0 then raise exception 'Give the team a name'; end if;
  select array_agg(distinct x) into v_users from unnest(coalesce(p_members, '{}'::uuid[])) x where x is not null;
  v_users := coalesce(v_users, '{}'::uuid[]);
  if cardinality(v_users) > 50 then raise exception 'A team can have up to 50 people'; end if;
  foreach v_u in array v_users loop
    if v_u <> auth.uid() and not luma.is_contact(auth.uid(), v_u) then raise exception 'You can only add people from your contacts'; end if;
  end loop;
  if v_id is null then
    if not exists (select 1 from luma.work_companies c where c.id = p_company and c.owner_id = auth.uid()) then raise exception 'Pick one of your companies'; end if;
    if exists (select 1 from luma.work_companies c where c.id = p_company and c.archived_at is not null) then raise exception 'This company is archived: restore it to change its teams'; end if;
    v_max := coalesce(luma.limit_of(auth.uid(), 'work_teams'), 20);
    if (select count(*) from luma.work_teams where owner_id = auth.uid()) >= v_max then raise exception 'Your plan allows up to % teams', v_max; end if;
    begin
      insert into luma.work_teams (owner_id, company_id, name, note, color) values (auth.uid(), p_company, v_name, left(coalesce(p_note, ''), 140), coalesce(nullif(p_color, ''), '#fb923c')) returning id into v_id;
    exception when unique_violation then raise exception 'You already have a team called "%" in this company', v_name; end;
  else
    select company_id into v_comp from luma.work_teams where id = v_id and owner_id = auth.uid();
    if not found then raise exception 'Only the owner can change a team'; end if;
    if exists (select 1 from luma.work_companies c where c.id = v_comp and c.archived_at is not null) then raise exception 'This company is archived: restore it to change its teams'; end if;
    begin
      update luma.work_teams set name = v_name, note = left(coalesce(p_note, ''), 140), color = coalesce(nullif(p_color, ''), color), updated_at = now() where id = v_id;
    exception when unique_violation then raise exception 'You already have a team called "%" in this company', v_name; end;
  end if;
  delete from luma.work_team_members where team_id = v_id and not (user_id = any (v_users));
  insert into luma.work_team_members (team_id, user_id) select v_id, x from unnest(v_users) x on conflict do nothing;
  return v_id;
end;
$$;
revoke execute on function luma.work_set_team(uuid, uuid, text, text, text, uuid[]) from public, anon;
grant execute on function luma.work_set_team(uuid, uuid, text, text, text, uuid[]) to authenticated;

create or replace function luma.work_delete_team(p_team uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_comp uuid;
begin
  select company_id into v_comp from luma.work_teams where id = p_team and owner_id = auth.uid();
  if not found then raise exception 'Only the owner can delete a team'; end if;
  if exists (select 1 from luma.work_companies c where c.id = v_comp and c.archived_at is not null) then raise exception 'This company is archived: restore it to change its teams'; end if;
  delete from luma.work_teams where id = p_team;   -- tasks keep their people; they just lose the team label
end;
$$;
revoke execute on function luma.work_delete_team(uuid) from public, anon;
grant execute on function luma.work_delete_team(uuid) to authenticated;

-- ---------- the teams I can see: my own (with people), and the owners' teams on projects I am on (names only) ----------
create or replace function luma.my_work_teams()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'owner_id', t.owner_id, 'company_id', t.company_id, 'name', t.name, 'note', t.note, 'color', t.color,
    'mine', t.owner_id = auth.uid(),
    'count', (select count(*) from luma.work_team_members m where m.team_id = t.id),
    'members', case when t.owner_id = auth.uid()
      then coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', luma.person_name(m.user_id)) order by luma.person_name(m.user_id)) from luma.work_team_members m where m.team_id = t.id), '[]'::jsonb)
      else '[]'::jsonb end
  ) order by t.name), '[]'::jsonb)
  from luma.work_teams t
  where t.owner_id = auth.uid()
     or exists (select 1 from luma.work_projects p join luma.work_project_members pm on pm.project_id = p.id
                where p.owner_id = t.owner_id and pm.user_id = auth.uid() and pm.status = 'accepted');
$$;
revoke execute on function luma.my_work_teams() from public, anon;
grant execute on function luma.my_work_teams() to authenticated;
