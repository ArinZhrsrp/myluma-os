-- LUMA — 085: people are told when they are added to a team, and can see the teams they are in.
--
--   • luma.work_set_team now sends a notification ("X added you to the team Design") to each person who was just added
--     (not to you, and not to people who were already in the team).
--   • luma.my_work_teams also returns the teams you are a member of (so the Teams tab can list them), with 'im_in' and 'owner_name'.
--
-- Depends on 084. Safe to re-run.

create or replace function luma.work_set_team(p_id uuid, p_company uuid, p_name text, p_note text, p_color text, p_members uuid[])
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid := p_id; v_name text := btrim(coalesce(p_name, '')); v_users uuid[]; v_u uuid; v_max int; v_comp uuid; v_old uuid[] := '{}'::uuid[]; v_co text;
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
  select coalesce(array_agg(user_id), '{}'::uuid[]) into v_old from luma.work_team_members where team_id = v_id;
  delete from luma.work_team_members where team_id = v_id and not (user_id = any (v_users));
  insert into luma.work_team_members (team_id, user_id) select v_id, x from unnest(v_users) x on conflict do nothing;
  -- tell the people who were just added (not yourself, not people who were already in the team)
  select c.name into v_co from luma.work_teams t join luma.work_companies c on c.id = t.company_id where t.id = v_id;
  foreach v_u in array v_users loop
    continue when v_u = auth.uid() or v_u = any (v_old);
    perform luma.notify(v_u, 'work_team', '👥 ' || luma.person_name(auth.uid()) || ' added you to the team "' || v_name || '"', coalesce(v_co, '') || '. Open Work to see it.', 'work', v_id);
  end loop;
  return v_id;
end;
$$;
revoke execute on function luma.work_set_team(uuid, uuid, text, text, text, uuid[]) from public, anon;
grant execute on function luma.work_set_team(uuid, uuid, text, text, text, uuid[]) to authenticated;

create or replace function luma.my_work_teams()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'owner_id', t.owner_id, 'company_id', t.company_id, 'name', t.name, 'note', t.note, 'color', t.color,
    'mine', t.owner_id = auth.uid(), 'owner_name', luma.person_name(t.owner_id),
    'im_in', exists (select 1 from luma.work_team_members m where m.team_id = t.id and m.user_id = auth.uid()),
    'count', (select count(*) from luma.work_team_members m where m.team_id = t.id),
    'members', case when t.owner_id = auth.uid()
      then coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', luma.person_name(m.user_id)) order by luma.person_name(m.user_id)) from luma.work_team_members m where m.team_id = t.id), '[]'::jsonb)
      else '[]'::jsonb end
  ) order by t.name), '[]'::jsonb)
  from luma.work_teams t
  where t.owner_id = auth.uid()
     or exists (select 1 from luma.work_team_members m where m.team_id = t.id and m.user_id = auth.uid())
     or exists (select 1 from luma.work_projects p join luma.work_project_members pm on pm.project_id = p.id
                where p.owner_id = t.owner_id and pm.user_id = auth.uid() and pm.status = 'accepted');
$$;
revoke execute on function luma.my_work_teams() from public, anon;
grant execute on function luma.my_work_teams() to authenticated;
