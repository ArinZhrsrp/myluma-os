# Test cases — Work mode

Covers SRS-work.md (FR-WRK … FR-WNT). Order: WRK, WCO, WTM, WTE, WCM, WGV, WLM, WNT. LUMA 0.26.4, migrations 071–085.

Test users used below: **Aina** (owner, Work add-on), **Bala** (member, Work add-on), **Chen** (viewer, Work add-on), **Dewi** (guest: no add-on, added to Aina's project), **Eli** (outsider, no add-on, not on the project). Aina, Bala, Chen and Dewi are contacts of each other. Size "Work" unless the case says Work Pro.

Automation key: `pg_*_test` = database rules run on a local PostgreSQL (PGlite) with all migrations (`docs/test-automation/sql`). `v49_test` = Work UI in jsdom; it **prints observations and has no pass / fail assertions**, so a human must read its output. `lumi_tools_test` does **not** call any Work tool. "Device only" = needs a real phone, second device, file picker or print dialog.

#### TC-WRK-001 — Tabs for a person with the add-on
- **Requirement:** FR-WRK-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** None
- **Steps:**
  1. Open the menu and switch to Work mode.
  2. Look at the tabs under the Work title.
- **Expected result:** Tabs Overview, Projects, Tasks, Teams, Time are shown; the page opens on Overview.
- **Automation:** `v49_test` prints the tab list (observation) · otherwise manual.

#### TC-WRK-002 — Tabs for a guest
- **Requirement:** FR-WRK-001, FR-WRK-002
- **Type / Priority:** Security · P1
- **Preconditions:** Signed in as Dewi (no add-on) who accepted Aina's project.
- **Test data:** None
- **Steps:**
  1. Open Work (mode switch is not locked).
  2. Look at the tabs and at the menu.
- **Expected result:** Only Projects and Tasks tabs; the menu shows only the Work item (plus Settings, Support, Feedback, Notifications); no Company page.
- **Automation:** `v49_test` prints guest menu (observation) · otherwise manual.

#### TC-WRK-003 — Work mode menu
- **Requirement:** FR-WRK-002
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** None
- **Steps:**
  1. Switch to Work mode.
  2. Read the menu items.
- **Expected result:** Menu shows Work, Company, Calendar, Reminders, Documents, Contacts, Lumi, plus Settings, Support, Feedback, Notifications; Personal-only items (Money, Habits…) are hidden.
- **Automation:** Manual

#### TC-WRK-004 — Slow request gives up after 20 seconds
- **Requirement:** FR-WRK-003, NFR-WRK-001
- **Type / Priority:** Negative · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Browser dev tools: throttle the 'work_projects' request to never answer.
- **Steps:**
  1. Open Work.
  2. Wait 20 seconds.
- **Expected result:** Page shows "Could not load", the text "Timed out while loading projects. Check your connection and try again." and a Try again button; pressing it reloads.
- **Automation:** Manual

#### TC-WRK-005 — Overview tiles and lists
- **Requirement:** FR-WRK-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** 2 active projects; 5 open tasks: one overdue, one due today, one due in 7 days, one due in 8 days, one without date; 1 Done task.
- **Steps:**
  1. Open Overview.
- **Expected result:** Tiles: Active projects 2, Open tasks 5, Due this week 2 (today and +7 days; the +8 one is excluded), Overdue 1. "Due soon" lists dated open tasks nearest first; "Assigned to me" lists only tasks Aina is on; progress shows done/total.
- **Automation:** `v49_test` prints overview text (observation) · otherwise manual.

#### TC-WRK-006 — Overview empty state
- **Requirement:** FR-WRK-004, FR-WRK-006
- **Type / Priority:** Usability · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** No projects.
- **Steps:**
  1. Open Overview.
- **Expected result:** "Start your first project" with a New project chip; pressing it opens the New project window.
- **Automation:** Manual

#### TC-WRK-007 — Only the company in view is shown
- **Requirement:** FR-WRK-005
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Companies Acme (project Site) and Beta (project Logo); also Bala's project "Shared" with Aina as member.
- **Steps:**
  1. In Work → Projects note the list.
  2. Open Company page, press Switch to this on Beta, go back to Work → Projects.
  3. Reload the browser.
- **Expected result:** With Acme in view: Site + Shared. After switching: Logo + Shared. After reload Beta is still in view (remembered in the browser).
- **Automation:** `v49_test` switches company (observation) · otherwise manual.

#### TC-WRK-008 — Empty-state texts
- **Requirement:** FR-WRK-006
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** No projects.
- **Steps:**
  1. Open Projects, Tasks tab; then create a project with no tasks and open the Board and List.
  2. Sign in as Dewi with nothing shared and open Work.
- **Expected result:** Texts: "No projects yet"; "No tasks yet" / "Create a project first…"; "Nothing here" in empty columns; "No tasks match." in the empty list; Dewi sees "Nothing has been shared with you yet."
- **Automation:** Manual

#### TC-WRK-009 — Work layout at 320 px
- **Requirement:** FR-WRK-007, NFR-WRK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Has projects with tasks in every column.
- **Test data:** Browser width 320 px (phone).
- **Steps:**
  1. Open Overview, Projects, Tasks (Board) and Time.
  2. Open the New task window.
  3. Try to scroll the page sideways.
- **Expected result:** No horizontal page scroll; board is one column; tabs fit (icons hidden ≤400 px); the New button does not overflow; the task window fits the screen.
- **Automation:** Device only (real phone) for 320/360/390; `v49_test` does not check layout.

#### TC-WRK-010 — Work layout at 360 px
- **Requirement:** FR-WRK-007, NFR-WRK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Has projects with tasks in every column.
- **Test data:** Browser width 360 px (phone).
- **Steps:**
  1. Open Overview, Projects, Tasks (Board) and Time.
  2. Open the New task window.
  3. Try to scroll the page sideways.
- **Expected result:** Same as 320: one column board, tabs fit, no sideways scroll.
- **Automation:** Device only (real phone) for 320/360/390; `v49_test` does not check layout.

#### TC-WRK-011 — Work layout at 390 px
- **Requirement:** FR-WRK-007, NFR-WRK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Has projects with tasks in every column.
- **Test data:** Browser width 390 px (phone).
- **Steps:**
  1. Open Overview, Projects, Tasks (Board) and Time.
  2. Open the New task window.
  3. Try to scroll the page sideways.
- **Expected result:** Same: one column board, tab names visible, no sideways scroll.
- **Automation:** Device only (real phone) for 320/360/390; `v49_test` does not check layout.

#### TC-WRK-012 — Work layout at 1180 px
- **Requirement:** FR-WRK-007, NFR-WRK-002
- **Type / Priority:** Responsive · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Has projects with tasks in every column.
- **Test data:** Browser width 1180 px (laptop).
- **Steps:**
  1. Open Overview, Projects, Tasks (Board) and Time.
  2. Open the New task window.
  3. Try to scroll the page sideways.
- **Expected result:** Board is four columns (≥1100 px); tiles are in one row; no sideways scroll.
- **Automation:** Manual

#### TC-WRK-013 — Board becomes two columns at 1000 px
- **Requirement:** FR-WRK-007
- **Type / Priority:** Responsive · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Browser width 1000 px.
- **Steps:**
  1. Open Tasks → Board.
- **Expected result:** Two columns of cards per row.
- **Automation:** Manual

#### TC-WRK-014 — Create a project (project kind)
- **Requirement:** FR-WRK-008, FR-WRK-009
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Name "Website redesign", client "Acme Sdn Bhd", deadline in 30 days, colour orange.
- **Steps:**
  1. Work → Projects → New project.
  2. Enter the data, keep kind Project.
  3. Press Save project.
- **Expected result:** Toast "Project created"; the card shows "6 phases", client and deadline; Phases view lists Planning, Requirement study, Design, Development, Testing, Deployment.
- **Automation:** `pg_work_test` (create), `pg_phase_test` (six phases in order) · UI manual.

#### TC-WRK-015 — Create a general project and its folders
- **Requirement:** FR-WRK-009, FR-WRK-017
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Name "Memo approvals"; folder "Policies".
- **Steps:**
  1. New project, choose General, save.
  2. Open it (Open tasks) → Phases view.
  3. Press New folder, type Policies, Save.
- **Expected result:** No phases; "No folders yet" first; then folder Policies appears; card says "General".
- **Automation:** `pg_phase_test` (general has no phases, folders add / rename / delete) · UI manual.

#### TC-WRK-016 — Project kind cannot change after creation
- **Requirement:** FR-WRK-009
- **Type / Priority:** Negative · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** An existing project.
- **Steps:**
  1. Press the pencil of the project.
  2. Try to tap the other kind chip.
- **Expected result:** Kind chips are locked; note says "(can not be changed later)".
- **Automation:** Manual

#### TC-WRK-017 — Project name is required
- **Requirement:** FR-WRK-008
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Empty name.
- **Steps:**
  1. New project, leave name empty, Save project.
- **Expected result:** Error "Give the project a name."; nothing is saved.
- **Automation:** `v49_test` does not cover · manual.

#### TC-WRK-018 — Project field lengths
- **Requirement:** FR-WRK-008
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Name of 80 characters; client 80; description 2000.
- **Steps:**
  1. Type 80 / 80 / 2000 characters; try to type one more in each.
  2. Save.
- **Expected result:** Boxes stop at 80 / 80 / 2000; the project saves; the database refuses 81 (check constraint).
- **Automation:** Manual (database check constraint, not in a suite).

#### TC-WRK-019 — Project without add-on
- **Requirement:** FR-WRK-008, FR-WRK-014
- **Type / Priority:** Security · P1
- **Preconditions:** Dewi (guest) signed in.
- **Test data:** None
- **Steps:**
  1. Open Work → Projects; look for New project.
  2. Try inserting a project through the API as Dewi (Test tool).
- **Expected result:** No New project button for Dewi; API insert is refused by row-level security.
- **Automation:** `pg_work_test` ('without the Work add-on nobody can create a project').

#### TC-WRK-020 — Add-on popup from New project
- **Requirement:** FR-WRK-008
- **Type / Priority:** Functional · P3
- **Preconditions:** Person whose add-on ended but who is still on the Work page (page not reloaded).
- **Test data:** None
- **Steps:**
  1. Press New project.
- **Expected result:** The Work add-on popup opens.
- **Automation:** Manual

#### TC-WRK-021 — Edit project and status effects
- **Requirement:** FR-WRK-010, FR-WRK-012
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Project "Site" with deadline and open tasks.
- **Steps:**
  1. Edit project, set status On hold, Save.
  2. Check Overview tile, Calendar, Gantt, Timeline and the calendar file.
- **Expected result:** Active projects tile drops by one; the deadline no longer shows on Calendar, Gantt flag, Timeline milestone or in the .ics; tasks remain editable.
- **Automation:** Manual

#### TC-WRK-022 — Delete a project
- **Requirement:** FR-WRK-010
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Project with tasks, a comment, an attached file, a member Bala.
- **Steps:**
  1. Edit project → Delete.
  2. Confirm.
- **Expected result:** Confirmation text shown; project, tasks, folders, comments, links and Bala's membership disappear; the attached document is un-shared; toast "Project deleted".
- **Automation:** `pg_wfiles_test` (deleting project un-shares), `pg_work_test` (cascade on owner delete) · UI manual.

#### TC-WRK-023 — Only the owner can delete a project
- **Requirement:** FR-WRK-010, FR-WLM-003
- **Type / Priority:** Security · P1
- **Preconditions:** Bala is a member with add-on.
- **Test data:** None
- **Steps:**
  1. As Bala, look for a delete option; then call delete on the project through the API.
- **Expected result:** No delete control in Bala's UI; API delete changes nothing.
- **Automation:** `pg_work_test` ('only the owner can delete the project').

#### TC-WRK-024 — Project cards for own and shared projects
- **Requirement:** FR-WRK-011
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Own project with 2 people and 3 of 5 tasks done; a project by Bala where Aina is viewer.
- **Steps:**
  1. Open Projects.
- **Expected result:** Own card: progress 60 %, "3 of 5 done", people icon "2". Under "Shared with me": Bala's card with "by Bala · view only".
- **Automation:** `v49_test` prints cards incl. 'view only' (observation) · manual.

#### TC-WRK-025 — Project in an archived company cannot be created or changed
- **Requirement:** FR-WRK-013
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Company Acme archived (see WCO).
- **Test data:** None
- **Steps:**
  1. Try to create a project via API in Acme; try to rename an existing one.
- **Expected result:** Both refused with "This company is archived: restore it to change its projects"; the pencil button is not shown in the UI.
- **Automation:** `pg_company_test` (no new project; project edit refused 'archived').

#### TC-WRK-026 — Phases view content
- **Requirement:** FR-WRK-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Project (six phases): two tasks in Design (one Done), one task in no phase.
- **Steps:**
  1. Open the project (Open tasks) — Phases view.
- **Expected result:** Design shows "1/2", its tasks and Add task; "Not in a phase" card lists the third task; Notes button on each phase.
- **Automation:** `v49_test` prints phase names (observation) · manual.

#### TC-WRK-027 — Phase names are fixed, notes can be written
- **Requirement:** FR-WRK-016
- **Type / Priority:** Data · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Phase Design.
- **Steps:**
  1. Open Design → notes window.
  2. Check the name box; type notes of 8000 characters; Save.
  3. Via API try to rename, delete and insert an extra phase.
- **Expected result:** Name box disabled, no Delete button; notes save; API: rename keeps name, delete and insert refused.
- **Automation:** `pg_phase_test` (extra folders refused, phases cannot be deleted, name kept, notes writable).

#### TC-WRK-028 — Folder rules: name, limit 40, delete keeps tasks
- **Requirement:** FR-WRK-017
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** General project with 40 folders (create through API) and one task in folder 40.
- **Steps:**
  1. Try to add folder 41.
  2. Delete folder 40 from its window and confirm.
  3. Press Save with empty name in a new folder window.
- **Expected result:** 41st refused: "A project can have up to 40 folders"; deleting keeps the task (now "Not in a folder"); empty name: "Give the folder a name."
- **Automation:** `pg_phase_test` covers add / rename / delete only; the 40 limit is manual.

#### TC-WRK-029 — Phase / folder window is read-only for a viewer
- **Requirement:** FR-WRK-018, FR-WLM-004
- **Type / Priority:** Security · P1
- **Preconditions:** Chen is a viewer.
- **Test data:** None
- **Steps:**
  1. As Chen open a phase's Notes.
- **Expected result:** Name and notes disabled; Save and Delete hidden; note says read-only.
- **Automation:** `pg_phase_test` (viewer cannot write notes, member can, viewer can read; outsider sees nothing).

#### TC-WRK-030 — A task cannot use another project's phase
- **Requirement:** FR-WRK-019
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Two projects.
- **Test data:** Phase id of project 1.
- **Steps:**
  1. Via API insert a task in project 2 with folder_id of project 1.
- **Expected result:** Refused: "That phase or folder is not in this project".
- **Automation:** `pg_phase_test`.

#### TC-WRK-031 — Create a task with all fields
- **Requirement:** FR-WRK-020
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Project with phases; Bala on it.
- **Test data:** Title "Draft quotation", priority High, phase Planning, start today, end +5, budget 4, assignee Bala, description "v1", checklist 2 steps.
- **Steps:**
  1. Tasks → New task, fill the data.
  2. Save task.
- **Expected result:** Task appears on the board in To do with a flag, "2 steps" 0/2, budget 0m / 4h, avatar B, due range; Bala gets a notification.
- **Automation:** `pg_work_test` (task, assignee, notification) · UI manual.

#### TC-WRK-032 — Task title required and lengths
- **Requirement:** FR-WRK-020
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Title 140 characters; description 4000.
- **Steps:**
  1. Save with empty title.
  2. Type 141 characters in title.
- **Expected result:** Empty: "Give the task a name."; box stops at 140; 4000 accepted.
- **Automation:** Manual

#### TC-WRK-033 — Start date after end date
- **Requirement:** FR-WRK-021
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Start +9, end +5.
- **Steps:**
  1. Fill dates and Save.
- **Expected result:** Error "The start date can not be after the end date."; same rule in the database.
- **Automation:** `pg_work_test` ('start date cannot be after the end date').

#### TC-WRK-034 — completed_at follows Done
- **Requirement:** FR-WRK-022
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** A To do task.
- **Steps:**
  1. Move it to Done; then back to Doing.
- **Expected result:** completed_at is set when Done and cleared again.
- **Automation:** `pg_work_test` (stamped on done) · clearing manual.

#### TC-WRK-035 — Assignees: only people on the project, max 10
- **Requirement:** FR-WRK-023
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view. Project with 11 accepted people.
- **Test data:** Select 11 people one by one.
- **Steps:**
  1. In the task window tap people to tick them; tap the 11th.
  2. Via API try to assign Eli (outsider).
- **Expected result:** The 11th tick is ignored (10 stay); the list shows only project people; API: "That person is not on this project"; database check allows ≤10.
- **Automation:** `pg_work_test` (assigning non-members refused) · the 10 limit manual.

#### TC-WRK-036 — Checklist limits
- **Requirement:** FR-WRK-024
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** 30 steps; a 31st; a step of 121 characters.
- **Steps:**
  1. Add 30 steps; add the 31st; type 121 characters in one step; add an empty step; Save.
- **Expected result:** 31st: "A checklist can have up to 30 steps."; step boxes stop at 120; empty step dropped; card shows done/total.
- **Automation:** Manual

#### TC-WRK-037 — Read-only task window
- **Requirement:** FR-WRK-025
- **Type / Priority:** Security · P1
- **Preconditions:** Chen (viewer) and Dewi (guest).
- **Test data:** None
- **Steps:**
  1. Open a task as Chen; open it as Dewi.
- **Expected result:** Fields disabled, no Save/Delete, note "You were added to this project as a viewer." for Chen and "Changing tasks needs the Work add-on." for Dewi.
- **Automation:** `v49_test` prints guest extras (observation); `pg_work_test` (viewer and guest cannot change).

#### TC-WRK-038 — Delete a task and Undo
- **Requirement:** FR-WRK-026
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Task created by Bala; Aina is owner.
- **Steps:**
  1. As Bala delete his task, confirm; press Undo in the toast.
  2. As Aina delete a task Bala created.
- **Expected result:** Both deletions are allowed (creator / owner); Undo re-creates the task with its title, dates, assignees, checklist (not budget, team, links, comments, files — see Findings). Bala cannot delete Aina's task.
- **Automation:** `pg_work_test` (member cannot delete others' tasks: guest case) · manual.

#### TC-WRK-039 — New task without an editable project
- **Requirement:** FR-WRK-027
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Aina has no project.
- **Steps:**
  1. Press New task.
- **Expected result:** Alert "Create a project first: tasks live inside a project."
- **Automation:** Manual

#### TC-WRK-040 — Due labels
- **Requirement:** FR-WRK-028
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Tasks due yesterday, today, tomorrow, +10 and a Done one due yesterday.
- **Steps:**
  1. Open the Board.
- **Expected result:** "Overdue · date" red; "Today" and "Tomorrow" amber; plain date for +10; Done task shows no Overdue.
- **Automation:** Manual

#### TC-WRK-041 — Board move buttons
- **Requirement:** FR-WRK-029
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Task in To do.
- **Steps:**
  1. Press ▶ twice, ◀ once.
- **Expected result:** Task goes To do → Doing → Review → Doing; ◀ disabled in To do and ▶ in Done.
- **Automation:** `v49_test` ('moved forward', observation).

#### TC-WRK-042 — Board move fails and reverts
- **Requirement:** FR-WRK-029
- **Type / Priority:** Negative · P2
- **Preconditions:** As Bala after his add-on ended (page not reloaded).
- **Test data:** None
- **Steps:**
  1. Press ▶ on a card.
- **Expected result:** Card jumps back; alert "Could not move the task: …".
- **Automation:** `pg_work_test` (expired member is read-only) · UI manual.

#### TC-WRK-043 — List order and filters
- **Requirement:** FR-WRK-030, FR-WRK-031
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Mixed tasks incl. Done, no date, 2 projects, one team.
- **Steps:**
  1. Switch to List; pick a project; toggle Assigned to me; pick a team.
- **Expected result:** Open tasks first by date, undated last, Done at the end; each filter narrows the list; Phases button appears only with one project selected (with All projects it falls back to Board).
- **Automation:** Manual

#### TC-WRK-044 — Move a task to another project
- **Requirement:** FR-WRK-032, FR-WRK-033
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Task T in project A (company Acme) with 1 comment, 1 file, 60 min logged, assignees Bala (on A and B) and Dewi (only on A), a link and a phase; project B in company Beta.
- **Steps:**
  1. Edit T, choose project B in the Project list.
  2. Confirm "Move this task?".
- **Expected result:** Toast "Task moved"; T is in B; comment, file, time follow (time now under Beta); Dewi removed, Bala stays; phase empty; link gone; file now shared with B's people only.
- **Automation:** `pg_move_test` (assignees, comments, files, time, sharing), `pg_extras_test` (links dropped).

#### TC-WRK-045 — Move refused: viewer, archived, full
- **Requirement:** FR-WRK-033
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Target projects: one where Aina is viewer; one in an archived company; one with 600 tasks (Work).
- **Steps:**
  1. Try to move a task into each (UI list only offers editable ones; use API for the rest).
- **Expected result:** Refused with "You can only move a task between projects you can change" / "That project is full (up to 600 tasks on its owner's plan)".
- **Automation:** `pg_move_test` (viewer, archived company) · full target manual.

#### TC-WRK-046 — Search in Work mode
- **Requirement:** FR-WRK-034
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Task "Quotation" in company Beta (not in view); phase note "wireframes".
- **Steps:**
  1. Type "quot" in search; open the task result.
  2. Search "wireframes"; open the phase result.
- **Expected result:** Results labelled Work task / Phase; opening the task switches to Beta, opens Tasks (list) and the task window; the phase result opens the phase window. In Personal mode no Work results.
- **Automation:** Manual

#### TC-WRK-047 — Project list is locked when a task cannot be moved
- **Requirement:** FR-WRK-035
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Only one editable project; Chen's read-only task.
- **Steps:**
  1. Open a task of the only project; open a task as Chen.
- **Expected result:** Project select is disabled in both cases; with projects in two companies, names show " · Company".
- **Automation:** `v49_test` prints select options (observation).

#### TC-WRK-048 — Text is escaped
- **Requirement:** NFR-WRK-003, FR-WRK-020
- **Type / Priority:** Security · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company "Acme" exists and is in view.
- **Test data:** Task title `<img src=x onerror=alert(1)>`.
- **Steps:**
  1. Save the task; look at Board, List, Gantt, search.
- **Expected result:** Title shown as text everywhere; no alert.
- **Automation:** Manual

---

## WCO — Companies

#### TC-WCO-001 — First-run company set-up
- **Requirement:** FR-WCO-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). Aina has no company.
- **Test data:** Company name "Acme Sdn Bhd".
- **Steps:**
  1. Open Work.
  2. Check the page, the New button and the company pill.
  3. Type the name and press Continue.
- **Expected result:** Before: "What is your company called?" with name box, Continue; New button and pill hidden. After: toast "Company added", pill shows Acme, Overview opens.
- **Automation:** `v49_test` ('first run', observation) · manual.

#### TC-WCO-002 — First-run: empty name and Enter key
- **Requirement:** FR-WCO-001
- **Type / Priority:** Negative · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). No company.
- **Test data:** Empty box.
- **Steps:**
  1. Press Continue with nothing typed.
  2. Type a name and press Enter.
- **Expected result:** "Type the company name first."; Enter saves like Continue.
- **Automation:** Manual

#### TC-WCO-003 — First-run name length
- **Requirement:** FR-WCO-001, FR-WCO-005
- **Type / Priority:** Boundary · P3
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). No company.
- **Test data:** 80 and then 81 characters.
- **Steps:**
  1. Type 81 characters.
- **Expected result:** The box stops at 80 characters.
- **Automation:** Manual

#### TC-WCO-004 — All companies archived
- **Requirement:** FR-WCO-002
- **Type / Priority:** Usability · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). Only company is archived.
- **Test data:** None
- **Steps:**
  1. Open Work.
- **Expected result:** "No active company" with Open Company page chip; New button hidden.
- **Automation:** Manual

#### TC-WCO-005 — Company pill
- **Requirement:** FR-WCO-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Company in view "Acme".
- **Steps:**
  1. Look under the Work title; press the pill.
- **Expected result:** Pill "Acme ›"; opens the Company page. A guest sees no pill.
- **Automation:** `v49_test` ('company pill') · manual.

#### TC-WCO-006 — Company page content
- **Requirement:** FR-WCO-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Acme (2 projects, 3 open tasks, position "PM", start 1 Jan 2024), Beta archived.
- **Steps:**
  1. Open Company in the menu.
- **Expected result:** Subtitle "1 active · 1 archived · 2 of 5 used"; Acme card with counts, dates "1 Jan 2024 → now", position, "In view"; Beta under Archived with Restore and delete buttons.
- **Automation:** `v49_test` prints company page (observation).

#### TC-WCO-007 — Add a company with all fields
- **Requirement:** FR-WCO-005, FR-WCO-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Name "  Beta Studio ", position "Project manager", start 2024-03-01, end blank.
- **Steps:**
  1. Company → New company; fill; Save.
- **Expected result:** Company saved with trimmed name and position; toast "Company added".
- **Automation:** `pg_company_test` (adds company, trims position) · UI manual.

#### TC-WCO-008 — Company dates order
- **Requirement:** FR-WCO-005
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Start 2026-05-01, end 2026-01-01.
- **Steps:**
  1. Fill and Save.
- **Expected result:** "The start date can not be after the end date." (app and database).
- **Automation:** `pg_company_test` (start after end refused).

#### TC-WCO-009 — Company name required and position length
- **Requirement:** FR-WCO-005
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Empty name; position 80 and 81 characters.
- **Steps:**
  1. Save empty name.
  2. Type 81 characters in position.
- **Expected result:** "Give the company a name."; position box stops at 80; database refuses 81.
- **Automation:** `pg_company_test` (position cap 80).

#### TC-WCO-010 — Edit and rename an archived company
- **Requirement:** FR-WCO-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Archived company.
- **Steps:**
  1. Press Edit on it; change position; Save.
- **Expected result:** Saved (edit on archived companies is allowed; the add-on is required).
- **Automation:** `pg_company_test` (rename keeps projects; position, end date by hand).

#### TC-WCO-011 — Switch company
- **Requirement:** FR-WCO-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Acme (project Site), Beta (project Logo).
- **Steps:**
  1. On Company press Switch to this on Beta.
- **Expected result:** Work opens with Beta in view; Logo shown, Site not; archived company opens Projects tab.
- **Automation:** `v49_test` (archived view, observation) · manual.

#### TC-WCO-012 — Companies are private
- **Requirement:** FR-WCO-007, FR-WCO-014
- **Type / Priority:** Security · P1
- **Preconditions:** Aina's project shared with Bala.
- **Test data:** None
- **Steps:**
  1. As Bala open Company and query work_companies through the API.
- **Expected result:** Bala sees none of Aina's companies.
- **Automation:** `pg_company_test` ('other people do not see your companies').

#### TC-WCO-013 — A company cannot change owner
- **Requirement:** FR-WCO-007
- **Type / Priority:** Security · P3
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** None
- **Steps:**
  1. Update owner_id of a company through the API.
- **Expected result:** Refused "A company can not change owner" (or by row-level security).
- **Automation:** Manual

#### TC-WCO-014 — Archive a company
- **Requirement:** FR-WCO-008
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Acme in view, Beta active; Acme has start date 2024-03-01 and no end date.
- **Steps:**
  1. Company → Archive on Acme; confirm.
- **Expected result:** Confirmation text as in the SRS; Acme archived with end date = today; start date unchanged; view moves to Beta; toast "Company archived".
- **Automation:** `pg_company_test` (stamps end date).

#### TC-WCO-015 — Archive keeps an end date set by hand
- **Requirement:** FR-WCO-008
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Company with end date 2025-12-31.
- **Steps:**
  1. Archive it.
- **Expected result:** End date stays 31 Dec 2025.
- **Automation:** `pg_company_test`.

#### TC-WCO-016 — Archived company is frozen
- **Requirement:** FR-WCO-009
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). Acme archived with project Site, task Draft, folder notes, a member Bala.
- **Test data:** None
- **Steps:**
  1. Open Acme (View) and try: New task, edit Draft, edit project, add comment, log time, create team.
  2. Look at the banner.
- **Expected result:** Everything readable; all changes refused; banner "Acme is archived …" with Company button; New button hidden; no pencil on cards.
- **Automation:** `pg_company_test` (tasks cannot be changed or added, project edit refused), `pg_time_test` (no time), `pg_team_test` (teams frozen) · banner manual.

#### TC-WCO-017 — Member cannot change tasks in an archived company
- **Requirement:** FR-WCO-009, FR-WCO-010
- **Type / Priority:** Security · P1
- **Preconditions:** Bala is a member with add-on; Aina archived Acme.
- **Test data:** None
- **Steps:**
  1. As Bala open the project and try to change a task and add a comment.
- **Expected result:** Bala can read; changes refused; the shared card is marked archived.
- **Automation:** `pg_company_test` ('a member cannot change them', 'shared projects say they are archived').

#### TC-WCO-018 — Other companies carry on while one is archived
- **Requirement:** FR-WCO-008, FR-WCO-009
- **Type / Priority:** Integration · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Acme archived, Beta active.
- **Steps:**
  1. Edit a task in a Beta project.
- **Expected result:** Works normally.
- **Automation:** `pg_company_test` ('the other company carries on').

#### TC-WCO-019 — Restore a company
- **Requirement:** FR-WCO-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Archived company.
- **Steps:**
  1. Press Restore.
- **Expected result:** Toast "Company restored"; end date cleared; tasks editable again.
- **Automation:** `pg_company_test` (restoring clears end date, brings everything back).

#### TC-WCO-020 — Delete only archived companies
- **Requirement:** FR-WCO-012
- **Type / Priority:** Security · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Active company and archived company.
- **Steps:**
  1. Check that the active one has no delete button; try deleting it via the API.
  2. Delete the archived one; confirm.
- **Expected result:** Active: not deleted. Archived: confirmation mentions N projects; company and its projects, tasks, notes disappear.
- **Automation:** `pg_company_test` (active cannot be deleted; archived deleted with projects).

#### TC-WCO-021 — Deleting a company also deletes its time entries
- **Requirement:** FR-WCO-012
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size).
- **Test data:** Archived company with 90 min of general time and project time.
- **Steps:**
  1. Delete the company; open Time.
- **Expected result:** Those time entries are gone (database cascade) although the confirmation does not mention time.
- **Automation:** Manual (see Findings).

#### TC-WCO-022 — Company limit: Work (5) boundary
- **Requirement:** FR-WCO-013, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). 4 companies (1 archived).
- **Test data:** Add the 5th and 6th.
- **Steps:**
  1. Add the 5th company.
  2. Add a 6th.
- **Expected result:** 5th saved ("5 of 5 used"); 6th refused: "Your Work add-on allows up to 5 companies in total (active and archived both count)" + "Delete an archived one, or upgrade in Settings → your plan." and the "Work Pro allows 20" note.
- **Automation:** `pg_wreminder_test` ('the 6th company is refused').

#### TC-WCO-023 — Company limit: Work Pro (20) boundary
- **Requirement:** FR-WCO-013, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina has Work Pro; 20 companies.
- **Test data:** 21st company.
- **Steps:**
  1. Add the 21st.
- **Expected result:** Refused with "up to 20 companies"; no "Work Pro allows" hint.
- **Automation:** `pg_company_test` ('21st company refused'), `pg_wreminder_test` (Pro lifts limit).

#### TC-WCO-024 — Archived companies count toward the limit
- **Requirement:** FR-WCO-013
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). 5 companies, all archived.
- **Test data:** Add one more.
- **Steps:**
  1. Try New company.
- **Expected result:** Refused; deleting one archived company makes room.
- **Automation:** `pg_company_test` (21st refused; archived count).

#### TC-WCO-025 — Projects belong to one company
- **Requirement:** FR-WCO-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). Companies Acme and Beta.
- **Test data:** Project "Logo".
- **Steps:**
  1. New project: look for the Company select; choose Beta; Save.
  2. Create a project via API without company.
- **Expected result:** Select shown (two active companies), default is the one in view; project lands in Beta. API project without company goes to the first active company.
- **Automation:** `pg_company_test` (two companies; no company given → first active) · UI manual.

#### TC-WCO-026 — My company is created automatically
- **Requirement:** FR-WCO-015, FR-WCO-019
- **Type / Priority:** Data · P3
- **Preconditions:** Aina has the add-on and no company.
- **Test data:** None
- **Steps:**
  1. Create a project through Lumi or the API without company.
- **Expected result:** A company "My company" is created and used.
- **Automation:** Manual

#### TC-WCO-027 — Move a project to another company
- **Requirement:** FR-WCO-016, FR-WTM-022
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). Project Site in Acme with tasks and Aina's 2 h of time; company Beta active.
- **Test data:** None
- **Steps:**
  1. Edit project, change Company to Beta; Save; confirm "Move to Beta?".
- **Expected result:** Toast "Project moved"; tasks, notes and Aina's time are under Beta; Bala's own time entries keep no company.
- **Automation:** `pg_move_test` (owner moves project; time follows).

#### TC-WCO-028 — Move project: refusals
- **Requirement:** FR-WCO-016, FR-WCO-017
- **Type / Priority:** Security · P1
- **Preconditions:** Bala member; Beta archived.
- **Test data:** None
- **Steps:**
  1. As Bala call move; as Aina move into archived Beta; update company_id directly.
- **Expected result:** All refused: "Only the project owner can move it", "That company is archived: restore it first", "Use Move to put a project in another company".
- **Automation:** `pg_move_test`, `pg_company_test` (project cannot move company directly).

#### TC-WCO-029 — Changing a company without the add-on
- **Requirement:** FR-WCO-018
- **Type / Priority:** Security · P2
- **Preconditions:** Aina's add-on ended (page not reloaded).
- **Test data:** None
- **Steps:**
  1. Edit a company name and Save.
- **Expected result:** "The Work add-on is needed to change companies."
- **Automation:** `pg_company_test` ('without Work nobody can' add) · message manual.

#### TC-WCO-030 — Guest has no Company page
- **Requirement:** FR-WCO-018
- **Type / Priority:** Security · P2
- **Preconditions:** Dewi guest.
- **Test data:** None
- **Steps:**
  1. Open the menu in Work mode.
- **Expected result:** No Company item.
- **Automation:** `v49_test` (guest menu, observation).

#### TC-WCO-031 — Company page on phones
- **Requirement:** FR-WCO-004, NFR-WRK-002
- **Type / Priority:** Responsive · P2
- **Preconditions:** Signed in as Aina with the Work add-on (Work size). 3 companies.
- **Test data:** 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open Company; open the New company window.
- **Expected result:** Cards stack to one column on phones, buttons wrap, window fits; two columns on the laptop.
- **Automation:** Device only (phone) · laptop manual.

---

## WTM — Time tracking

#### TC-WTM-001 — Time tab layout
- **Requirement:** FR-WTM-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Entries this month: 90 min on Design, 30 min general.
- **Steps:**
  1. Open Work → Time.
- **Expected result:** Timer card, month switcher, company filter, CSV and PDF buttons, tiles (This month 2h, Days with time, Average per day), "Where the time went", day cards.
- **Automation:** `v49_test` ('time tab', observation).

#### TC-WTM-002 — Time tab empty
- **Requirement:** FR-WTM-001
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** No entries.
- **Steps:**
  1. Open Time.
- **Expected result:** "No time logged in <month>" with advice; tiles show 0m.
- **Automation:** Manual

#### TC-WTM-003 — Log time on a task
- **Requirement:** FR-WTM-002, FR-WTM-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** For Site › Design, date today, 1 h 30 m, note "wireframes".
- **Steps:**
  1. Time → Log time; fill; Save.
- **Expected result:** Toast "Time logged — 1h 30m · Site › Design"; entry shows under today; project, task and company names filled in.
- **Automation:** `pg_time_test` (task entry fills names) · UI `v49_test` (observation).

#### TC-WTM-004 — Target list wording
- **Requirement:** FR-WTM-003
- **Type / Priority:** Usability · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). A Done task and a task in a project where Aina is viewer.
- **Test data:** None
- **Steps:**
  1. Open the "for" list in Log time.
- **Expected result:** Lists "Site · whole project", "Site › Design", "Site › Build", "General · Acme (not on a project)"; the Done task and the viewer project are absent.
- **Automation:** Manual

#### TC-WTM-005 — No target available
- **Requirement:** FR-WTM-003
- **Type / Priority:** Negative · P3
- **Preconditions:** Aina has the add-on, every company archived and no project.
- **Test data:** None
- **Steps:**
  1. Press Log time.
- **Expected result:** Alert "Add a company or a project first: time is logged under one of them."
- **Automation:** Manual

#### TC-WTM-006 — Validation order and messages
- **Requirement:** FR-WTM-004
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Empty form; 0 h 0 m; 25 h.
- **Steps:**
  1. Press Save with date cleared.
  2. Set date, leave 0 h 0 m, Save.
  3. Enter 25 h, Save.
- **Expected result:** "Choose the date."; "Enter the time you spent (hours and / or minutes)."; "An entry can not be more than 24 hours."
- **Automation:** Manual

#### TC-WTM-007 — Entry of exactly 24 hours
- **Requirement:** FR-WTM-004, FR-WTM-005
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). No time on 2026-10-05.
- **Test data:** 24 h 0 m on 2026-10-05; then 1 min more.
- **Steps:**
  1. Log 24 h.
  2. Log 1 minute on the same date.
- **Expected result:** First accepted. Second refused: "That day would have more than 24 hours logged."
- **Automation:** `pg_time_test` (over 24 hours in total refused; 1441 refused).

#### TC-WTM-008 — Day cap counts all entries and excludes the edited one
- **Requirement:** FR-WTM-005
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Entries on one date: 600 + 840 min (=1440).
- **Test data:** None
- **Steps:**
  1. Edit the 600 entry to 600 again.
  2. Edit it to 601.
- **Expected result:** Unchanged value saves; 601 is refused.
- **Automation:** `pg_time_test` partly (day total) · edit case manual.

#### TC-WTM-009 — Day cap is per person
- **Requirement:** FR-WTM-005
- **Type / Priority:** Data · P2
- **Preconditions:** Aina logged 24 h on 2026-10-05; Bala is a member.
- **Test data:** None
- **Steps:**
  1. As Bala log 2 h on the same date.
- **Expected result:** Accepted: the cap is per person.
- **Automation:** Manual

#### TC-WTM-010 — Manual entry in an archived company
- **Requirement:** FR-WTM-013, FR-WCO-009
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Acme archived.
- **Test data:** None
- **Steps:**
  1. Try to log general time under Acme and time on Site.
- **Expected result:** Both refused ("This company is archived: restore it to log time" / "…not in an archived company").
- **Automation:** `pg_time_test`.

#### TC-WTM-011 — Viewer and guest cannot log time
- **Requirement:** FR-WTM-013, FR-WLM-004
- **Type / Priority:** Security · P1
- **Preconditions:** Chen viewer, Dewi guest.
- **Test data:** None
- **Steps:**
  1. As Chen log time on a task via API; as Dewi log general time.
- **Expected result:** Both refused; Dewi sees no Time tab.
- **Automation:** `pg_time_test` (viewer cannot, no add-on nothing).

#### TC-WTM-012 — Time on a shared project has no company
- **Requirement:** FR-WTM-007
- **Type / Priority:** Data · P1
- **Preconditions:** Bala is a member of Aina's project with the add-on.
- **Test data:** 60 min on Design.
- **Steps:**
  1. As Bala log 60 min on Design.
  2. Open Time with All companies; download CSV.
- **Expected result:** Entry shows with the company line missing in the list; CSV Company column says "Shared projects"; with a Bala company selected it is hidden.
- **Automation:** `pg_time_test` (member logs time, no company) · CSV manual.

#### TC-WTM-013 — General time with a name
- **Requirement:** FR-WTM-008
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** For "General · Acme", name "  Client call ", 30 min.
- **Steps:**
  1. Log time; the Name box appears; Save.
- **Expected result:** Entry shows "Client call" instead of General; stored trimmed.
- **Automation:** `pg_time_test` (label trimmed).

#### TC-WTM-014 — Name is ignored for project time and capped at 100
- **Requirement:** FR-WTM-008
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Name of 100 and 101 characters.
- **Steps:**
  1. Log project time (name box hidden).
  2. Via API insert general time with a 101-character name.
- **Expected result:** Project time has empty name; 101 characters refused; the form stops at 100.
- **Automation:** `pg_time_test` (name ignored on project time; ≤100).

#### TC-WTM-015 — Edit and delete an entry
- **Requirement:** FR-WTM-009
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). An entry on 2026-09-30 viewed in October.
- **Test data:** Change date to 2026-10-01 and minutes to 100.
- **Steps:**
  1. Open the entry; change; Save.
  2. Open it again; Delete; confirm.
- **Expected result:** After save the tab shows the entry's month; deleting asks "Delete this time entry?" and removes it.
- **Automation:** `pg_time_test` (edit) · `v49_test` ('entry popup', observation).

#### TC-WTM-016 — Cannot change someone else's entry
- **Requirement:** FR-WTM-015
- **Type / Priority:** Security · P1
- **Preconditions:** Aina and Bala both have entries.
- **Test data:** None
- **Steps:**
  1. As Bala update Aina's entry through the API; list entries.
- **Expected result:** Update has no effect; Bala only sees his own rows.
- **Automation:** `pg_time_test` (private; cannot edit somebody else's).

#### TC-WTM-017 — Start and stop the timer
- **Requirement:** FR-WTM-010, FR-WTM-011, FR-WTM-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Timer on Site with note "calls"; run for 2 min 10 s.
- **Steps:**
  1. Time → choose Site · whole project, type the note, Start timer.
  2. Watch the clock.
  3. Press Stop.
- **Expected result:** Card turns "Timer running" with clock 00:02:10 and target; stop saves 3 minutes (rounded up); toast "Timer stopped"; form returns.
- **Automation:** `v49_test` ('timer on', 'timer stopped', observation); `pg_time_test` (start / stop).

#### TC-WTM-018 — Only one timer at a time
- **Requirement:** FR-WTM-010
- **Type / Priority:** Data · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Timer running on Site.
- **Steps:**
  1. Start another timer on Design in the task window.
- **Expected result:** The first is saved (at least 1 minute); only one running row exists.
- **Automation:** `pg_time_test`.

#### TC-WTM-019 — Timer on two devices
- **Requirement:** FR-WTM-010
- **Type / Priority:** Integration · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Phone and laptop signed in.
- **Steps:**
  1. Start the timer on the phone.
  2. Open Time on the laptop (reload).
  3. Stop it on the laptop.
- **Expected result:** The laptop shows the running timer with the same start time; stop on the laptop ends it on the phone after reload.
- **Automation:** Device only

#### TC-WTM-020 — Forgotten timer counts at most 12 hours
- **Requirement:** FR-WTM-011
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Timer started 20 hours ago.
- **Test data:** None
- **Steps:**
  1. Stop it.
- **Expected result:** Entry has 720 minutes.
- **Automation:** `pg_time_test`.

#### TC-WTM-021 — Timer stop respects the day cap
- **Requirement:** FR-WTM-011, FR-WTM-005
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). 1430 minutes already logged on the timer's date; timer running 30 min.
- **Test data:** None
- **Steps:**
  1. Stop the timer.
- **Expected result:** Saved minutes = 10 (what is left of the day).
- **Automation:** Manual (logic read from migration 076; not in a suite).

#### TC-WTM-022 — Stop with nothing running
- **Requirement:** FR-WTM-011
- **Type / Priority:** Negative · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** No timer.
- **Steps:**
  1. Call stop through the API.
- **Expected result:** No error; nothing changes (returns null).
- **Automation:** `pg_time_test` ('stopping with nothing running is harmless').

#### TC-WTM-023 — Running entry not counted
- **Requirement:** FR-WTM-012
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Timer running; 1 h manual entry.
- **Test data:** None
- **Steps:**
  1. Open Time; download CSV.
- **Expected result:** Total shows 1h; the running timer is not in lists, tiles or CSV.
- **Automation:** Manual

#### TC-WTM-024 — Timer without add-on / in archived company
- **Requirement:** FR-WTM-013
- **Type / Priority:** Negative · P1
- **Preconditions:** Aina's add-on ended; or Acme archived.
- **Test data:** None
- **Steps:**
  1. Start timer on Site (archived case) / call start via API (no add-on).
- **Expected result:** "This company is archived: restore it to track time." / "The Work add-on is needed to track time".
- **Automation:** `pg_time_test` (archived) · message manual.

#### TC-WTM-025 — Timer and Log time buttons in the task window
- **Requirement:** FR-WTM-014
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Task Design.
- **Steps:**
  1. Open Design; press Start timer; then Stop timer; press Log time.
- **Expected result:** Toast "Timer started"; button becomes Stop timer; Log time closes the task and opens Log time with Design chosen. "logged by everyone on this task" total shown.
- **Automation:** `v49_test` (observation).

#### TC-WTM-026 — Task window time for viewer
- **Requirement:** FR-WTM-014, FR-WTM-015
- **Type / Priority:** Security · P2
- **Preconditions:** Chen viewer.
- **Test data:** None
- **Steps:**
  1. Open a task.
- **Expected result:** Total visible; no timer buttons.
- **Automation:** `pg_time_test` (viewer reads totals).

#### TC-WTM-027 — Per-task totals visible to the project, not to outsiders
- **Requirement:** FR-WTM-015
- **Type / Priority:** Security · P1
- **Preconditions:** Aina 90 min and Bala 60 min on Design.
- **Test data:** None
- **Steps:**
  1. As Chen read totals; as Eli call time_summary.
- **Expected result:** Chen sees 150 minutes; Eli refused.
- **Automation:** `pg_time_test`, `pg_extras_test` (work_time_totals).

#### TC-WTM-028 — Privacy notice on someone else's project
- **Requirement:** FR-WTM-016
- **Type / Priority:** Usability · P3
- **Preconditions:** Bala on Aina's project.
- **Test data:** None
- **Steps:**
  1. As Bala choose Aina's task in Log time.
- **Expected result:** Text "Aina owns this project and can see the hours you log on it."; Time tab footer says owners can see hours.
- **Automation:** Manual

#### TC-WTM-029 — Team time for the owner
- **Requirement:** FR-WTM-017
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Aina 2 h and Bala 1 h on Site this month.
- **Test data:** None
- **Steps:**
  1. Tasks, select Site; press Team time; use the month arrows; press CSV.
- **Expected result:** Total 3h; per person bars; rows; CSV named "SITE <MONTH YEAR> TEAM TIME.csv".
- **Automation:** `pg_move_test` (owner sees everyone's hours with names) · `v49_test` (observation) · CSV manual.

#### TC-WTM-030 — Team time hidden / refused for others
- **Requirement:** FR-WTM-017
- **Type / Priority:** Security · P1
- **Preconditions:** Bala member.
- **Test data:** None
- **Steps:**
  1. As Bala look for Team time; call work_project_time through the API.
- **Expected result:** No button (owner only); API "Only the project owner can see the team's time".
- **Automation:** `pg_move_test` ('a member cannot see others' hours').

#### TC-WTM-031 — Timesheet CSV content
- **Requirement:** FR-WTM-018
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina Zahra with 3 entries in October (one on a shared project).
- **Test data:** Full name "Aina Zahra".
- **Steps:**
  1. Time → October, All companies → CSV.
  2. Open the file in a spreadsheet.
- **Expected result:** File "AINA ZAHRA OCTOBER TIMESHEET.csv"; title row, Company, Month, header Date, Day, Company, Project, Task, Notes, Hours; entries in date order; hours two decimals; Total row; Malay/accents readable (BOM).
- **Automation:** `v49_test` ('csv made', observation) · content manual.

#### TC-WTM-032 — CSV protects against formulas
- **Requirement:** FR-WTM-019
- **Type / Priority:** Security · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Note `=HYPERLINK("http://x")`, note with a double quote.
- **Steps:**
  1. Log an entry with that note; download CSV; open in a spreadsheet.
- **Expected result:** Cell shows text starting with an apostrophe-protected value, not a formula; quotes doubled.
- **Automation:** Manual

#### TC-WTM-033 — CSV filtered by company
- **Requirement:** FR-WTM-018
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Entries in Acme and Beta.
- **Test data:** None
- **Steps:**
  1. Choose Beta in the company filter; download CSV.
- **Expected result:** Only Beta rows; header Company says Beta; the tile says "This month · Beta".
- **Automation:** Manual

#### TC-WTM-034 — Timesheet PDF page
- **Requirement:** FR-WTM-020
- **Type / Priority:** Functional · P1
- **Preconditions:** As above.
- **Test data:** None
- **Steps:**
  1. Press PDF; in the print window choose Save as PDF.
- **Expected result:** New page titled "AINA ZAHRA OCTOBER TIMESHEET" with table, total, By project table and lines Employee: AINA ZAHRA / Approved by / Date.
- **Automation:** Device only (print dialog)

#### TC-WTM-035 — PDF blocked by pop-up blocker
- **Requirement:** FR-WTM-020
- **Type / Priority:** Negative · P3
- **Preconditions:** Pop-ups blocked.
- **Test data:** None
- **Steps:**
  1. Press PDF.
- **Expected result:** "Your browser blocked the new window. Allow pop-ups for LUMA and try again."
- **Automation:** Manual

#### TC-WTM-036 — Nothing to export
- **Requirement:** FR-WTM-021
- **Type / Priority:** Negative · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** A month with no time.
- **Steps:**
  1. Press CSV and PDF.
- **Expected result:** Alert "There is no time logged for this month and company yet." (title "Nothing to export"); no file.
- **Automation:** Manual

#### TC-WTM-037 — Time follows a moved task
- **Requirement:** FR-WTM-022
- **Type / Priority:** Integration · P1
- **Preconditions:** See WRK move case.
- **Test data:** None
- **Steps:**
  1. Move a task with 60 min to a project in another company.
- **Expected result:** The 60 min show under the new project and company.
- **Automation:** `pg_move_test` ('logged time follows').

#### TC-WTM-038 — Deleting a task or project keeps entry text
- **Requirement:** FR-WTM-006
- **Type / Priority:** Data · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Entry on Design.
- **Steps:**
  1. Delete task Design; delete project Site (even if archived).
- **Expected result:** Entries remain with task and project names but without links.
- **Automation:** `pg_time_test` (task and project deletion).

#### TC-WTM-039 — Entry limits
- **Requirement:** FR-WTM-023
- **Type / Priority:** Boundary · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** 20,000 existing entries (SQL load).
- **Steps:**
  1. Add one more.
- **Expected result:** Refused "You can keep up to 20,000 time entries".
- **Automation:** Manual (not in a suite).

#### TC-WTM-040 — Default date
- **Requirement:** FR-WTM-024
- **Type / Priority:** Data · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build).
- **Test data:** Insert via API without work_date at 00:30 Malaysia time.
- **Steps:**
  1. Insert and read.
- **Expected result:** work_date is the Malaysia date.
- **Automation:** Manual

#### TC-WTM-041 — Time tab on phones
- **Requirement:** FR-WTM-001, NFR-WRK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme with project Site (task Design, task Build). Entries and a running timer.
- **Test data:** 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open Time; use the month bar and filters; open Log time.
- **Expected result:** Month bar and filters wrap, clock and Stop button fit, tiles go to one column ≤760 px, no sideways scroll; laptop shows three tiles in a row.
- **Automation:** Device only (phone) · laptop manual.

#### TC-WTM-042 — Time tab hidden without add-on
- **Requirement:** FR-WTM-013
- **Type / Priority:** Security · P2
- **Preconditions:** Dewi guest.
- **Test data:** None
- **Steps:**
  1. Open Work.
- **Expected result:** No Time tab; typing the Time tab through code is not offered.
- **Automation:** Manual

---

## WTE — Teams

#### TC-WTE-001 — Teams tab empty
- **Requirement:** FR-WTE-001
- **Type / Priority:** Usability · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** No teams.
- **Steps:**
  1. Open Work → Teams.
- **Expected result:** "No teams in Acme yet" with Create a team; info line "0 of 5 teams used (all your companies together)".
- **Automation:** `v49_test` (teams tab, observation).

#### TC-WTE-002 — Create a team
- **Requirement:** FR-WTE-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** Name "Design", note "Brand and UI", colour green, people Bala and Chen, Add me.
- **Steps:**
  1. Teams (or New team); fill; Add people → pick; press Add me; Save team.
- **Expected result:** Toast "Team created"; card shows 3 people, counter in window read "3 / 50"; Bala and Chen notified.
- **Automation:** `pg_team_test` (created with people incl. owner) · `v49_test` (observation).

#### TC-WTE-003 — Team name required
- **Requirement:** FR-WTE-002
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** Empty name.
- **Steps:**
  1. New team; Save team.
- **Expected result:** "Give the team a name."
- **Automation:** `v49_test` ('empty name refused', observation).

#### TC-WTE-004 — Name and note length
- **Requirement:** FR-WTE-002
- **Type / Priority:** Boundary · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** Name 60 and note 140 characters.
- **Steps:**
  1. Type 61 and 141 characters.
- **Expected result:** Boxes stop at 60 and 140; database refuses more.
- **Automation:** Manual

#### TC-WTE-005 — Team of exactly 50 people
- **Requirement:** FR-WTE-002
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. 51 contacts.
- **Test data:** Add 50 then the 51st.
- **Steps:**
  1. Pick 50 people (counter 50 / 50).
  2. Try to add one more.
- **Expected result:** 50 accepted; the 51st is not added (picker ignores it); via API 51 refused: "A team can have up to 50 people".
- **Automation:** Manual (not in a suite).

#### TC-WTE-006 — Duplicate team name
- **Requirement:** FR-WTE-003
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Team "Design" exists.
- **Test data:** " design ".
- **Steps:**
  1. Create another team named " design " in the same company.
  2. Create it in company Beta.
- **Expected result:** Same company: "You already have a team called "design" in this company"; other company: allowed.
- **Automation:** `pg_team_test` (same name refused).

#### TC-WTE-007 — Only contacts can be members
- **Requirement:** FR-WTE-004
- **Type / Priority:** Security · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** User Zed who is not a contact.
- **Steps:**
  1. Call work_set_team through the API with Zed.
- **Expected result:** Refused "You can only add people from your contacts"; the picker lists contacts only.
- **Automation:** `pg_team_test`.

#### TC-WTE-008 — Edit a team
- **Requirement:** FR-WTE-005, FR-WTE-016
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Team Design with Bala, Chen, Aina.
- **Test data:** Rename to "Design team", remove Chen.
- **Steps:**
  1. Edit; change; Save.
- **Expected result:** Toast "Team saved"; people replaced (Chen removed).
- **Automation:** `pg_team_test` ('rename + replace people').

#### TC-WTE-009 — Only the owner changes or deletes a team
- **Requirement:** FR-WTE-005
- **Type / Priority:** Security · P1
- **Preconditions:** Bala is in the team; Eli unrelated.
- **Test data:** None
- **Steps:**
  1. As Bala and Eli call set_team (edit) and delete_team.
- **Expected result:** "Only the owner can change a team" / "Only the owner can delete a team".
- **Automation:** `pg_team_test`.

#### TC-WTE-010 — Delete a team
- **Requirement:** FR-WTE-005
- **Type / Priority:** Data · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Task "Logo" for team Design with assignees.
- **Test data:** None
- **Steps:**
  1. Edit team → Delete; confirm.
- **Expected result:** Toast "Team deleted"; task stays with its assignees and loses the chip.
- **Automation:** `pg_team_test` ('deleting a team keeps the task and its people').

#### TC-WTE-011 — Team limit Work (5)
- **Requirement:** FR-WTE-006, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. 5 teams (spread over two companies).
- **Test data:** 6th team.
- **Steps:**
  1. Create the 6th.
- **Expected result:** Refused: "Your Work add-on allows up to 5 teams"; info line "5 of 5 teams used".
- **Automation:** `pg_team_test` ('Work allows 5 teams').

#### TC-WTE-012 — Team limit Work Pro (20)
- **Requirement:** FR-WTE-006, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina has Work Pro; 20 teams.
- **Test data:** 21st.
- **Steps:**
  1. Create the 21st.
- **Expected result:** Refused "up to 20 teams"; the 6th–20th are accepted.
- **Automation:** `pg_team_test` covers 'Work Pro allows more' (the 20 / 21 boundary is manual).

#### TC-WTE-013 — Team in an archived company / without add-on
- **Requirement:** FR-WTE-007
- **Type / Priority:** Negative · P1
- **Preconditions:** Acme archived; Eli no add-on.
- **Test data:** None
- **Steps:**
  1. Edit, delete, create a team in Acme (API); as Eli create a team.
- **Expected result:** "This company is archived: restore it to change its teams"; Eli: refused ("The Work add-on is needed to manage teams").
- **Automation:** `pg_team_test` (archived frozen; needs the add-on).

#### TC-WTE-014 — Give a task to a team
- **Requirement:** FR-WTE-008
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Project Site with Bala and Aina accepted, Chen not on it. Team Design = Aina, Bala, Chen.
- **Test data:** Task "Logo".
- **Steps:**
  1. New task in Site; choose team Design.
- **Expected result:** Aina and Bala ticked; note "2 of 3 ticked. You can still add or remove people above."; untick Bala and tick another person works.
- **Automation:** `v49_test` ('team picked → who', observation).

#### TC-WTE-015 — Team ticks never exceed 10 assignees
- **Requirement:** FR-WTE-008, FR-WRK-023
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Team of 12 people all on the project.
- **Test data:** None
- **Steps:**
  1. Pick the team in a task.
- **Expected result:** Only 10 people are ticked.
- **Automation:** Manual

#### TC-WTE-016 — Missing people and Add them to the project
- **Requirement:** FR-WTE-009
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Chen not on Site; Dewi invited (pending).
- **Test data:** None
- **Steps:**
  1. Pick team Design in a task of Site.
  2. Press Add them to the project.
- **Expected result:** Note lists "1 not on this project yet: Chen"; button invites Chen (not pending ones); message "1 invited. They can be given the task once they accept."
- **Automation:** `v49_test` ('invite sent', observation).

#### TC-WTE-017 — Member sees "Ask the project owner"
- **Requirement:** FR-WTE-009
- **Type / Priority:** Security · P2
- **Preconditions:** Bala (member) edits a task of Aina's project with Aina's team.
- **Test data:** None
- **Steps:**
  1. Pick the team.
- **Expected result:** Missing list says "Ask the project owner to add them."; no invite button; note "Only the label is added…" when the member list is hidden.
- **Automation:** Manual

#### TC-WTE-018 — Empty team message
- **Requirement:** FR-WTE-010
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Team with no people.
- **Test data:** None
- **Steps:**
  1. Pick it in a task.
- **Expected result:** "This team has nobody in it yet."
- **Automation:** Manual

#### TC-WTE-019 — Add a whole team to a project
- **Requirement:** FR-WTE-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Team Design (Aina, Bala, Chen, Dewi); Bala already on Site.
- **Test data:** None
- **Steps:**
  1. Edit project Site; Add a whole team → Design → Add team.
  2. Press it again.
- **Expected result:** First: Chen and Dewi invited; toast "Team added — 2 people from Design invited". Second: "Nothing to add — Everyone in Design is already on this project".
- **Automation:** `v49_test` ('whole team invited', observation).

#### TC-WTE-020 — Add team without a choice; people limit
- **Requirement:** FR-WTE-011, FR-WLM-009
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. Project already has 8 accepted/invited people (Work).
- **Test data:** Team of 3 new people.
- **Steps:**
  1. Press Add team with nothing picked.
  2. Pick the team and press Add team.
- **Expected result:** "Pick a team first."; then refused: "Your plan allows up to 8 people on a project" (shown as add-on wording).
- **Automation:** Manual

#### TC-WTE-021 — A task can only use the owner's teams
- **Requirement:** FR-WTE-012
- **Type / Priority:** Security · P1
- **Preconditions:** Aina's project; Bala's team "Ops".
- **Test data:** None
- **Steps:**
  1. As Aina set team_id = Ops through the API; move a task for Aina's team to Bala's project.
- **Expected result:** Insert / update refused "That team does not belong to this project's owner"; on move the team is cleared.
- **Automation:** `pg_team_test` ('a task cannot use someone else's team').

#### TC-WTE-022 — Team chip and filter
- **Requirement:** FR-WTE-013
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** Two tasks for Design, one for no team.
- **Steps:**
  1. Board shows chip; choose team in the filter; on Teams press "2 open tasks".
- **Expected result:** Chip on cards; filter shows 2 tasks; the button opens Tasks with project filter cleared and team selected.
- **Automation:** Manual

#### TC-WTE-023 — Visibility of team members
- **Requirement:** FR-WTE-014
- **Type / Priority:** Security · P1
- **Preconditions:** Aina's team Design (Bala, Chen); Dewi on Aina's project; Eli unrelated.
- **Test data:** None
- **Steps:**
  1. As each person call my_work_teams and select from work_teams.
- **Expected result:** Aina: members listed; Bala: sees team under "Teams you are in" with owner name; Dewi: team name only, no people, count only; Eli: none; direct table read returns nothing for non-owners.
- **Automation:** `pg_team_test` (owner sees people; people on project see name only; unrelated nothing; cannot read table).

#### TC-WTE-024 — Added-to-team notification
- **Requirement:** FR-WTE-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** Create team with Bala; save again; add Chen.
- **Steps:**
  1. Create the team with Bala and Aina.
  2. Save without change.
  3. Add Chen and save.
- **Expected result:** Bala gets "Aina added you to the team "Design"" with body "Acme. Open Work to see it."; Aina none; no second notice on re-save; Chen gets one.
- **Automation:** `pg_team_test` (told, not owner, not again).

#### TC-WTE-025 — Opening the team notification
- **Requirement:** FR-WTE-015, FR-WNT-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Bala has the add-on; Dewi has not.
- **Test data:** None
- **Steps:**
  1. Open the notification as Bala and as Dewi (add Dewi to a team).
- **Expected result:** Bala lands on Work → Teams; Dewi lands on Projects.
- **Automation:** Manual

#### TC-WTE-026 — Teams tab on phones
- **Requirement:** FR-WTE-001, NFR-WRK-002
- **Type / Priority:** Responsive · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi. 3 teams with 10 people.
- **Test data:** 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open Teams; open New team window and add many people.
- **Expected result:** Cards stack; people chips wrap (+N more after 8); window fits and scrolls; no page sideways scroll.
- **Automation:** Device only (phone) · laptop manual.

#### TC-WTE-027 — Teams written only through functions
- **Requirement:** NFR-WTE-001
- **Type / Priority:** Security · P2
- **Preconditions:** Signed in as Aina with the Work add-on; company Acme in view; contacts Bala, Chen, Dewi.
- **Test data:** None
- **Steps:**
  1. Insert directly into work_teams as Aina via the API.
- **Expected result:** Refused (no insert grant).
- **Automation:** `pg_team_test` ('cannot read the table directly' for others) · direct insert manual.

#### TC-WTE-028 — Teams work before migration 084
- **Requirement:** NFR-WTE-002
- **Type / Priority:** Compatibility · P3
- **Preconditions:** Database without migration 084.
- **Test data:** None
- **Steps:**
  1. Open Work; try Save team.
- **Expected result:** Work loads with no teams; save says "Run supabase/migrations/084_work_teams.sql in the SQL Editor first."
- **Automation:** Manual

---

## WCM — Comments, history, @mentions, files, sharing

#### TC-WCM-001 — Sections appear only for saved tasks
- **Requirement:** FR-WCM-001
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** None
- **Steps:**
  1. Open New task.
  2. Save it and reopen.
- **Expected result:** New task: no Files / Discussion; saved task: both shown.
- **Automation:** `v49_test` ('task extras', observation).

#### TC-WCM-002 — Write a comment
- **Requirement:** FR-WCM-002, FR-WCM-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** "Please use the new logo".
- **Steps:**
  1. As Aina open Design; type; press send (or Ctrl+Enter).
- **Expected result:** Comment appears with initial, name "Aina (you)", "just now"; toast "Comment sent — The people on this task are told".
- **Automation:** `pg_wfiles_test` (owner comments) · `v49_test` (observation).

#### TC-WCM-003 — Empty comment
- **Requirement:** FR-WCM-002
- **Type / Priority:** Negative · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Spaces only.
- **Steps:**
  1. Press send.
- **Expected result:** "Write your comment first, then press send."; database also refuses blank body.
- **Automation:** `pg_wfiles_test` (empty comment refused).

#### TC-WCM-004 — Comment length 2000
- **Requirement:** FR-WCM-002
- **Type / Priority:** Boundary · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** 2000 and 2001 characters.
- **Steps:**
  1. Paste 2001 characters.
- **Expected result:** Box stops at 2000; 2000 sends.
- **Automation:** Manual

#### TC-WCM-005 — Who may comment
- **Requirement:** FR-WCM-002, FR-WCM-003
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** None
- **Steps:**
  1. As Chen, Dewi, Eli try to insert a comment through the API; open the window as Chen and Dewi.
- **Expected result:** All refused; Chen and Dewi see the comments but no comment box and no Attach button; Eli cannot read.
- **Automation:** `pg_wfiles_test` (viewer, no-add-on, outsider cannot; reading by viewer; outsider cannot read).

#### TC-WCM-006 — No comments yet
- **Requirement:** FR-WCM-003
- **Type / Priority:** Usability · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Task without comments.
- **Steps:**
  1. Open as Aina; as Chen.
- **Expected result:** "No comments yet. Be the first to write one." for Aina; only "No comments yet." for Chen.
- **Automation:** Manual

#### TC-WCM-007 — Edit own comment and history
- **Requirement:** FR-WCM-005, FR-WCM-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. Bala wrote a comment.
- **Test data:** Edit twice: "second wording", "third wording".
- **Steps:**
  1. As Bala press the pen; change; Save; repeat.
  2. Press the "edited" link.
- **Expected result:** Comment shows "edited"; history lists Now = third, then Before = second and first, newest first with dates.
- **Automation:** `pg_move_test` (history lists current and earlier) · `v49_test` (observation).

#### TC-WCM-008 — Only the writer edits
- **Requirement:** FR-WCM-005
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. Bala's comment.
- **Test data:** Aina edits Bala's comment via API.
- **Steps:**
  1. As Aina (owner) try to edit; check the UI.
- **Expected result:** No pen for Aina; API change has no effect; changing user_id refused "Only the wording can change".
- **Automation:** `pg_move_test` ('only the writer can edit (not even the owner)'; 'only the wording can change').

#### TC-WCM-009 — Edit with empty text and same text
- **Requirement:** FR-WCM-005
- **Type / Priority:** Negative · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Empty text; identical text.
- **Steps:**
  1. Edit and save empty; edit and save unchanged.
- **Expected result:** "A comment can not be empty. Delete it instead."; unchanged text adds no history row.
- **Automation:** `pg_move_test` (same text adds no history) · empty text manual.

#### TC-WCM-010 — 50 edits limit
- **Requirement:** FR-WCM-005
- **Type / Priority:** Boundary · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Edit a comment 51 times (API loop).
- **Steps:**
  1. Update body 51 times.
- **Expected result:** The 51st fails: "A comment can be edited up to 50 times".
- **Automation:** Manual

#### TC-WCM-011 — History is private
- **Requirement:** FR-WCM-006, NFR-WCM-001
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** None
- **Steps:**
  1. As Eli call work_comment_history; as Bala select from work_comment_edits.
- **Expected result:** Both refused / no access.
- **Automation:** `pg_move_test` (outsider cannot read; table cannot be read directly).

#### TC-WCM-012 — Delete rules
- **Requirement:** FR-WCM-007
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. Comments by Aina and Bala.
- **Test data:** None
- **Steps:**
  1. As Bala delete Aina's comment; as Aina delete Bala's.
- **Expected result:** Bala cannot (count unchanged); Aina (owner) can; each writer can delete own.
- **Automation:** `pg_wfiles_test`.

#### TC-WCM-013 — 500 comments limit
- **Requirement:** FR-WCM-008
- **Type / Priority:** Boundary · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** 500 comments via SQL.
- **Steps:**
  1. Add the 501st.
- **Expected result:** Refused "A task can have up to 500 comments".
- **Automation:** Manual

#### TC-WCM-014 — Comment notification
- **Requirement:** FR-WCM-009
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Aina comments.
- **Steps:**
  1. Check Bala's and Aina's notifications; Bala replies; check Aina's.
- **Expected result:** Bala: "💬 Aina commented on Design"; Aina none for own comment; Aina (creator) told of Bala's reply; opening it opens the task.
- **Automation:** `pg_wfiles_test`.

#### TC-WCM-015 — Mention picker
- **Requirement:** FR-WCM-010
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Typing "Thanks @Ba".
- **Steps:**
  1. Type; look at the list; choose Bala.
- **Expected result:** List with matching people (not yourself, max 6); "@Bala " inserted.
- **Automation:** `v49_test` ('mention list', 'inserted', observation).

#### TC-WCM-016 — Mention notification replaces comment notice
- **Requirement:** FR-WCM-011, FR-WNT-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** "@Bala please check".
- **Steps:**
  1. Send the comment; check Bala's notifications.
- **Expected result:** Bala gets "@ Aina mentioned you on Design" and no "commented" notice; the name is highlighted.
- **Automation:** `pg_extras_test` (mention only, not also the general notice).

#### TC-WCM-017 — Mentions keep only project people, never self
- **Requirement:** FR-WCM-011
- **Type / Priority:** Data · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** mentions = Bala, Eli, Aina.
- **Steps:**
  1. Insert a comment by Aina via API.
- **Expected result:** Stored mentions = Bala only.
- **Automation:** `pg_extras_test`.

#### TC-WCM-018 — Edit adds a mention
- **Requirement:** FR-WCM-011
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Add Chen to the mentions.
- **Steps:**
  1. Edit the comment to tag Chen.
- **Expected result:** Only Chen gets a new mention notice; Bala not again.
- **Automation:** `pg_extras_test`.

#### TC-WCM-019 — Mention of a similar name (over-tagging)
- **Requirement:** FR-WCM-011
- **Type / Priority:** Negative · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. People "Ann" and "Anna Tan" on the project.
- **Test data:** "@Anna Tan hi".
- **Steps:**
  1. Send it; look at who is highlighted/notified.
- **Expected result:** Expected only Anna; the app text match also tags Ann (see Findings).
- **Automation:** Manual

#### TC-WCM-020 — Mention limit 10
- **Requirement:** FR-WCM-011
- **Type / Priority:** Boundary · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. 12 people.
- **Test data:** 12 names.
- **Steps:**
  1. Insert comment with 12 mentions via API.
- **Expected result:** Only 10 kept.
- **Automation:** Manual

#### TC-WCM-021 — Attach a file
- **Requirement:** FR-WCM-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** PDF 100 KB "brief.pdf".
- **Steps:**
  1. As Aina press Attach a file; choose the PDF.
- **Expected result:** "Uploading…", then toast "File attached — The people on this project can open it"; listed with size and "Aina"; also in Aina's Documents; shared with Bala, Chen, Dewi, not Eli.
- **Automation:** `pg_wfiles_test` (attach; shared with project; viewer sees list) · picker Device only.

#### TC-WCM-022 — Attach rules
- **Requirement:** FR-WCM-013
- **Type / Priority:** Negative · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Bala's document; a viewer; the 21st file.
- **Steps:**
  1. Aina attaches Bala's document via API; Chen attaches; attach 21 files.
- **Expected result:** "You can only attach your own documents"; viewer "Not allowed"; 21st: "A task can have up to 20 files".
- **Automation:** `pg_wfiles_test` (own documents, viewer) · 20-file limit manual.

#### TC-WCM-023 — Open a file
- **Requirement:** FR-WCM-014
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** Attached file.
- **Steps:**
  1. Click the file name as Chen; then with an expired link.
- **Expected result:** Opens in a new tab; on failure "Could not open the file: …".
- **Automation:** Device only (new tab) · manual.

#### TC-WCM-024 — Remove a file
- **Requirement:** FR-WCM-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. File attached by Aina.
- **Test data:** None
- **Steps:**
  1. Bala tries to remove it; Aina removes it and confirms.
- **Expected result:** Bala refused; Aina: confirmation text, file gone from list and no longer shared; stays in Aina's Documents.
- **Automation:** `pg_wfiles_test` ('a member cannot remove…', 'detaching un-shares').

#### TC-WCM-025 — Sharing follows membership
- **Requirement:** FR-WCM-016
- **Type / Priority:** Integration · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** File attached; Dewi removed; Eli joins later.
- **Steps:**
  1. Owner removes Dewi; invite Eli (pending) and Eli accepts.
- **Expected result:** Dewi loses access to the file; Eli gets it when accepting.
- **Automation:** `pg_wfiles_test` (removing a person takes sharing away; joining later gets files).

#### TC-WCM-026 — Deleting a task or project un-shares files
- **Requirement:** FR-WCM-016
- **Type / Priority:** Data · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina.
- **Test data:** File attached to a task.
- **Steps:**
  1. Delete the task; attach again to another; delete the project.
- **Expected result:** Task and its files, comments are removed and nobody keeps the share; same on project deletion.
- **Automation:** `pg_wfiles_test`.

#### TC-WCM-027 — Files and comments follow a moved task
- **Requirement:** FR-WCM-016, FR-WCM-017
- **Type / Priority:** Integration · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. Second project with Chen only.
- **Test data:** None
- **Steps:**
  1. Move Design to the second project.
- **Expected result:** Comment and file are in the new project; file shared with new people, not the old.
- **Automation:** `pg_move_test`.

#### TC-WCM-028 — No comments or files in an archived company
- **Requirement:** FR-WCM-003, FR-WCO-009
- **Type / Priority:** Negative · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. Company archived.
- **Test data:** None
- **Steps:**
  1. Open the task as Aina; try via API.
- **Expected result:** Comment box and Attach hidden; API refuses.
- **Automation:** `pg_company_test` covers task writes only · comments manual.

#### TC-WCM-029 — Task window on phones
- **Requirement:** FR-WCM-001, NFR-WRK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen viewer; Dewi guest; Eli outsider. Task "Design" assigned to Bala, created by Aina. 5 comments, 2 files.
- **Test data:** 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open the task; open the mention list; open history.
- **Expected result:** Window scrolls inside itself; mention list and history fit the screen; buttons reachable; no sideways scroll.
- **Automation:** Device only (phone) · laptop manual.

#### TC-WCM-030 — Guest sees comments and files
- **Requirement:** FR-WCM-001, FR-WLM-005
- **Type / Priority:** Security · P1
- **Preconditions:** Dewi guest.
- **Test data:** None
- **Steps:**
  1. Open a task.
- **Expected result:** Comments and files visible; comment box and attach hidden.
- **Automation:** `v49_test` ('guest extras', observation); `pg_wfiles_test` (file sharing includes guest).

---

## WGV — Gantt, timeline, links, calendar, deadlines

#### TC-WGV-001 — Gantt basics
- **Requirement:** FR-WGV-001, FR-WGV-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Tasks: A (1–5 Oct, Doing, checklist 1/2), B (due 8 Oct only), C (no dates), D overdue.
- **Test data:** Project deadline 20 Oct.
- **Steps:**
  1. Tasks → Gantt, All projects.
  2. Select project Site.
- **Expected result:** A bar from 1 to 5 Oct, fill ≈50 %; B diamond; D red outline; deadline flag; today line; legend; C listed under "No dates yet". With Site selected: rows grouped by phase and "Not in a phase".
- **Automation:** `v49_test` prints bars, milestones, rows, groups (observation).

#### TC-WGV-002 — Gantt zoom and Today
- **Requirement:** FR-WGV-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Zoom Week / Month / Quarter.
- **Steps:**
  1. Press each zoom; scroll away; press Today.
- **Expected result:** Week shows a tick per day, Month per Monday, Quarter none; widths 38 / 16 / 5 px per day; Today scrolls back.
- **Automation:** `v49_test` ('week zoom ticks', 'quarter zoom', observation).

#### TC-WGV-003 — Gantt empty
- **Requirement:** FR-WGV-004
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Tasks without dates only.
- **Test data:** None
- **Steps:**
  1. Open Gantt.
- **Expected result:** "Nothing to draw yet" with "N tasks have no dates".
- **Automation:** Manual

#### TC-WGV-004 — Drag a bar to move
- **Requirement:** FR-WGV-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Bar 10–14 Oct at Month zoom (16 px/day).
- **Test data:** Drag right 3 days (≈50 px).
- **Steps:**
  1. Press on the bar, move 50 px right, release.
- **Expected result:** Tooltip shows new dates and "5 days"; saved as 13–17 Oct; toast "Dates changed"; reopen task confirms.
- **Automation:** `v49_test` simulates drags (observation) · finger drag Device only.

#### TC-WGV-005 — A tap is not a drag
- **Requirement:** FR-WGV-005
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Move < 5 px.
- **Steps:**
  1. Tap a bar.
- **Expected result:** Task window opens; nothing saved.
- **Automation:** `v49_test` ('a tap does not save', observation).

#### TC-WGV-006 — Resize start and end
- **Requirement:** FR-WGV-006
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Bar 10–14 Oct.
- **Test data:** Drag right handle 2 days left of start; left handle past the end.
- **Steps:**
  1. Drag the right end far left.
  2. Drag the left end far right.
- **Expected result:** End cannot pass the start (1 day bar); start cannot pass the end.
- **Automation:** `v49_test` (observation).

#### TC-WGV-007 — Drag one-date task
- **Requirement:** FR-WGV-005
- **Type / Priority:** Functional · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Task with only an end date.
- **Test data:** None
- **Steps:**
  1. Drag its diamond 2 days.
- **Expected result:** End date moves 2 days; no start date added.
- **Automation:** Manual

#### TC-WGV-008 — Viewer / guest cannot drag
- **Requirement:** FR-WGV-005
- **Type / Priority:** Security · P1
- **Preconditions:** Chen viewer; Dewi guest.
- **Test data:** None
- **Steps:**
  1. Open Gantt; try to drag.
- **Expected result:** No handles; nothing moves.
- **Automation:** Manual

#### TC-WGV-009 — Drag refused by the database
- **Requirement:** FR-WGV-007
- **Type / Priority:** Negative · P1
- **Preconditions:** Aina's add-on ended; page open.
- **Test data:** None
- **Steps:**
  1. Drag a bar.
- **Expected result:** Bar jumps back; "You can't change tasks in this project."
- **Automation:** Manual

#### TC-WGV-010 — Drag in archived company
- **Requirement:** FR-WGV-005, FR-WCO-009
- **Type / Priority:** Security · P2
- **Preconditions:** Company archived.
- **Test data:** None
- **Steps:**
  1. Open Gantt; drag.
- **Expected result:** No drag handles; Gantt readable.
- **Automation:** Manual

#### TC-WGV-011 — Set a link (waits for)
- **Requirement:** FR-WGV-008
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Tasks Design and Build.
- **Test data:** Build waits for Design.
- **Steps:**
  1. Open Build; in "Add a task it waits for…" choose Design; Save.
- **Expected result:** Chip shows; saved; arrow on Gantt from Design end to Build start.
- **Automation:** `pg_extras_test` (links saved, readable by project) · `v49_test` ('dependency chip', observation).

#### TC-WGV-012 — Link rules: same project, 10 maximum, not self
- **Requirement:** FR-WGV-008
- **Type / Priority:** Boundary · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Tasks in two projects; a task with 10 links.
- **Test data:** 11th link; a task from another project.
- **Steps:**
  1. In UI choose an 11th predecessor.
  2. Via API link to another project's task and to itself.
- **Expected result:** UI ignores the 11th; API: "A task can wait for up to 10 other tasks", "A task can only wait for a task in the same project"; self is dropped.
- **Automation:** `pg_extras_test` (same project) · 10 limit manual.

#### TC-WGV-013 — Loop refused
- **Requirement:** FR-WGV-009
- **Type / Priority:** Negative · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Test waits for Build waits for Design.
- **Test data:** Make Design wait for Test.
- **Steps:**
  1. Save Design with Test as predecessor.
- **Expected result:** Alert "The task was saved, but its links were not: That would make a loop…".
- **Automation:** `pg_extras_test` (loop refused).

#### TC-WGV-014 — Links only for editors
- **Requirement:** FR-WGV-008, FR-WLM-004
- **Type / Priority:** Security · P1
- **Preconditions:** Chen viewer.
- **Test data:** None
- **Steps:**
  1. Call work_set_dependencies as Chen.
- **Expected result:** "You can not change this task".
- **Automation:** `pg_extras_test`.

#### TC-WGV-015 — Warning when starting too early
- **Requirement:** FR-WGV-010
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Design ends 12 Oct (not done).
- **Test data:** Build starts 10 Oct.
- **Steps:**
  1. Edit Build; choose Design as predecessor.
- **Expected result:** Warning "This task starts before “Design” ends." and link badge on Build's card; badge disappears when Design is Done.
- **Automation:** `v49_test` ('warning', observation).

#### TC-WGV-016 — Red dashed arrow
- **Requirement:** FR-WGV-011
- **Type / Priority:** Functional · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. As above.
- **Test data:** None
- **Steps:**
  1. Open Gantt.
- **Expected result:** The arrow Design → Build is red and dashed.
- **Automation:** `v49_test` ('conflicts shown red', observation).

#### TC-WGV-017 — Cascade later
- **Requirement:** FR-WGV-012
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. A 1–5 Oct; B (waits for A) 6–8 Oct; C (waits for B) 9–10 Oct. Month zoom.
- **Test data:** Drag A right by 3 days.
- **Steps:**
  1. Drag bar A 3 days right; wait.
- **Expected result:** A 4–8 Oct; B pushed by 3 → 9–11 Oct; C pushed by 3 (B now ends 11, so C starts 12): 12–13 Oct; toast "2 linked tasks moved too".
- **Automation:** Manual (logic in work.views.js; not in a suite).

#### TC-WGV-018 — Cascade earlier follows tight successors
- **Requirement:** FR-WGV-013
- **Type / Priority:** Integration · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. A 1–5; B starts 6 (tight); C starts 12 (gap).
- **Test data:** Drag A 2 days left.
- **Steps:**
  1. Drag A left by 2 days.
- **Expected result:** B moves 2 days earlier (4–…); C (gap) stays unless it is tight to B's old end.
- **Automation:** Manual

#### TC-WGV-019 — Cascade never goes before other predecessors
- **Requirement:** FR-WGV-013
- **Type / Priority:** Boundary · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. B waits for A (ends 5) and X (ends 8); B starts 9.
- **Test data:** Drag A 3 days left.
- **Steps:**
  1. Drag A earlier.
- **Expected result:** B does not move before 9 (end of X + 1).
- **Automation:** Manual

#### TC-WGV-020 — Cascade skips Done and read-only tasks
- **Requirement:** FR-WGV-014
- **Type / Priority:** Integration · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. B Done; C in a project... (C waits for B).
- **Test data:** None
- **Steps:**
  1. Drag A later.
- **Expected result:** Done B is untouched and its followers are not cascaded through it; toast counts only moved tasks.
- **Automation:** Manual

#### TC-WGV-021 — Cascade partial failure
- **Requirement:** FR-WGV-014, NFR-WGV-002
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Linked task's save is blocked (API stub).
- **Test data:** None
- **Steps:**
  1. Drag A; make the second save fail.
- **Expected result:** A saved; the failed linked task returns to old dates; others stay moved (not transactional — see Findings).
- **Automation:** Manual

#### TC-WGV-022 — Two devices drag the same task
- **Requirement:** FR-WGV-005, NFR-WGV-002
- **Type / Priority:** Integration · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Same task on phone and laptop.
- **Steps:**
  1. Drag on both without reloading.
- **Expected result:** Last save wins; other device shows old dates until reload.
- **Automation:** Device only

#### TC-WGV-023 — Links removed on delete and move
- **Requirement:** FR-WGV-008, FR-WRK-032
- **Type / Priority:** Data · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Chain A→B→C.
- **Steps:**
  1. Delete B; move C to another project.
- **Expected result:** Links with B are removed; moving C drops its links.
- **Automation:** `pg_extras_test` (move drops links; deleting a task removes links).

#### TC-WGV-024 — Timeline groups
- **Requirement:** FR-WGV-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Tasks: overdue, this week, next week, in November, no date, done 3 days ago, done 20 days ago; project deadline next month.
- **Test data:** None
- **Steps:**
  1. Tasks → Timeline.
- **Expected result:** Groups in order: Recently done (3 days one only), Overdue, This week, Next week, November, deadline milestone with flag, No date; the 20-days-ago one is hidden.
- **Automation:** `v49_test` ('timeline', observation).

#### TC-WGV-025 — Timeline opens task and milestone
- **Requirement:** FR-WGV-015
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** None
- **Steps:**
  1. Tap a task row; close; tap a milestone.
- **Expected result:** Task window opens; milestone opens the project's Phases view.
- **Automation:** `v49_test` ('timeline item opens task').

#### TC-WGV-026 — Timeline empty
- **Requirement:** FR-WGV-015
- **Type / Priority:** Usability · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. No dated tasks, no deadlines.
- **Test data:** None
- **Steps:**
  1. Open Timeline.
- **Expected result:** "Nothing on the timeline".
- **Automation:** Manual

#### TC-WGV-027 — Views follow filters
- **Requirement:** FR-WGV-016
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Tasks of two projects, some for Aina, a team filter.
- **Test data:** None
- **Steps:**
  1. Switch Gantt/Timeline; use project, Assigned to me, team.
- **Expected result:** Only matching tasks drawn.
- **Automation:** Manual

#### TC-WGV-028 — Calendar spans
- **Requirement:** FR-WGV-017
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Task 10–14 Oct; task 1 Oct–15 Dec (long); Done task; project deadline 12 Oct.
- **Test data:** None
- **Steps:**
  1. Work mode → Calendar; check 10–14 Oct and 1 Nov.
  2. Hide the "Work tasks" filter.
- **Expected result:** 10 Oct "task starts", 11–13 "task in progress", 14 "task due"; long task only on 1 Oct and 15 Dec; Done task absent; deadline "Project deadline" on 12 Oct; filter hides all; tap opens the task.
- **Automation:** `v49_test` prints calendar items (observation).

#### TC-WGV-029 — Calendar in Personal mode
- **Requirement:** FR-WGV-017, FR-WNT-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Show Work in Personal off then on.
- **Steps:**
  1. In Personal mode open Calendar; switch preference on.
- **Expected result:** Off: no Work items. On: Work tasks and deadlines appear; guest (no add-on) never sees them.
- **Automation:** `v49_test` (observation).

#### TC-WGV-030 — Calendar file
- **Requirement:** FR-WGV-018
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Open task due 10 Oct (start 8 Oct), Done task, task without date, active project deadline 20 Oct.
- **Test data:** None
- **Steps:**
  1. Tasks → Calendar file.
- **Expected result:** File LUMA-work.ics with 2 events (the task 8–10 Oct all-day, "Deadline: Site"); toast "Calendar file saved — 2 deadlines · LUMA-work.ics"; imports into Google / Apple / Outlook.
- **Automation:** Device only (import into a calendar app) · file content manual.

#### TC-WGV-031 — Calendar file empty and filters
- **Requirement:** FR-WGV-018
- **Type / Priority:** Negative · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. Only undated tasks.
- **Test data:** None
- **Steps:**
  1. Press Calendar file; then select a project and Assigned to me with dated tasks.
- **Expected result:** Alert "There are no open tasks with a due date to export."; with filters only matching tasks exported.
- **Automation:** Manual

#### TC-WGV-032 — ICS text rules
- **Requirement:** FR-WGV-019
- **Type / Priority:** Data · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Task title "Plan, review; ship\" with a new line in the description.
- **Steps:**
  1. Export and open the file in a text editor.
- **Expected result:** CRLF endings, escaped , ; \ and \n, lines ≤74 characters before folding, DTEND = last day + 1.
- **Automation:** Manual

#### TC-WGV-033 — Tasks with only a start date
- **Requirement:** FR-WGV-017, FR-WGV-018
- **Type / Priority:** Negative · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Task with start date only.
- **Steps:**
  1. Check Calendar and the .ics.
- **Expected result:** Calendar shows it; the .ics omits it (needs an end date) — see Findings.
- **Automation:** Manual

#### TC-WGV-034 — Dashboard Work card
- **Requirement:** FR-WGV-020
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina with Show Work in Personal on; 1 overdue, 1 due today, 3 open tasks, 45 min logged today.
- **Test data:** None
- **Steps:**
  1. Personal Dashboard.
- **Expected result:** Card shows 1, 1, 3, "45m Logged today" and up to 4 next tasks; tapping a task opens it; tapping hours opens Time. With a running timer the label is "Timer running".
- **Automation:** `v49_test` ('dashboard Work card', observation).

#### TC-WGV-035 — Dashboard card hidden
- **Requirement:** FR-WGV-020
- **Type / Priority:** Functional · P3
- **Preconditions:** Show Work in Personal off; or no add-on.
- **Test data:** None
- **Steps:**
  1. Open Dashboard.
- **Expected result:** No Work card.
- **Automation:** `v49_test` partly.

#### TC-WGV-036 — Busy-day uses Work tasks
- **Requirement:** FR-WGV-021
- **Type / Priority:** Integration · P2
- **Preconditions:** Aina with 6 Work tasks spanning tomorrow.
- **Test data:** None
- **Steps:**
  1. Open Calendar; run busy_day_stats; wait for 6 pm alert.
- **Expected result:** Tomorrow is amber/busy; the DB stats count the spanning Work task; archived-company tasks are not counted.
- **Automation:** `pg_busy_test` ('a Work task spanning the day counts') · UI `v49_test` ('work overview busy', observation).

#### TC-WGV-037 — Work data cache for 60 seconds
- **Requirement:** FR-WGV-022
- **Type / Priority:** Performance · P3
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** None
- **Steps:**
  1. Open Calendar twice within 60 s; change a task on another device; reopen after 60 s.
- **Expected result:** First reopen shows cached data; after 60 s the data reloads.
- **Automation:** Manual

#### TC-WGV-038 — Gantt on phones
- **Requirement:** FR-WGV-023, NFR-WRK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks. 15 dated tasks.
- **Test data:** 320, 360, 390 px and 1180 px.
- **Steps:**
  1. Open Gantt; scroll chart sideways; drag a bar with a finger; change zoom.
- **Expected result:** Chart scrolls inside its box with the name column (118 px) fixed; page has no sideways scroll; toolbar wraps; at 1180 px names column is wider and the chart fits.
- **Automation:** Device only (finger drag) · laptop manual.

#### TC-WGV-039 — Drag on a touch screen
- **Requirement:** NFR-WGV-001
- **Type / Priority:** Usability · P2
- **Preconditions:** Signed in as Aina with the Work add-on; project Site (six phases) with dated tasks.
- **Test data:** Phone.
- **Steps:**
  1. Drag a bar with a finger; scroll the chart with a finger on an empty area.
- **Expected result:** Bar moves with the finger and saves; empty area scrolls the chart.
- **Automation:** Device only

---

## WLM — Roles, permissions, limits, trial, expiry

#### TC-WLM-001 — Role matrix: read access
- **Requirement:** FR-WLM-001, FR-WLM-006
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Project Site with a task, comment, folder, link.
- **Steps:**
  1. As each of Aina, Bala, Chen, Dewi, Eli read projects, tasks, folders, comments, links, member list.
- **Expected result:** Aina, Bala, Chen, Dewi read everything; Eli reads nothing and member list says "Not allowed".
- **Automation:** `pg_work_test` (guest looks; outsider none), `pg_phase_test`, `pg_wfiles_test`, `pg_extras_test`.

#### TC-WLM-002 — Role matrix: write access
- **Requirement:** FR-WLM-002, FR-WLM-004
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Same project.
- **Steps:**
  1. As each person try: add task, change task, delete task, edit folder notes, comment, add link, log time.
- **Expected result:** Aina and Bala may do all; Chen, Dewi, Eli none (no effect or error); only Aina and the task creator may delete.
- **Automation:** `pg_work_test`, `pg_phase_test`, `pg_wfiles_test`, `pg_extras_test`, `pg_time_test`.

#### TC-WLM-003 — Pending invitation gives no access
- **Requirement:** FR-WLM-001
- **Type / Priority:** Security · P1
- **Preconditions:** Aina invited Dewi; Dewi has not answered.
- **Test data:** None
- **Steps:**
  1. As Dewi read tasks; list shared projects.
- **Expected result:** No tasks; invitation listed with no counts.
- **Automation:** `pg_work_test` ('a pending invitation shows nothing yet').

#### TC-WLM-004 — Member whose add-on ended is read-only
- **Requirement:** FR-WLM-007, FR-WLM-002
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Bala's add-on expires.
- **Steps:**
  1. End Bala's add-on; Bala tries to change a task; renew it; try again.
- **Expected result:** Read-only while ended (still sees project); works again after renewal.
- **Automation:** `pg_work_test`.

#### TC-WLM-005 — Owner needs the add-on to create but not to delete
- **Requirement:** FR-WLM-003
- **Type / Priority:** Security · P2
- **Preconditions:** Aina's add-on ended.
- **Test data:** None
- **Steps:**
  1. Create a project (API); delete an existing one.
- **Expected result:** Create refused; delete allowed.
- **Automation:** `pg_work_test` partial (create refused for no add-on) · delete manual.

#### TC-WLM-006 — Invite people from contacts
- **Requirement:** FR-WLM-008, FR-WLM-010
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Invite Bala as member via Edit project → Add people.
- **Steps:**
  1. Press Add people; pick Bala; confirm.
- **Expected result:** Toast "Invitations sent — 1 person added"; list shows "Invited · waiting"; Bala notified "💼 Aina added you to a project".
- **Automation:** `pg_work_test` (invite; notification points to the project).

#### TC-WLM-007 — Invite rules
- **Requirement:** FR-WLM-008
- **Type / Priority:** Negative · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Eli (not a contact); Bala tries to invite; role 'boss'.
- **Steps:**
  1. Aina invites Eli; Bala invites Dewi; Aina uses an unknown role (API).
- **Expected result:** "You can only invite people in your contacts"; "Only the project owner can invite people"; "Unknown role".
- **Automation:** `pg_work_test` (contacts only; owner only).

#### TC-WLM-008 — Invite without add-on
- **Requirement:** FR-WLM-008
- **Type / Priority:** Negative · P2
- **Preconditions:** Aina's add-on ended.
- **Test data:** None
- **Steps:**
  1. Invite Chen (API).
- **Expected result:** "The Work add-on is needed to invite people".
- **Automation:** Manual

#### TC-WLM-009 — People limit Work (8)
- **Requirement:** FR-WLM-009, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider. Project with 8 invited/accepted people (Work size).
- **Test data:** 9th contact.
- **Steps:**
  1. Invite the 8th (ok), then the 9th.
- **Expected result:** 8th accepted; 9th refused "Your plan allows up to 8 people on a project" (shown as Work add-on wording with Work Pro hint). Existing `pg_work_test` only asserts "≤ 15" and does not check 8.
- **Automation:** Manual (see Findings: `pg_work_test` check is stale).

#### TC-WLM-010 — People limit Work Pro (15)
- **Requirement:** FR-WLM-009, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina has Work Pro; 15 people.
- **Test data:** 16th.
- **Steps:**
  1. Invite the 16th.
- **Expected result:** Refused "up to 15 people"; hint about Work Pro absent.
- **Automation:** Manual

#### TC-WLM-011 — Declined people do not count and can be re-invited
- **Requirement:** FR-WLM-009, FR-WLM-013
- **Type / Priority:** Data · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider. 8 people, one declined.
- **Test data:** None
- **Steps:**
  1. Invite a new person; invite the decliner again.
- **Expected result:** The new person fits; decliner returns to pending with a new notification.
- **Automation:** Manual

#### TC-WLM-012 — Accept and decline
- **Requirement:** FR-WLM-010
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Bala accepts; Dewi declines.
- **Steps:**
  1. Open Overview as Bala; press Accept; as Dewi press Decline; press Accept again via API.
- **Expected result:** Owner gets "✅ Bala joined Site" / "❌ Dewi declined Site"; second answer: "No invitation found".
- **Automation:** `pg_work_test` (invitations).

#### TC-WLM-013 — Invitation wording by role
- **Requirement:** FR-WLM-011
- **Type / Priority:** Usability · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Invitations for Bala, Chen, Dewi.
- **Steps:**
  1. Open Overview as each.
- **Expected result:** Bala: "You can add and change tasks"; Chen: "You can look at it"; Dewi: "You can look at it (changing tasks needs the Work add-on)".
- **Automation:** Manual

#### TC-WLM-014 — Change role and remove
- **Requirement:** FR-WLM-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider. Bala assigned to two tasks.
- **Test data:** None
- **Steps:**
  1. Edit project → Make viewer on Bala; then remove Bala and confirm.
- **Expected result:** Bala becomes viewer and cannot change tasks; removal unassigns Bala (others stay), Bala no longer sees the project and loses file sharing.
- **Automation:** `pg_work_test` (viewer role; removal unassigns), `pg_wfiles_test`.

#### TC-WLM-015 — Only the owner changes roles
- **Requirement:** FR-WLM-012
- **Type / Priority:** Security · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** None
- **Steps:**
  1. As Bala call work_set_role and remove Chen.
- **Expected result:** "Only the project owner can change roles"; "Not allowed".
- **Automation:** Manual

#### TC-WLM-016 — A person can leave
- **Requirement:** FR-WLM-012
- **Type / Priority:** Functional · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Bala calls work_remove_member on himself (no UI button).
- **Steps:**
  1. Call it through the API.
- **Expected result:** Bala is removed; tasks unassigned.
- **Automation:** Manual (no UI; see Findings).

#### TC-WLM-017 — Pending people visible only to owner
- **Requirement:** FR-WLM-014
- **Type / Priority:** Security · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider. Chen pending.
- **Test data:** None
- **Steps:**
  1. As Bala list the people.
- **Expected result:** Pending person not shown to Bala; shown to Aina as "Invited · waiting".
- **Automation:** `pg_work_test` (member list).

#### TC-WLM-018 — Guest experience
- **Requirement:** FR-WLM-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Dewi has accepted Site.
- **Test data:** None
- **Steps:**
  1. Open Work.
- **Expected result:** Tabs Projects and Tasks; note "You are viewing projects other people shared with you" with Get Work; cards "view only"; menu only Work; opening a task is read-only.
- **Automation:** `v49_test` (guest sees, menu, extras: observation).

#### TC-WLM-019 — Guest becomes owner of nothing
- **Requirement:** FR-WLM-005, FR-WLM-026
- **Type / Priority:** Security · P2
- **Preconditions:** Dewi has no accepted project and no add-on.
- **Test data:** None
- **Steps:**
  1. Press Work in the mode switch.
- **Expected result:** Mode is locked; the Work add-on popup opens.
- **Automation:** Manual

#### TC-WLM-020 — Limit numbers by size
- **Requirement:** FR-WLM-015
- **Type / Priority:** Data · P1
- **Preconditions:** Work and Work Pro users.
- **Test data:** None
- **Steps:**
  1. Query limit_of for companies, projects, people, tasks, teams for both.
- **Expected result:** Work 5/20/8/600/5; Work Pro 20/60/15/1500/20; both independent of plan (test on Dawn and Zenith); no add-on → Work numbers.
- **Automation:** `pg_wreminder_test` ('Work: 5 / 20 / 8 / 600, even on Dawn', 'Work Pro: 20 / 60 / 15 / 1500'; teams 5 in `pg_team_test`).

#### TC-WLM-021 — Project limit boundary Work (20) and Pro (60)
- **Requirement:** FR-WLM-016, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** 20 projects (Work); 60 (Pro).
- **Steps:**
  1. Create the 21st (Work); upgrade to Pro, create up to 60 and the 61st.
- **Expected result:** 21st: "Your plan allows up to 20 projects"; Pro lifts it; 61st refused.
- **Automation:** `pg_wreminder_test` ('21st project refused') · Pro 61st manual.

#### TC-WLM-022 — Task limit boundary Work (600) and Pro (1500)
- **Requirement:** FR-WLM-016, FR-WLM-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider. Project with 600 tasks (SQL load).
- **Test data:** 601st; member adds it.
- **Steps:**
  1. Aina adds the 601st; Bala adds it; set Pro and add the 601st; repeat at 1500.
- **Expected result:** Refused "Your plan allows up to 600 tasks in a project" for both (limit by owner's size); Pro accepts to 1500, 1501st refused.
- **Automation:** Manual (not in a suite).

#### TC-WLM-023 — Limit is the owner's, not the member's
- **Requirement:** FR-WLM-016
- **Type / Priority:** Data · P2
- **Preconditions:** Aina Work (600), Bala Work Pro.
- **Test data:** None
- **Steps:**
  1. Bala adds tasks to Aina's full project.
- **Expected result:** Refused as 600.
- **Automation:** Manual

#### TC-WLM-024 — Limit message wording
- **Requirement:** FR-WLM-017
- **Type / Priority:** Usability · P2
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Reach the project limit on Work and on Work Pro.
- **Steps:**
  1. Read the message in the project window.
- **Expected result:** "Your Work add-on allows up to 20 projects. Work Pro allows more: see Settings → your plan → Add-ons."; Work Pro: "Your Work Pro add-on allows up to 60 projects."
- **Automation:** Manual

#### TC-WLM-025 — Downgrade keeps data
- **Requirement:** FR-WLM-018
- **Type / Priority:** Data · P1
- **Preconditions:** Aina Work Pro with 8 companies, 30 projects.
- **Test data:** None
- **Steps:**
  1. Admin sets Work size (or add-on ends and returns as Work).
- **Expected result:** Nothing deleted; adding more projects / companies is refused; ended Pro falls back to Work numbers.
- **Automation:** `pg_wreminder_test` ('an ended Work Pro falls back to the Work numbers') · deletion check manual.

#### TC-WLM-026 — Admin edits limits
- **Requirement:** FR-WLM-019
- **Type / Priority:** Security · P2
- **Preconditions:** Admin and a normal user.
- **Test data:** None
- **Steps:**
  1. Admin Plan limits: set work_tasks for Work to 123, null, -1, and a bad key; normal user tries.
- **Expected result:** 123 and null (unlimited) saved; -1 and unknown key refused; normal user refused.
- **Automation:** `pg_busy_test` (admin limits editor). Note: null becomes 1,500 in the guards (Findings).

#### TC-WLM-027 — Add-on popup and prices
- **Requirement:** FR-WLM-020, FR-WLM-022
- **Type / Priority:** Usability · P2
- **Preconditions:** Person without the add-on.
- **Test data:** None
- **Steps:**
  1. Press Work in the mode switch.
- **Expected result:** Popup shows perks, two sizes (Work RM15 / month, Work Pro RM25 / month with limits), "It works on every plan", Start 7-day free trial, Get Work, Get Work Pro, Get both RM19 / month.
- **Automation:** Manual

#### TC-WLM-028 — Start free trial
- **Requirement:** FR-WLM-021
- **Type / Priority:** Functional · P1
- **Preconditions:** Person without the add-on who never had a trial.
- **Test data:** None
- **Steps:**
  1. Press Start 7-day free trial.
- **Expected result:** Work mode opens; toast "Work trial started — Free for 7 days"; header "· free trial until <date>"; size Work; notification "Your Work trial has started".
- **Automation:** Manual (migration 044 not in a suite).

#### TC-WLM-029 — Trial only once
- **Requirement:** FR-WLM-021
- **Type / Priority:** Negative · P1
- **Preconditions:** Person whose trial ended.
- **Test data:** None
- **Steps:**
  1. Open the Work popup; call start_addon_trial.
- **Expected result:** No trial button; API "The free trial was already used"; with active add-on "You already have this add-on".
- **Automation:** Manual

#### TC-WLM-030 — Ask by WhatsApp, upgrade and renew
- **Requirement:** FR-WLM-022
- **Type / Priority:** Functional · P2
- **Preconditions:** With and without WhatsApp number configured.
- **Test data:** None
- **Steps:**
  1. Press Get Work Pro; Upgrade to Work Pro (as Work); Renew Work.
- **Expected result:** WhatsApp opens with name, email, plan, add-on and price (note on upgrade); without number: alert "The WhatsApp number for requests isn't set up yet."
- **Automation:** Device only (WhatsApp)

#### TC-WLM-031 — Admin grants a size
- **Requirement:** FR-WLM-023
- **Type / Priority:** Functional · P1
- **Preconditions:** Admin; user Bala.
- **Test data:** None
- **Steps:**
  1. Admin → Give Work to Bala: Work Pro, 1 month; later extend keeping size; set Work; try size 'huge'; try Study with size.
- **Expected result:** Pro given and shown in the list; extend keeps Pro; can be set back; 'huge' refused; Study stays standard; Bala notified "🎉 Work Pro mode is on".
- **Automation:** `pg_busy_test` (admin gives Work Pro, list shows size, renew keeps, set back, unknown refused, Study no sizes).

#### TC-WLM-032 — Non-admin cannot grant
- **Requirement:** FR-WLM-023
- **Type / Priority:** Security · P1
- **Preconditions:** Bala not admin.
- **Test data:** None
- **Steps:**
  1. Call admin_set_addon for himself.
- **Expected result:** "Not allowed".
- **Automation:** `pg_busy_test` (non-admin cannot change limits) · grant manual.

#### TC-WLM-033 — Add-on end date in the header
- **Requirement:** FR-WLM-024
- **Type / Priority:** Usability · P3
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider.
- **Test data:** Add-on ends in 5 days; in 20 days.
- **Steps:**
  1. Open Work.
- **Expected result:** "· add-on until 14 Oct 2026 (5 days left)"; the 20-day case shows the date only; a trial says "free trial until".
- **Automation:** Manual

#### TC-WLM-034 — Expiry behaviour
- **Requirement:** FR-WLM-025
- **Type / Priority:** Integration · P1
- **Preconditions:** Aina (owner) and Bala (member) have the Work add-on; Chen is a viewer with the add-on; Dewi is a guest (no add-on); Eli is an outsider. Aina in Work mode, add-on ends now (admin).
- **Test data:** None
- **Steps:**
  1. Keep the app open; return after 2+ minutes; then reload.
- **Expected result:** Database refuses changes at once; after return the app leaves Work to the Dashboard; Work locked; tabs Overview/Teams/Time hidden if she is a guest; notice "Your Work add-on has ended".
- **Automation:** Manual (expiry notice from migration 062).

#### TC-WLM-035 — Guest stays after expiry of the owner's add-on
- **Requirement:** FR-WLM-025, FR-WLM-005
- **Type / Priority:** Integration · P2
- **Preconditions:** Bala (member) loses the add-on but is on Aina's project.
- **Test data:** None
- **Steps:**
  1. Reload as Bala.
- **Expected result:** Bala stays in Work as guest (read-only).
- **Automation:** `pg_work_test` (read-only after expiry) · UI manual.

#### TC-WLM-036 — Admin Work figures
- **Requirement:** FR-WLM-027
- **Type / Priority:** Security · P3
- **Preconditions:** Admin and normal user.
- **Test data:** None
- **Steps:**
  1. Call admin_work_stats.
- **Expected result:** Admin gets figures incl. 12 months; normal user "Not allowed".
- **Automation:** `pg_extras_test` (only admins; admin gets figures).

#### TC-WLM-037 — Row-level security and grants
- **Requirement:** NFR-WLM-001, NFR-WLM-002
- **Type / Priority:** Security · P1
- **Preconditions:** anon and authenticated.
- **Test data:** None
- **Steps:**
  1. As anon select work tables; call Work functions; as authenticated bypass app and write teams / links / history tables directly.
- **Expected result:** Anon has no access; direct writes to links, teams, history, files are refused; functions granted to authenticated only.
- **Automation:** `pg_work_test`, `pg_team_test`, `pg_move_test`, `pg_extras_test` (several direct-access checks) · anon check manual.

#### TC-WLM-038 — Plan cannot be fetched
- **Requirement:** NFR-WLM-003
- **Type / Priority:** Negative · P3
- **Preconditions:** Network blocked for my_limits.
- **Test data:** None
- **Steps:**
  1. Open Work → Company.
- **Expected result:** App uses strictest plan values; company count shows "of 5 used".
- **Automation:** Manual

#### TC-WLM-039 — Add-on popup on phones
- **Requirement:** FR-WLM-020, NFR-WRK-002
- **Type / Priority:** Responsive · P2
- **Preconditions:** Person without add-on.
- **Test data:** 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open the Work add-on popup.
- **Expected result:** Sizes stack; buttons fit and are tappable; popup scrolls.
- **Automation:** Device only (phone) · laptop manual.

---

## WNT — Notifications, reminders, Lumi, budgets

#### TC-WNT-001 — Notification kinds and icons
- **Requirement:** FR-WNT-001
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** One of each type.
- **Steps:**
  1. Trigger invite, answer, task, comment, mention, budget, team, reminder; open Notifications.
- **Expected result:** Each appears with an orange icon (briefcase, list, comment, @, stopwatch, people).
- **Automation:** Manual

#### TC-WNT-002 — Task given notification
- **Requirement:** FR-WNT-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Task for Dewi and Bala by Aina.
- **Steps:**
  1. Aina creates the task; later adds Chen; later changes the title only.
- **Expected result:** First save notifies Dewi and Bala ("📌 Aina gave you a task"); adding Chen notifies only Chen; title change nothing; Aina's own assignment gives no notice.
- **Automation:** `pg_work_test` (guest told; not yourself; only the new one).

#### TC-WNT-003 — Task notification opens the task list
- **Requirement:** FR-WNT-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** None
- **Steps:**
  1. Tap the task notification in the bell and in a push.
- **Expected result:** Work opens on Tasks for that project (Dewi: read-only).
- **Automation:** Device only (push) · bell manual.

#### TC-WNT-004 — Comment, mention, budget notifications open the task
- **Requirement:** FR-WNT-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** None
- **Steps:**
  1. Tap each notification.
- **Expected result:** The task window opens.
- **Automation:** Manual

#### TC-WNT-005 — Show Work in Personal
- **Requirement:** FR-WNT-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Work events and a Work reminder exist.
- **Steps:**
  1. Settings → Preferences: look for the switch as Aina and as a person without the add-on; switch on; open Personal Dashboard and Calendar; switch off.
- **Expected result:** Switch only for add-on holders (default off); on: Work items and card appear in Personal; off: they vanish.
- **Automation:** `v49_test` (observation) · manual.

#### TC-WNT-006 — Items are filed under the mode
- **Requirement:** FR-WNT-005
- **Type / Priority:** Data · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Create a reminder and a note in Work mode.
- **Steps:**
  1. Switch to Personal with the preference off.
- **Expected result:** Not shown in Personal; Work tables (projects, tasks) themselves are not filtered by space.
- **Automation:** Manual (spaces suite not in this set).

#### TC-WNT-007 — Reminder day before, day of and overdue
- **Requirement:** FR-WNT-006, FR-WNT-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Bala assigned to tasks due tomorrow, today, 2 days ago; reminder hour = current hour.
- **Steps:**
  1. Run luma.run_work_reminders().
- **Expected result:** Three notifications: "due tomorrow"/"due in 1 day", "is due today", "is overdue by 2 days", all linking to Work and the task.
- **Automation:** `pg_wreminder_test`.

#### TC-WNT-008 — Overdue nudges stop after 7 days
- **Requirement:** FR-WNT-007
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Tasks overdue by 7 and by 8 days.
- **Steps:**
  1. Run the job at the chosen hour.
- **Expected result:** 7 days: nudge; 8 days: none.
- **Automation:** Manual (the 8-day case is excluded by the query window; not in a suite).

#### TC-WNT-009 — First reminder N days before
- **Requirement:** FR-WNT-006
- **Type / Priority:** Boundary · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** work_days = 3 and 14; task due in 3 / 14 / 15 days.
- **Steps:**
  1. Run at the chosen hour.
- **Expected result:** "due in 3 days" is sent; 14 works; 15 is not within the window.
- **Automation:** Manual

#### TC-WNT-010 — No reminder cases
- **Requirement:** FR-WNT-008
- **Type / Priority:** Negative · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Done task, no assignee, due +10 with days=1, archived company, guest assignee, switch off.
- **Steps:**
  1. Run the job after each condition.
- **Expected result:** No reminder for any of them.
- **Automation:** `pg_wreminder_test` (done, unassigned, far-away, guest, switch off, archived company).

#### TC-WNT-011 — No duplicates and only at the chosen hour
- **Requirement:** FR-WNT-008
- **Type / Priority:** Data · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Run twice in the hour; then hour set 5 hours away.
- **Steps:**
  1. Run job twice; change hour; run.
- **Expected result:** Second run adds nothing; wrong hour sends nothing.
- **Automation:** `pg_wreminder_test`.

#### TC-WNT-012 — Reminder uses the person's time zone
- **Requirement:** FR-WNT-006
- **Type / Priority:** Data · P2
- **Preconditions:** Bala in a time zone 8 hours from UTC; hour 9.
- **Test data:** None
- **Steps:**
  1. Run job at 01:00 UTC.
- **Expected result:** Bala is reminded at 09:00 local, not 09:00 UTC.
- **Automation:** Manual

#### TC-WNT-013 — Reminder job schedule
- **Requirement:** FR-WNT-009
- **Type / Priority:** Functional · P2
- **Preconditions:** Staging database.
- **Test data:** None
- **Steps:**
  1. Select from cron.job where jobname = 'luma-work-reminders'.
- **Expected result:** One job at '0 * * * *' running luma.run_work_reminders().
- **Automation:** Manual (pg_cron not in the PGlite suites).

#### TC-WNT-014 — Settings → Reminders → Work card
- **Requirement:** FR-WNT-010
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina on Glow and on Dawn; Dewi (no add-on).
- **Test data:** None
- **Steps:**
  1. Open Settings → Reminders.
- **Expected result:** Aina sees Work card with switch, First reminder, Send at; on Dawn the times are locked with the standard note; Dewi sees no Work card; switching off stops reminders.
- **Automation:** Manual

#### TC-WNT-015 — Time budget field
- **Requirement:** FR-WNT-011
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Budgets 0.5, 1000, 1001, -1, 0.
- **Steps:**
  1. Enter each in the Time budget box and Save.
- **Expected result:** 0.5 h (30 min) and 1000 h accepted; 1001 above the max of the box / refused (budget ≤ 60000 min); negative not accepted; 0 or empty means no budget.
- **Automation:** `pg_extras_test` (budget must be at least a minute).

#### TC-WNT-016 — Budget display on card and window
- **Requirement:** FR-WNT-011
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Budget 8 h; 3 h logged; then 9 h logged.
- **Steps:**
  1. Look at card and window.
- **Expected result:** Card "3h / 8h"; window bar and "3h logged of 8h"; at 9 h card red and "over by 1h".
- **Automation:** `v49_test` ('budget bar', observation).

#### TC-WNT-017 — Budget notification once
- **Requirement:** FR-WNT-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Budget 2 h; Bala (assignee) logs 130 min; then 30 min more.
- **Steps:**
  1. Bala logs; then logs again.
- **Expected result:** Aina (owner) and the task creator get "⏱ … is over its time budget" ("2.2 h logged of 2.0 h"); Bala (logger) none; second log: no new notice.
- **Automation:** `pg_extras_test` (crossing tells owner not logger; once).

#### TC-WNT-018 — Budget: viewers and outsiders
- **Requirement:** FR-WNT-012
- **Type / Priority:** Security · P3
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Chen not assigned.
- **Steps:**
  1. Cross the budget.
- **Expected result:** Chen gets none (not assignee/owner/creator); Eli none.
- **Automation:** `pg_extras_test` totals visibility.

#### TC-WNT-019 — Lumi: create project
- **Requirement:** FR-WNT-013
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** "Add a general project called Memo approvals for Acme, deadline 2026-12-31".
- **Steps:**
  1. In Work mode ask Lumi.
- **Expected result:** Project created in the first active company, kind general, deadline set.
- **Automation:** Manual (`lumi_tools_test` has no Work tool).

#### TC-WNT-020 — Lumi: add tasks
- **Requirement:** FR-WNT-014
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest. Projects "Website redesign" and "Brand".
- **Test data:** "Add 3 tasks to the website project: wireframes (Design, 4h), copy, launch".
- **Steps:**
  1. Ask Lumi.
- **Expected result:** 3 tasks in Website redesign; wireframes in Design phase with budget 240 min; without a project name and two projects Lumi asks "Which project? …".
- **Automation:** Manual

#### TC-WNT-021 — Lumi: 20 task limit and archived or on-hold projects
- **Requirement:** FR-WNT-014
- **Type / Priority:** Boundary · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** 25 tasks in one request; project On hold.
- **Steps:**
  1. Ask Lumi to add 25 tasks; then to add a task to the on-hold project.
- **Expected result:** only the first 20 are added (`list()` keeps 20); on-hold project: "I couldn't find a project called …" (only active ones are found).
- **Automation:** Manual

#### TC-WNT-022 — Lumi: update task
- **Requirement:** FR-WNT-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Tasks "Wireframes" and "Wireframes v2".
- **Steps:**
  1. "Mark wireframes as done".
- **Expected result:** Several match: Lumi is told "Several tasks match … Ask which one." (exact title wins when unique); unknown title: "I couldn't find a Work task called …".
- **Automation:** Manual

#### TC-WNT-023 — Lumi: move task and project
- **Requirement:** FR-WNT-016
- **Type / Priority:** Integration · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest. Projects A and B, companies Acme and Beta.
- **Test data:** None
- **Steps:**
  1. "Move Quote to project B"; "Move project B to Beta"; "Move Quote to project A" when already there.
- **Expected result:** Moves done with comments, files and time; already-in message "… is already in A."; archived company not found.
- **Automation:** Manual (uses work_move_task / work_move_project covered by `pg_move_test`).

#### TC-WNT-024 — Lumi: log time
- **Requirement:** FR-WNT-017
- **Type / Priority:** Boundary · P1
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** "I worked 2 hours on the quotation"; 0 minutes; 25 hours; "1 hour client call".
- **Steps:**
  1. Ask each.
- **Expected result:** 2 h logged to the task; 0 and 25 h: "Say how long: between 1 minute and 24 hours."; client call logged as general time named "client call".
- **Automation:** Manual

#### TC-WNT-025 — Lumi: day cap and archived company
- **Requirement:** FR-WNT-018, FR-WTM-005
- **Type / Priority:** Negative · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** 23 h already logged; then archived company.
- **Steps:**
  1. Ask Lumi to log 2 hours; archive and ask again.
- **Expected result:** Lumi relays the database message ("A day can not have more than 24 hours logged" / archived).
- **Automation:** Manual

#### TC-WNT-026 — Lumi: timer
- **Requirement:** FR-WNT-017
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** None
- **Steps:**
  1. "Start the timer on the quotation"; "stop the timer"; "stop the timer" again.
- **Expected result:** Timer starts and stops (Time tab agrees); second stop: "No timer is running."
- **Automation:** Manual

#### TC-WNT-027 — Lumi without add-on
- **Requirement:** FR-WNT-018
- **Type / Priority:** Security · P1
- **Preconditions:** Dewi (guest) asks Lumi to add a task and a project.
- **Test data:** None
- **Steps:**
  1. Ask in Work mode.
- **Expected result:** "Work isn't switched on for this account." or a role error; nothing created; viewer: refused.
- **Automation:** Manual (`lumi_tools_test` does not exercise Work tools).

#### TC-WNT-028 — Lumi limits and raw messages
- **Requirement:** FR-WNT-018, FR-WLM-016
- **Type / Priority:** Negative · P3
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Project with 600 tasks.
- **Steps:**
  1. Ask Lumi to add a task.
- **Expected result:** Database message returned: "Your plan allows up to 600 tasks in a project" (says "plan" although the add-on decides — Findings).
- **Automation:** Manual

#### TC-WNT-029 — Lumi overview and mode hints
- **Requirement:** FR-WNT-019
- **Type / Priority:** Functional · P3
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** Projects, open tasks, 5 h logged.
- **Steps:**
  1. Ask "how many hours this month?" and "add a task" in Work mode.
- **Expected result:** Lumi answers from the Work section; "add a task" creates a Work task.
- **Automation:** Manual

#### TC-WNT-030 — Work notifications on phones
- **Requirement:** FR-WNT-003, NFR-WRK-002
- **Type / Priority:** Responsive · P3
- **Preconditions:** Aina (owner), Bala (member) have the Work add-on; Dewi is a guest.
- **Test data:** 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open the bell and the toast for a work_task notification.
- **Expected result:** Text wraps; toast fits; tapping opens the task window within the screen.
- **Automation:** Device only (phone) · laptop manual.

---

#### TC-WCO-032 — Archive and restore take effect at once, also for other members
- **Requirement:** NFR-WCO-001
- **Type / Priority:** Integration · P2
- **Preconditions:** Work Wendy (owner) and Work Wanda (member) are both on a project of company "Acme"; each has the app open in its own browser.
- **Steps:**
  1. As Wendy open Work → Company and archive "Acme".
  2. Immediately, as Wanda (without reloading), try to change a task title and save.
  3. As Wendy restore "Acme".
  4. As Wanda save the task change again.
- **Expected result:** Step 2 is refused (the company is archived; the database blocks the write). Step 4 succeeds. Nothing is served from an old frozen or unfrozen state.
- **Automation:** `pg_company_test` (archive blocks edits, restore allows them) · the two-browser flow is manual.

#### TC-WTM-043 — The 24-hour day and one-timer rules cannot be bypassed from outside the form
- **Requirement:** NFR-WTM-001
- **Type / Priority:** Security · P1
- **Preconditions:** Work Wendy signed in; a second browser tab; access to the browser developer tools or an API client with Wendy's own token.
- **Steps:**
  1. Log 23 hours on today's date through the form.
  2. Using the API client, insert a time entry of 120 minutes for the same date straight into `work_time_entries`.
  3. Start a timer in the app, then call the `work_timer_start` function a second time with a different task.
- **Expected result:** Step 2 is refused (a day cannot exceed 24 hours). Step 3 does not create a second running timer: either the first timer is stopped and replaced, or the call is refused, but there is never more than one running timer for the person.
- **Automation:** `pg_time_test` (24 h cap, one running timer).

#### TC-WTM-044 — Stopping a timer and deleting things never gets stuck
- **Requirement:** NFR-WTM-002
- **Type / Priority:** Integration · P2
- **Preconditions:** Wendy has a running timer on a task of an archived company, and time entries that point to a project and a task.
- **Steps:**
  1. Stop the timer.
  2. Delete the task the entries point to.
  3. Delete the project, then (after archiving) the company.
- **Expected result:** Each step succeeds. Entries keep their saved project and task names (snapshots). No error such as "company is archived" blocks stopping the timer or deleting.
- **Automation:** `pg_time_test` (stop on an archived company; deleting a project) · otherwise manual.

#### TC-WCM-031 — File limits on a task are the Documents limits
- **Requirement:** NFR-WCM-002
- **Type / Priority:** Boundary · P2
- **Preconditions:** Dawn person with the Work add-on (single file limit 5 MB, total storage 50 MB); a task open.
- **Test data:** a 4.9 MB PDF and a 5.1 MB PDF; 21 small files.
- **Steps:**
  1. Attach the 4.9 MB PDF to the task.
  2. Attach the 5.1 MB PDF.
  3. Attach small files until the task has 20, then add a 21st.
- **Expected result:** Step 1 succeeds; step 2 is refused with the plan's file-size message; the 21st file is refused (20 files per task). Work adds no size limit of its own.
- **Automation:** `pg_wfiles_test` (file limits per task) · size limits: manual.

#### TC-WNT-031 — Reminders follow the person's own time zone
- **Requirement:** NFR-WNT-001
- **Type / Priority:** Integration · P2
- **Preconditions:** Two people on one project, each assigned a task due tomorrow; one has the time zone Asia/Kuala_Lumpur, the other Asia/Tokyo; both have Work reminders on with the hour set to 9 am.
- **Steps:**
  1. Wait for 9 am Kuala Lumpur time (or lower the lead and hour to a time a few minutes ahead).
  2. Check each person's bell, then again an hour later (9 am Tokyo is one hour earlier).
- **Expected result:** Each person gets "is due tomorrow" within their own 9 o'clock hour, once, never twice for the same task and wording within 12 hours.
- **Automation:** `pg_wreminder_test` (reminder hour, wording, no duplicates) · time zone differences: manual.

#### TC-WNT-032 — The same event gives the same wording through every route
- **Requirement:** NFR-WNT-002
- **Type / Priority:** Consistency · P3
- **Preconditions:** Work Wendy and Work Wanda on a project.
- **Steps:**
  1. Give Wanda a task from the task window; note her notification text.
  2. Give Wanda another task through Lumi ("add a task … for Wanda").
  3. Change a task's assignee list through the Move / edit flow.
- **Expected result:** In every case Wanda sees a notification of the form "<name> gave you a task" with the task and project name; the text is created by the database, so it does not differ between routes.
- **Automation:** `pg_work_test` (task notification) · Lumi route: manual.

## Findings

Found while reading the code and the automated suites (file references are in the repository).

1. **"Unlimited" becomes the Pro number.** Admin → Plan limits allows a limit of `null` (unlimited; tested in `pg_busy_test`), but the guards use `coalesce(luma.limit_of(...), 20 / 60 / 15 / 1500)` (migrations 077, 078, 083, 084). A null Work limit therefore falls back to the Work Pro value, not to "no limit". The app side (`wkCoLimit` in `work.company.js`) falls back to 5 when the limit is unknown, which differs again.
2. **Stale / weak automated checks.** `pg_work_test` "a project holds at most 15 people" is asserted as `<= 15` while its owner has the Work (standard) size, whose limit is 8 (since migration 083); the real 8 / 9 boundary is not tested. Several checks are always true: `pg_time_test` "(a company of someone else is refused)", `pg_move_test` "a member can only move…" (`true`). Task (600 / 1,500), team (20), people (8 / 15), 50-people-per-team, 10-links, 20-files, 40-folders and 500-comments boundaries have no automated test.
3. **`v49_test` and `lumi_tools_test` do not assert.** `ui/v49_test.js` prints observations and never fails; `edge/lumi_tools_test.js` does not call any Work tool (`create_work_project`, `add_work_tasks`, `update_work_task`, `move_work_task`, `move_work_project`, `log_work_time`, `work_timer` are untested). All Lumi Work cases here are manual.
4. **Deleting a company silently deletes time entries.** `work_time_entries.company_id` is `on delete cascade` (migration 076), so the person's logged time under that company (including general time) disappears, but the confirmation in `work.company.js` only mentions projects, tasks and notes.
5. **Undo after deleting a task is incomplete.** `luUndo` in `work.js` re-creates the task without `budget_minutes`, `team_id`, links, comments and files (they were deleted with the task; time entries keep only the title text).
6. **Gantt cascade is not atomic.** `wkDragEnd` saves the dragged task and then each linked task in separate requests; a failure leaves part of the chain moved (the failed task is rolled back only on screen). The database does not enforce "waits for" order, and two devices can overwrite each other.
7. **@mention matching over-tags.** `wkMentionsOf` tags anyone whose name appears after "@" as a substring, so "@Anna Tan" also tags a person called "Ann".
8. **Start-date-only tasks.** The Calendar shows a task that has only a start date, but the Calendar file export, the Overview "Due soon" list, due labels and reminders ignore it (they need `due_date`).
9. **Project status "Archived" does not freeze anything.** Only an archived *company* is read-only; an "Archived" project can still be edited, and is only hidden from "active" counts, deadline flags, the calendar file and Lumi's lookup.
10. **Timesheet file name has no year.** "<NAME> <MONTHNAME> TIMESHEET" is the same for October 2025 and October 2026. The default work date and the company end date use Malaysia time (`Asia/Kuala_Lumpur`) for everyone, while the busy-day and reminder jobs use each person's own time zone.
11. **Wording still says "plan".** Database limit messages ("Your plan allows up to N projects / tasks / people / teams") are rewritten to "Your Work add-on allows…" only in the app (`wkHint`); Lumi and other API clients show the raw "plan" text although the add-on decides.
12. **Moving a task silently drops links, phase / folder and (for another owner) the team.** The confirmation text only mentions comments, files, time and people not on the new project.
13. **No "Leave project" button.** The database lets a person remove themselves (`work_remove_member`), but the UI offers removal only to the owner.
14. **Busy-day count differs between app and database.** The app counts tasks of the company in view (and shared projects); `busy_day_stats` counts every task of the owner's non-archived companies plus tasks assigned to the person, whether or not they are assigned for owned projects.
15. **"Due this week" tile covers 8 days** (today to today + 7).
16. **Old header comments are outdated.** Migrations 071, 074 and 077 still describe 60 projects / 15 people / 1,500 tasks or per-plan limits; migration 083 replaced them. `CHANGELOG.md` 0.19.0 still says the trial is staging-only, but 0.25.4 and `modes.js` (`live: true`) turn it on in production.
