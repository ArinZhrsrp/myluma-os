# SRS — Work mode

Version of the product described: LUMA 0.26.4 (staging), database migrations 071 – 085, Edge Function `lumi`.
Sources: `app/modules/work/` (work.js, work.data.js, work.html, work.css, work.company.js, work.time.js, work.views.js, work.teams.js), `app/core/modes.js`, `app/core/plans.js`, `shared/luma-plan.js`, `app/core/busy.js`, `app/core/ics.js`, `supabase/migrations/071 – 085`, `supabase/functions/lumi/index.ts`, `CHANGELOG.md` (0.14 → 0.26.4).

## 1. Scope

**Work mode** is the paid **Work add-on** of LUMA (RM15 / month; **Work Pro** RM25 / month). It is a second "space" next to Personal and Study. In it a person keeps **companies** (employers or clients), **projects** under a company (with six phases or their own folders), **tasks** (board, list, phases, Gantt chart, timeline), **teams** of people, **comments, files and @mentions** on tasks, **time tracking** with a monthly timesheet, **reminders and notifications**, and Lumi (the AI assistant) tools for Work.

In scope: everything listed in the area codes below. Out of scope (documented elsewhere): the Personal and Study modes, the general notification centre, Documents, Contacts, the admin console (only the Work-related actions are covered here), payments (the add-on is arranged by WhatsApp and granted by an administrator).

Facts about how Work is sold, from the code:

- The **add-on**, not the plan (Dawn / Glow / Zenith), sets the Work limits (migration 083). The plan only matters for Settings choices such as "Send at" times (Glow / Zenith).
- A **one-time 7-day free trial** can be started by the person (`start_addon_trial`, migration 044); an administrator can also grant the add-on (with size Work or Work Pro, for a number of months or until a date).
- Someone **without the add-on** who was added to somebody's project is a **guest**: they can open Work (Projects and Tasks tabs only) and **look**, but not change anything.

## 2. Area codes

| Code | Area | Section |
|---|---|---|
| WRK | Projects, tasks, phases, folders and notes, board / list / phases views, assignees, checklists, task window, search | 4 |
| WCO | Companies: first-run set-up, Company page, archive freezes data, start / end date, position, limits | 5 |
| WTM | Time tracking: timer, manual entries, general time with a name, 24 h / day cap, timesheet CSV / PDF, team time | 6 |
| WTE | Teams: create / edit / delete, give a task to a team, add a whole team to a project, notifications, visibility | 7 |
| WCM | Comments, edit history, @mentions, files on tasks, document sharing | 8 |
| WGV | Gantt chart, timeline, drag to move / resize, task links ("waits for") with cascade, calendar spans, ICS export, deadlines on Calendar / Dashboard | 9 |
| WLM | Roles and permissions, plan / add-on limits, free trial, expiry behaviour, admin granting a size | 10 |
| WNT | Notifications and reminders for Work, Lumi's Work tools, time budgets | 11 |

## 3. Terms

| Term | Meaning |
|---|---|
| Owner | The person who created the project (`work_projects.owner_id`). |
| Member | Accepted person with role `member`. Can add and change tasks **only while they have the Work add-on themselves**. |
| Viewer | Accepted person with role `viewer`. Can only look (reads tasks, comments, files, times totals). |
| Guest | A person **without the Work add-on** who was added to a project (any role). Read-only. |
| Outsider | A signed-in person who is not on the project. Cannot read it. |
| Editor | Owner or member **with the Work add-on**, in a project whose company is **not archived** (`luma.work_can_edit`, `wkCanEdit`). |
| Work / Work Pro | The two sizes of the add-on (`luma.user_addons.tier` = `standard` / `pro`). |
| Phase | One of six fixed sections of a project of kind `project`. Folder: a section of a project of kind `general`. |
| Space | The mode an item was created in (`space` column, migration 050). |

Numbers used throughout (migration 083, `plan_limits`, `WORK_SIZES` in `app/core/modes.js`):

| Limit | Work | Work Pro |
|---|---|---|
| Companies (active + archived) | 5 | 20 |
| Projects per owner | 20 | 60 |
| People on a project (not counting the owner, not counting declined) | 8 | 15 |
| Tasks in a project | 600 | 1,500 |
| Teams (all companies together) | 5 | 20 |

Fixed limits (all sizes): 10 assignees per task, 10 "waits for" links per task, 30 checklist steps (120 characters each), 40 folders per project, 20 files per task, 500 comments per task, 50 edits per comment, 10 @mentions kept per comment, 50 people per team, 20,000 time entries per person, 24 hours per day of logged time, a forgotten timer counts at most 12 hours.

## 4. WRK — Projects, tasks, phases, folders, views

### 4.1 Work page and navigation

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WRK-001 | The system shall show the Work page with the tabs **Overview**, **Projects**, **Tasks**, **Teams** and **Time** to a person with the Work add-on, and only **Projects** and **Tasks** to a person without it. | Must | work.js (WK_TABS, MODULES.work) |
| FR-WRK-002 | The system shall offer the Work mode in the mode switch at the top of the menu; in Work mode the menu shows Work, Company, Calendar, Reminders, Documents, Contacts and Lumi (plus Settings, Support, Feedback, Notifications and, for admins, Admin). A guest sees only the Work item. | Must | modes.js (MODE_MENUS, MODE_ALWAYS, applyModeMenus) |
| FR-WRK-003 | The system shall load projects, tasks, shared projects, people, folders, companies, links, time totals and teams together, give up on each request after 20 seconds, and then show "Could not load", the message (for example "Timed out while loading projects. Check your connection and try again.") and a **Try again** button. | Must | work.js (wkLoad, wkPaint) |
| FR-WRK-004 | The system shall show the **Overview** with four tiles (Active projects, Open tasks, Due this week = due from today up to 7 days ahead, Overdue), the lists "Assigned to me" (at most 8), "Due soon" (at most 8, nearest due date first) and "Project progress" (done / total per active project), and, when there are no projects, the empty state "Start your first project". | Must | work.js (wkOverview) |
| FR-WRK-005 | The system shall show only the projects of the company in view plus every project other people shared with the person; the company in view is remembered in the browser. | Must | work.js (wkLoad, wkPickCompany) |
| FR-WRK-006 | The system shall show these empty-state texts: "No projects yet" (Projects), "No tasks yet / Create a project first, then add its tasks here." (Tasks with no project), "No tasks match." (list), "Nothing here" (board column), "Nothing is assigned to you.", "Nothing has a due date yet.", "No active projects.", "Nothing has been shared with you yet." (guest). | Should | work.js |
| FR-WRK-007 | The system shall lay out the board as 4 columns, 2 columns up to 1100 px wide and 1 column up to 640 px; the tabs shrink on phones (≤480 px: no extra padding; ≤400 px: icons hidden) and no page shall need sideways scrolling at 320, 360 or 390 px (the Gantt chart scrolls inside its own box). | Must | work.css (media queries) |

### 4.2 Projects

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WRK-008 | The system shall let a person with the add-on create a project with a **name** (required, 1–80 characters; error "Give the project a name."), **client** (≤80), **colour**, **status** (Active / On hold / Done / Archived), **deadline** (optional date) and **description** (≤2000), under a company; a person without the add-on who presses New project is shown the Work add-on popup. | Must | work.js (wkOpenProj, wkProjSave), migration 071 |
| FR-WRK-009 | The system shall offer two project kinds at creation: **Project** (six phases: Planning, Requirement study, Design, Development, Testing, Deployment, created automatically) and **General** (no phases; the owner makes folders). The kind cannot be changed afterwards. | Must | work.js (WK_PHASE_KINDS), migration 073 |
| FR-WRK-010 | The system shall let the owner edit a project (pencil on its card or tap the card) unless its company is archived, and delete it after the confirmation "The project and all its tasks are removed for everyone on it. This can't be undone."; deleting removes its tasks, folders, comments, files (and their sharing), links and members. | Must | work.js (wkProjDelete), migrations 071, 075 |
| FR-WRK-011 | The system shall show each own project as a card with name, status, kind ("6 phases" or "General"), client, deadline, number of people when more than one, a progress bar and "N of M done"; projects shared with the person are listed under "Shared with me" with the owner's name and "view only" when they cannot change it. | Must | work.js (wkProjCard, wkProjectsView) |
| FR-WRK-012 | The system shall count a project as active for the Overview tile, the project-progress list, the Calendar and Timeline deadline flags, the Gantt deadline flag, the calendar file and Lumi's project lookup only when its status is **Active**. | Should | work.js, work.views.js, lumi/index.ts |
| FR-WRK-013 | The system shall refuse to create or change a project whose company is archived ("This company is archived: restore it to change its projects"). | Must | migrations 074, 077, 078 (work_project_guard) |
| FR-WRK-014 | The system shall tell a person who is refused by row-level security when saving a project: "The Work add-on is needed to create or change projects." | Should | work.js (wkProjSave) |

### 4.3 Phases, folders and notes

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WRK-015 | The system shall show, for one selected project, a **Phases** (or **Folders**) view in which every phase / folder lists its tasks with "done / total", its notes preview (first 160 characters) and an **Add task** button for editors; tasks with no phase / folder appear under "Not in a phase" / "Not in a folder". | Must | work.js (wkPhasesView) |
| FR-WRK-016 | The system shall keep the six phases fixed: they cannot be renamed, deleted, or added to; their **notes** (≤8000 characters) can be written by editors. | Must | migration 073 (work_folder_guard, policies) |
| FR-WRK-017 | The system shall let editors of a **General** project create, rename and delete folders (name required, 1–80 characters, error "Give the folder a name."; at most 40 folders per project, error "A project can have up to 40 folders"); deleting a folder asks for confirmation and keeps its tasks (their folder is cleared). | Must | work.js (wkFolderSave), migration 073 |
| FR-WRK-018 | The system shall show the phase / folder window read-only (name and notes disabled, no Save) to anyone who cannot edit. | Should | work.js (wkOpenFolder) |
| FR-WRK-019 | The system shall only allow a task to sit in a phase or folder of its own project ("That phase or folder is not in this project"). | Must | migration 073 (work_task_folder_guard) |

### 4.4 Tasks

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WRK-020 | The system shall let an editor create a task with **title** (required, 1–140; error "Give the task a name."), **description** (≤4000), **status** (To do / Doing / Review / Done), **priority** (Low / Medium / High), **phase / folder**, **start date**, **end date**, **time budget**, **assignees**, **team**, **checklist** and "waits for" links, in a project chosen in the window. | Must | work.js (wkOpenTask, wkTaskSave), migration 071 |
| FR-WRK-021 | The system shall refuse a start date later than the end date ("The start date can not be after the end date.") in the task window, on the Gantt chart and in the database. | Must | work.js, migration 072 (work_tasks_dates_check) |
| FR-WRK-022 | The system shall stamp `completed_at` when a task becomes Done and clear it when it leaves Done. | Must | migration 071 (work_task_guard) |
| FR-WRK-023 | The system shall allow **up to 10 assignees** per task, remove duplicates, and refuse anyone who is not an accepted person on the project ("That person is not on this project"). The window lists only the people on the project. | Must | work.js (wkPaintWho), migrations 072, 077 |
| FR-WRK-024 | The system shall allow a **checklist of up to 30 steps** of up to 120 characters ("A checklist can have up to 30 steps."), drop empty steps on save, and show "done/total" on the card. | Must | work.js (wkAddStep), migration 071 |
| FR-WRK-025 | The system shall show the task window read-only when the person is not an editor, with the reason "Changing tasks needs the Work add-on." (no add-on) or "You were added to this project as a viewer." (viewer); in an archived company the window is read-only as well. | Must | work.js (wkOpenTask) |
| FR-WRK-026 | The system shall let the project owner, or the person who created the task (while an editor), delete a task after confirming "This task is removed. This can't be undone."; an **Undo** toast re-creates the task with its basic fields (title, description, status, priority, folder, assignees, dates, checklist). | Must | work.js (wkTaskDelete), migration 071 (policy) |
| FR-WRK-027 | The system shall tell a person with the add-on but no editable project "Create a project first: tasks live inside a project." when they press New task, and show the add-on popup to a person without the add-on. | Should | work.js (wkOpenTask) |
| FR-WRK-028 | The system shall show a due label on cards and rows: "Today", "Tomorrow", "Overdue · date" (not for Done tasks) or the date, with a start → end range when the dates differ, coloured red when overdue and amber when due today or tomorrow. | Should | work.js (wkDue) |

### 4.5 Board, list, filters, moving, search

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WRK-029 | The system shall show the **Board** with the columns To do, Doing, Review, Done (counts per column), cards sorted by end date then position, and ◀ ▶ buttons on cards (editors only) that move the task one column; if saving fails the card goes back and "Could not move the task: …" is shown. | Must | work.js (wkTasksView, wkMove) |
| FR-WRK-030 | The system shall show the **List** with open tasks first and then Done, each group by end date, and tasks without a date last. | Should | work.js (wkTasksView) |
| FR-WRK-031 | The system shall offer a project filter ("All projects"), an **Assigned to me** toggle and, when teams exist, a team filter; the **Phases** view is offered only when one project is selected (otherwise Phases falls back to Board). | Must | work.js, work.teams.js |
| FR-WRK-032 | The system shall let an editor move a task to another project they can change, by choosing it in the project list of the task window and confirming "Move this task?"; the checklist, comments, files and logged time move with it, people not on the new project are taken off the task, the phase / folder is cleared, the "waits for" links are dropped, and the team is cleared when the target project belongs to another owner. | Must | work.js (wkTaskSave), migrations 078, 080, 084 (work_move_task) |
| FR-WRK-033 | The system shall refuse a task move when the person cannot change both projects (including an archived company) or the target project is full ("That project is full (up to N tasks on its owner's plan)"). | Must | migration 078 (work_move_task) |
| FR-WRK-034 | The system shall, in Work mode, let search find the person's projects, tasks (with project, due date or "done") and phase / folder notes; choosing a result switches to the right company when needed and opens the task (list view) or the phase / folder window. | Should | work.js (workSearchItems, wkOpenFromSearch) |
| FR-WRK-035 | The system shall lock the project list of the task window when the task cannot be moved (viewer, or fewer than two projects available) and add the company name to the project names when the person owns projects in more than one company. | Could | work.js (wkOpenTask) |

### 4.6 Non-functional requirements (WRK)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WRK-001 | The task list shall load up to 5,000 tasks and 5,000 links in one request; Work pages shall not block on a slow request for more than 20 seconds. | Should | work.data.js, work.js |
| NFR-WRK-002 | Every Work popup and page shall be usable at 320 px width without horizontal page scroll and with controls of at least thumb size. | Must | work.css |
| NFR-WRK-003 | All user-entered text shall be HTML-escaped when shown (titles, names, notes, comments, team names). | Must | work.js (escapeHtml) |

## 5. WCO — Companies

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WCO-001 | The system shall, the first time a person with the add-on opens Work and has no company, show "What is your company called?" with a name box (≤80 characters, hint "e.g. Acme Sdn Bhd", "Freelancing? Use your own name.") and a **Continue** button; an empty name shows "Type the company name first."; the New-task / New-project button and the company pill stay hidden until a company exists. | Must | work.js (wkSetup, data-wk-cosave) |
| FR-WCO-002 | The system shall show "No active company" (with **Open Company page**) when every company is archived. | Should | work.js (wkSetup) |
| FR-WCO-003 | The system shall show the company in view as a pill under the Work title (with "archived" when it is); pressing it opens the Company page. The pill is shown only to a person with the add-on. | Must | work.js (wkPaint) |
| FR-WCO-004 | The system shall provide the **Company** page (Work menu) listing Active and Archived companies with "N projects · N open tasks", an "In view" badge, the dates ("start → end" or "… → now"), the position, and the summary "N active · N archived · N of LIMIT used". | Must | work.company.js (wkcPaint) |
| FR-WCO-005 | The system shall let a person with the add-on add a company with **name** (required, 1–80; "Give the company a name."), **position** (≤80), **start date** and **end date** (optional); a start date after the end date is refused ("The start date can not be after the end date."). | Must | work.company.js (wkCoSave), migration 074 |
| FR-WCO-006 | The system shall let the owner edit the name, position, start and end dates of any of their companies, active or archived; the name and position are trimmed. | Must | work.company.js, migration 074 (work_company_guard) |
| FR-WCO-007 | The system shall let the person switch the company in view ("Switch to this" / "Open in Work" / View for an archived one); only that company's projects (and shared projects) are shown; a company can not change owner. | Must | work.company.js, migration 074 |
| FR-WCO-008 | The system shall archive a company after the confirmation "All its projects, tasks and notes are kept and can be looked at any time, but nothing in it can be changed until you restore it. Your other companies are not affected."; it sets `archived_at`, fills the end date with today's date (Malaysia time) **only if no end date was set**, and moves the view to the first active company. | Must | work.company.js, migration 074 |
| FR-WCO-009 | The system shall, while a company is archived, keep its projects, tasks, folders, notes, comments, files, links and teams **readable** and refuse every change to them (including by members), refuse new projects, tasks, comments, files, time entries and teams, and show the banner "<name> is archived — You can look at everything, but nothing can be changed. Restore it on the Company page to carry on." with a **Company** button, and hide the New button. | Must | work.js (wkPaint), migrations 074, 076, 084 (work_can_edit) |
| FR-WCO-010 | The system shall mark shared projects of an archived company as archived for the people they were shared with (read-only, "archived" flag in `my_work_shared`). | Must | migration 074 (my_work_shared), work.js (wkArchived) |
| FR-WCO-011 | The system shall restore a company (button **Restore**, toast "Company restored"), clearing `archived_at` and the end date and making everything editable again. | Must | work.company.js, migration 074 |
| FR-WCO-012 | The system shall allow deleting a company **only when it is archived** (database rule), after the confirmation "This deletes the company and its N projects, with every task and note. This can't be undone. (Archived is safer if you may want to look at it again.)"; deleting removes its projects, tasks, notes and teams and the person's time entries filed under that company. | Must | work.company.js, migration 074 (policy, FKs), 076, 084 |
| FR-WCO-013 | The system shall count active and archived companies together against the limit (Work 5, Work Pro 20), refuse the next one with "Your plan allows up to N companies in total (active and archived both count)" — shown in the app as "Your Work add-on allows up to N companies … Delete an archived one, or upgrade in Settings → your plan." — and explain the limit in the company window and on the page ("Work Pro allows 20" for Work). | Must | migration 077/083 (work_company_guard), work.company.js |
| FR-WCO-014 | The system shall keep companies private: only the owner can read them; members and viewers never see the owner's companies. | Must | migration 074 (policy work_companies_read) |
| FR-WCO-015 | The system shall file every project under one company: a new project goes into the company chosen in the project window (default: the company in view; the choice is shown only when there is more than one active company or when editing); a project saved without a company goes into the owner's first active company, and a company called "My company" is created when there is none. | Must | work.js (wkOpenProj), migration 074 |
| FR-WCO-016 | The system shall let the owner move a project to another **active** company of theirs from the Edit project window, after the confirmation "Move to <company>?"; its tasks, notes and the owner's own logged time on it move too; moving to an archived or foreign company, or by anyone but the owner, is refused. | Must | work.js (wkProjSave), migration 078 (work_move_project) |
| FR-WCO-017 | The system shall refuse a direct change of a project's company outside the move function ("Use Move to put a project in another company"). | Must | migration 078 (work_project_guard) |
| FR-WCO-018 | The system shall tell a person without the add-on, who tries to change a company, "The Work add-on is needed to change companies." (row-level security), and hide the Company page from guests. | Should | work.company.js, modes.js |
| FR-WCO-019 | The system shall move projects that existed before companies were introduced into a company called "My company" (migration 074). | Could | migration 074 |

### 5.1 Non-functional requirements (WCO)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WCO-001 | Archiving, restoring and deleting a company shall take effect in the database immediately (no cached frozen state): a member's next write after archiving is refused. | Should | migration 074 |

## 6. WTM — Time tracking

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WTM-001 | The system shall show the **Time** tab (only with the add-on) with: the timer card, a month switcher (◀ month ▶, and a picker for any month and year), a company filter ("All companies" or one company), **CSV** and **PDF** buttons, three tiles (This month, Days with time, Average per day), "Where the time went" (top 6 projects or names), one card per day with its entries, and, when empty, "No time logged in <month>". | Must | work.time.js (wkTimeView) |
| FR-WTM-002 | The system shall let a person with the add-on **log time by hand** (button **Log time**): what it was for, date (default today), hours, minutes, note (≤200), and, for general time, a name (≤100). | Must | work.time.js (wkTimeOpen, wkTimeSave) |
| FR-WTM-003 | The system shall offer as targets: **Project › Task** for every open task and **Project · whole project** for every project the person can change, and **General · <Company> (not on a project)** for every active company; with none available it says "Add a company or a project first: time is logged under one of them." | Must | work.time.js (wkTimeTargets) |
| FR-WTM-004 | The system shall validate a manual entry in this order: what ("Choose what you worked on."), date ("Choose the date."), minutes at least 1 ("Enter the time you spent (hours and / or minutes)."), at most 1440 minutes ("An entry can not be more than 24 hours."). | Must | work.time.js (wkTimeSave) |
| FR-WTM-005 | The system shall refuse any entry that makes the person's logged time on one date exceed **24 hours (1,440 minutes)** in total, with "A day can not have more than 24 hours logged" (shown as "That day would have more than 24 hours logged."); the cap counts every entry of that date, edited ones excluded from their own sum. | Must | migrations 076/079 (work_time_guard) |
| FR-WTM-006 | The system shall fill in the project, task title and company name of an entry from its task or project and keep those words when the task or project is deleted. | Must | migration 076 |
| FR-WTM-007 | The system shall treat time on a project the person does not own as having **no company**; such entries show under "Shared projects" in the timesheet and appear under "All companies" only. | Must | migration 076, work.time.js (wkCoName) |
| FR-WTM-008 | The system shall let general time carry a **name** (for example "Client call"), trimmed, at most 100 characters, shown instead of "General" in the Time tab and the timesheet; a name on time for a project or task is ignored. | Must | migration 079, work.time.js |
| FR-WTM-009 | The system shall let a person edit an entry (tap it) and delete it after "Delete this time entry? It is removed from your timesheet."; changing the month of an entry switches the tab to that month. | Must | work.time.js |
| FR-WTM-010 | The system shall provide a **timer**: Start timer (for a task, project or general, with an optional note or, for general, a name), one timer per person at a time (starting another stops the first and saves it), working across devices. | Must | work.time.js, migrations 076, 079 |
| FR-WTM-011 | The system shall, when the timer is stopped, save at least 1 minute (rounded up), at most **720 minutes (12 hours)** for a forgotten timer, and never more than what is left of the 24 hours of that day; the toast reads "Timer stopped" with the length and target; stopping with nothing running does nothing. | Must | migration 076 (work_timer_stop) |
| FR-WTM-012 | The system shall show a running timer as "Timer running", the target, the note and a live clock hh:mm:ss, with a **Stop** button; a running entry is not counted in lists, totals or the timesheet. | Must | work.time.js (wkTimerTick) |
| FR-WTM-013 | The system shall refuse starting a timer or logging time without the add-on ("The Work add-on is needed to track time"), as a viewer or guest, or in an archived company ("This company is archived: restore it to track time."). | Must | work.time.js, migrations 076, 079 |
| FR-WTM-014 | The system shall offer, in the task window of an editor, "Start timer" / "Stop timer" and "Log time" for that task, and show "logged by everyone on this task" with the total. | Should | work.time.js (wkPaintTaskTime) |
| FR-WTM-015 | The system shall keep every person's entries private (read, change and delete only your own), except that **everyone on a project can see the per-task totals** and **the project owner can see the hours each person logged on that project** (Team time). | Must | migrations 076, 078, 080 |
| FR-WTM-016 | The system shall tell the person, on the Time tab and in the log window, that the owner of a project can see the hours logged on it ("<owner> owns this project and can see the hours you log on it."). | Should | work.time.js (wkTimeHintFor) |
| FR-WTM-017 | The system shall let the **owner** of a project with more than one person open **Team time** (Tasks tab, one project selected): the total, hours and days per person, every entry (date, person, task, note), a month switcher and a **CSV** named "<PROJECT> <MONTH YEAR> TEAM TIME.csv"; nobody else may call it ("Only the project owner can see the team's time"). | Must | work.time.js (wkTeamOpen), migration 078 (work_project_time) |
| FR-WTM-018 | The system shall download the **timesheet CSV** named "<NAME> <MONTHNAME> TIMESHEET.csv" (for example "SHIRIN ZAHRA OCTOBER TIMESHEET.csv": upper-case full name, month name without year), UTF-8 with a byte-order mark, containing the title, Company, Month, a header row (Date, Day, Company, Project, Task, Notes, Hours), one row per entry in date order, and a Total row; hours have two decimals; for the selected company or "All companies". | Must | work.time.js (wkSheet, wkTimesheetCsv) |
| FR-WTM-019 | The system shall protect the CSV from spreadsheet formulas by prefixing a text cell that starts with `=`, `+`, `-`, `@`, tab or return with an apostrophe, and double the quotes inside a cell. | Must | work.time.js |
| FR-WTM-020 | The system shall open a **printable timesheet** ("PDF" button; the person chooses Save as PDF) titled "<NAME> <MONTHNAME> TIMESHEET" with a table (Date, Project, Task, Notes, Hours), a total, a "By project" table and signature lines "Employee: <name>", "Approved by", "Date"; if the browser blocks the window it says "Your browser blocked the new window. Allow pop-ups for LUMA and try again." | Must | work.time.js (wkTimesheetPdf) |
| FR-WTM-021 | The system shall say "There is no time logged for this month and company yet." (title "Nothing to export") instead of downloading an empty timesheet. | Must | work.time.js |
| FR-WTM-022 | The system shall move logged time with its task when a task is moved to another project, and with its project when a project is moved to another company (the owner's own entries). | Must | migration 078 |
| FR-WTM-023 | The system shall let a person keep up to **20,000 time entries** ("You can keep up to 20,000 time entries") and load up to 2,000 entries for one month. | Should | migration 076, work.data.js |
| FR-WTM-024 | The system shall make an entry's date default to today in Malaysia time when the database fills it (the app sends the date it shows); the timer's entry takes that date. | Should | migration 076 |

### 6.1 Non-functional requirements (WTM)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WTM-001 | The 24-hour-per-day and one-running-timer rules shall be enforced in the database (a unique index allows one running timer per person), not only in the form. | Must | migration 076 |
| NFR-WTM-002 | Stopping a timer, or deleting a task or project that entries point to, shall never be blocked by the rules (so nothing can get stuck). | Must | migration 076 (v_stop) |

## 7. WTE — Teams

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WTE-001 | The system shall show a **Teams** tab (with the add-on) with the line "N of LIMIT teams used (all your companies together)", a card per team of the company in view (name, note, colour, up to 8 people then "+N more", "N people", and a button "N open tasks"), a list "In your other companies", and "Teams you are in"; with no team it shows "No teams in <company> yet" and **Create a team**. | Must | work.teams.js (wkGrpView) |
| FR-WTE-002 | The system shall let a person with the add-on create a team in the company in view with a **name** (required, 1–60; "Give the team a name."), **note** (≤140), **colour** and **people** picked from their contacts, with an **Add me** option; the people counter reads "n / 50" and at most 50 people are allowed ("A team can have up to 50 people"). | Must | work.teams.js, migrations 084 |
| FR-WTE-003 | The system shall refuse a second team with the same name (ignoring case and spaces at the ends) in the same company: "You already have a team called "<name>" in this company". | Must | migration 084 (work_teams_name_uq) |
| FR-WTE-004 | The system shall only accept as team members the person themself and people in their contacts ("You can only add people from your contacts"). | Must | migration 084 (work_set_team) |
| FR-WTE-005 | The system shall let only the owner edit a team (name, note, colour, replace the people) — "Only the owner can change a team" — and let the owner delete it after "Delete the team "<name>"? The people stay on their tasks and projects. The tasks just lose the team label."; deleting keeps the tasks and their people. | Must | work.teams.js, migration 084 |
| FR-WTE-006 | The system shall limit teams to **5 (Work) or 20 (Work Pro)** per person, counted across all companies, with the message "Your plan allows up to N teams" (shown as "Your Work add-on allows up to N teams"). | Must | migrations 084, 083 |
| FR-WTE-007 | The system shall refuse to create, change or delete a team in an archived company ("This company is archived: restore it to change its teams") and refuse team management without the add-on ("The Work add-on is needed to manage teams"). | Must | migration 084 |
| FR-WTE-008 | The system shall, when a team is picked in the task window, tick the team's people who are on the project (keeping existing choices, at most 10 assignees) and write "N of M ticked. You can still add or remove people above."; people can still be added or removed one by one, including people outside the team. | Must | work.teams.js |
| FR-WTE-009 | The system shall list the team's people who are not on the project yet ("N not on this project yet: …", with "(invited)" for pending ones) and give the **owner** an **Add them to the project** button that invites them (not the pending ones), saying "N invited. They can be given the task once they accept."; a member is told "Ask the project owner to add them." | Must | work.teams.js |
| FR-WTE-010 | The system shall say "This team has nobody in it yet." for an empty own team and "Only the label is added: the project owner can see who is in this team." when the team belongs to somebody else. | Should | work.teams.js |
| FR-WTE-011 | The system shall let the owner **add a whole team to a project** (project window, "Add a whole team…" then **Add team**): everyone in the team who is not the owner and not already on the project (declined people count as not on it) is invited as member; with nobody to add it says "Nothing to add — Everyone in <team> is already on this project"; success reads "Team added — N people from <team> invited"; a missing choice says "Pick a team first." | Must | work.teams.js |
| FR-WTE-012 | The system shall allow a task to be for a team only if the team belongs to the project's owner ("That team does not belong to this project's owner"); moving the task to another owner's project clears the team. | Must | migration 084 (work_task_team_guard) |
| FR-WTE-013 | The system shall show the team as a chip on task cards and rows and filter the Tasks tab by team (also from the "N open tasks" button of a team card, which clears the project filter). | Should | work.teams.js |
| FR-WTE-014 | The system shall show the **member list** of a team only to its owner; people on the owner's projects see the team **name** on tasks (count only, no people); a person who is in a team sees it under "Teams you are in" with the owner's name; unrelated people see nothing; the team tables cannot be read directly. | Must | migrations 084, 085 (my_work_teams, RLS) |
| FR-WTE-015 | The system shall notify each person who was just added to a team ("👥 <owner> added you to the team "<name>"", body "<company>. Open Work to see it.") — not the owner, not people who were already in the team, and not again when the team is saved without changes; opening it goes to Work → Teams (Projects for someone without the add-on). | Must | migration 085, work.js (LU_FOCUS_HOOKS) |
| FR-WTE-016 | The system shall let a team be saved in one step: name, note, colour and the whole people list replace the previous ones (people not in the new list are removed). | Should | migration 084 (work_set_team) |

### 7.1 Non-functional requirements (WTE)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WTE-001 | Teams shall be written only through `work_set_team` and `work_delete_team` (no direct table writes by clients). | Must | migration 084 (grants) |
| NFR-WTE-002 | If migration 084 has not run, Work shall still work and simply show no teams; saving a team then says "Run supabase/migrations/084_work_teams.sql in the SQL Editor first." | Could | work.data.js, work.teams.js |

## 8. WCM — Comments, history, @mentions, files, document sharing

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WCM-001 | The system shall show the **Files** and **Discussion** sections only in the window of a task that already exists, and show everyone who can open the task (owner, member, viewer, guest) the existing comments and files. | Must | work.js (wkPaintMore), migration 075 (work_task_comments_of, work_task_files_of) |
| FR-WCM-002 | The system shall let an **editor** write a comment of 1–2000 characters (button send, or Ctrl / Cmd + Enter); an empty comment shows "Write your comment first, then press send."; a person who may not comment sees "Only owners and members with the Work add-on can comment." | Must | work.js (wkTaskCmtSend), migration 075 |
| FR-WCM-003 | The system shall hide the comment box and the **Attach a file** button from viewers, guests and anyone in an archived company, and show "No comments yet." (with "Be the first to write one." for editors). | Must | work.js (wkPaintMore, wkLoadComments) |
| FR-WCM-004 | The system shall show each comment with the writer's initial, name ("(you)" for your own), a relative time ("just now", "N min ago", "N h ago", then the date), the text with tagged names highlighted, and an **edited** link when it was changed. | Should | work.js (wkLoadComments) |
| FR-WCM-005 | The system shall let **only the writer** edit a comment (not even the owner): the text is changed in place; an empty text is refused ("A comment can not be empty. Delete it instead."); only the wording (and mentions) can change; at most 50 edits are kept ("A comment can be edited up to 50 times"); saving identical text adds no history. | Must | work.js, migration 078 (work_comment_edit_guard) |
| FR-WCM-006 | The system shall show the edit history in a window listing the current wording ("Now") and every earlier wording ("Before") with date and time, newest first; only people on the project may read it; the history table cannot be read directly. | Must | work.js (wkShowHistory), migration 078 (work_comment_history) |
| FR-WCM-007 | The system shall let the **writer or the project owner** delete a comment; nobody else may. | Must | migration 075 (policy work_comments_delete), work.js |
| FR-WCM-008 | The system shall allow at most **500 comments** on a task ("A task can have up to 500 comments"). | Should | migration 075 (work_comment_guard) |
| FR-WCM-009 | The system shall notify the people on the task and the person who created it about a new comment ("💬 <name> commented on <task>", first 120 characters as body), except the writer and anyone who was @mentioned (they get the mention notification instead), and only people still on the project; opening it opens the task; the toast after sending reads "Comment sent — The people on this task are told". | Must | migration 075/080 (work_comment_notify) |
| FR-WCM-010 | The system shall open a list of up to **6** project people (not yourself) when the writer types `@`, filtered by the letters typed (match at the start of any word of the name), and insert "@Name " when one is chosen. | Should | work.js (wkMentionBox) |
| FR-WCM-011 | The system shall work out the tagged people from the words of the comment when it is sent (a person is tagged when "@" and their full name appear in the text), keep only people on the project and never the writer, keep at most 10, highlight the names, and notify each tagged person with "@ <writer> mentioned you on <task>"; when a comment is edited only people newly tagged are notified. | Must | work.js (wkMentionsOf), migration 080 |
| FR-WCM-012 | The system shall let an editor **attach a file** from their device: it is uploaded to the person's own Documents, attached to the task and **shared with everyone on the project**; the button shows "Uploading…", then the toast "File attached — The people on this project can open it"; a failure shows "Could not attach the file: …". | Must | work.js (wkTaskFile), migration 075 (work_attach_file) |
| FR-WCM-013 | The system shall allow only the person's **own documents** to be attached ("You can only attach your own documents"), at most **20 files** per task ("A task can have up to 20 files"), and only by editors ("Not allowed"). | Must | migration 075 |
| FR-WCM-014 | The system shall list each file with name, size and who attached it; clicking the name opens a signed link in a new tab, or shows "Could not open the file: …". | Must | work.js (wkLoadFiles) |
| FR-WCM-015 | The system shall let **the person who attached a file, or the project owner**, remove it after "Remove this file from the task? The others can no longer open it. The file stays in the Documents of the person who attached it."; removing takes the sharing away from everyone on the project unless another Work link still shares it. | Must | work.js, migration 075 (work_detach_file) |
| FR-WCM-016 | The system shall share a task's files with a person who accepts an invitation, and take the sharing away from a person who leaves or is removed, from everyone when the task or project is deleted, and move it from the old project's people to the new project's people when the task is moved. | Must | migrations 075, 078, 080 |
| FR-WCM-017 | The system shall keep comments, files and logged time with the task when it is moved to another project. | Must | migration 078 (work_move_task) |

### 8.1 Non-functional requirements (WCM)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WCM-001 | A person who is not on the project shall not be able to read comments, history, files or links by any route (functions raise "Not allowed"; policies return no rows). | Must | migrations 075, 078, 080 |
| NFR-WCM-002 | File size and type limits are those of Documents (plan `file_mb`, `storage_mb`); Work adds no limit of its own beyond 20 files per task. Exact values TBC (see Documents SRS). | Could | work.js, LumaDocuments |

## 9. WGV — Gantt chart, timeline, links, calendar and deadlines

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WGV-001 | The system shall draw the **Gantt chart** (Tasks → Gantt): a bar for every task with a date from its start to its end date (a task with only one date is a diamond on that day), grouped by project, or — when one project is selected — by phase / folder with "Not in a phase / folder"; tasks without dates are listed under "No dates yet". | Must | work.views.js (wkGanttView) |
| FR-WGV-002 | The system shall colour bars by status, fill them by progress (Done 100 %, checklist ratio, otherwise Doing 40 %, Review 80 %, To do 0), outline overdue open tasks in red, show project deadlines (active projects) as flags, draw a red line for today, show a legend, and open the task when a bar or name is tapped. | Should | work.views.js, work.css |
| FR-WGV-003 | The system shall offer zoom **Week / Month / Quarter** (38 / 16 / 5 pixels per day) and a **Today** button, and on opening scroll so that the earliest bar or today (about 60 % across) is in view; the chart is at least 28 days wide. | Should | work.views.js |
| FR-WGV-004 | The system shall show "Nothing to draw yet — Give tasks a start and an end date and they appear here as bars." (with the number of tasks without dates) when no task has a date and no deadline flag exists. | Should | work.views.js |
| FR-WGV-005 | The system shall let an **editor drag a bar** to move the task (start and end move together by whole days), with a label showing the new dates and length while dragging, save when the pointer is released ("Dates changed — <task> · <start> → <end>"), ignore movements under 5 pixels and treat a plain tap as opening the task; viewers, guests and archived-company tasks have no drag handles. | Must | work.views.js (pointerdown / move / up) |
| FR-WGV-006 | The system shall let an editor drag the **left or right end** of a bar to change the start or end date; the start can not pass the end and the end can not pass the start. | Must | work.views.js (wkDragDates) |
| FR-WGV-007 | The system shall, when saving a drag fails, put the bar back and say "The start date can not be after the end date." (dates check), "You can't change tasks in this project." (row-level security) or the hint of the error. | Must | work.views.js (wkDragEnd) |
| FR-WGV-008 | The system shall let an editor choose, in the task window, the tasks this task **waits for** ("Add a task it waits for…"): up to 10, only tasks of the same project, never the task itself, shown as chips that can be removed; saved with the task; "A task can wait for up to 10 other tasks" and "A task can only wait for a task in the same project" are enforced by the database. | Must | work.js (wkPaintDeps), migration 080 (work_set_dependencies) |
| FR-WGV-009 | The system shall refuse a link that would make a loop ("That would make a loop: the other task already waits for this one"); when the task was saved but its links were not, it says "The task was saved, but its links were not: …". | Must | migration 080, work.js |
| FR-WGV-010 | The system shall warn in the task window "This task starts before "<task>" ends." when the task starts on or before the end of an unfinished task it waits for, and show a link badge ("Waiting for another task") on cards whose predecessor is not Done. | Should | work.js (wkPaintDeps, wkCard) |
| FR-WGV-011 | The system shall draw arrows from the end of a task to the start of the task that waits for it, red and dashed when the waiting task starts before the other ends and the other is not Done; links are only drawn between tasks that are both shown. | Should | work.views.js |
| FR-WGV-012 | The system shall, after a drag that makes a task end later and run into a task waiting for it, **push that task (and the ones waiting for it) later** by the number of days they overlap. | Must | work.views.js (wkCascade) |
| FR-WGV-013 | The system shall, after a drag that makes a task end earlier, **pull earlier** the task that started on the very next day after the old end ("tight") by the same number of days (never before the end of its other predecessors) and the tasks behind it; a task with a gap left on purpose stays where it is. | Must | work.views.js (wkCascade) |
| FR-WGV-014 | The system shall leave out of the cascade tasks that are Done, tasks without dates and tasks the person cannot edit; add "· N linked task(s) moved too" to the toast; if a linked task cannot be saved it goes back to its old dates. | Must | work.views.js (wkDragEnd) |
| FR-WGV-015 | The system shall draw the **Timeline** (Tasks → Timeline): groups "Recently done" (finished in the last 14 days), "Overdue", "This week", "Next week", then one group per month, and "No date"; each item shows project › phase, assignees, status, dates, length in days and a progress bar; project deadlines are milestones; tapping a task opens it, tapping a milestone opens the project's phases view. Empty: "Nothing on the timeline". | Should | work.views.js (wkTimelineView) |
| FR-WGV-016 | The system shall make the Gantt chart and the Timeline follow the project filter, **Assigned to me** and the team filter. | Should | work.js (wkTasksView) |
| FR-WGV-017 | The system shall show on the **Calendar** (in Work mode, or in Personal mode when "Show Work in Personal" is on, and only with the add-on) every open Work task with a date on each day from its start to its end ("task starts", "task in progress", "task due"; a task longer than 31 days only on its first and last day), plus the deadline of each active project ("Project deadline"), in the "Work tasks" filter group; tapping one opens the task. | Must | work.js (workCalItems), calendar.js |
| FR-WGV-018 | The system shall offer **Calendar file** in the Tasks tab: it saves `LUMA-work.ics` with one all-day event per open task that has an end date (from its start date to its end date, UID `luma-work-<id>`, title "<Project>: <task>", description) and one per active project deadline ("Deadline: <project>"), following the project and Assigned-to-me filters; with nothing to export it says "There are no open tasks with a due date to export." (title "Nothing to export"); success shows "Calendar file saved — N deadline(s) · LUMA-work.ics". | Must | work.js (data-wkics), ics.js |
| FR-WGV-019 | The system shall write ICS text with CRLF line ends, escaped commas / semicolons / backslashes / new lines, lines folded at 74 characters, and an all-day end date one day after the last day. | Should | app/core/ics.js |
| FR-WGV-020 | The system shall show on the Personal **Dashboard**, when the person has the add-on and "Show Work in Personal" is on, a Work card with Overdue, Due today, "Yours, open" and today's logged hours (or "Timer running"), and the next 4 of their tasks; tapping a task opens it and tapping the hours opens the Time tab. | Should | work.js (wkPaintDashCard) |
| FR-WGV-021 | The system shall count Work tasks (open, in a company that is not archived, spanning the day) in the busy-day measure of the Calendar, Dashboard and Work overview and in the 6 pm "Tomorrow is busy / packed" notification, for people with the add-on. | Should | busy.js, migration 082 (busy_day_stats) |
| FR-WGV-022 | The system shall keep the Work data used by the Calendar and Dashboard for 60 seconds before reloading it. | Could | work.js (wkEnsureLoaded) |
| FR-WGV-023 | The system shall keep the Gantt chart usable on a phone: the chart scrolls sideways inside its own box, the name column is 118 px wide at ≤640 px, and the page itself does not scroll sideways. | Must | work.css |

### 9.1 Non-functional requirements (WGV)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WGV-001 | Dragging shall move the bar on screen immediately (before saving) and a finger drag shall work with pointer events. | Should | work.views.js |
| NFR-WGV-002 | The cascade shall be calculated in the app: the database does not move linked tasks by itself. Linked-task saves are separate requests (not one transaction). | Should | work.views.js |

## 10. WLM — Roles, permissions, limits, trial, expiry

### 10.1 Roles and permissions

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WLM-001 | The system shall recognise four kinds of person for a project: owner, member, viewer (accepted people) and outsider; a pending or declined invitation gives no access to tasks, folders, comments, files, links or people. | Must | migration 071 (work_role) |
| FR-WLM-002 | The system shall allow a person to change things in a project (tasks, folders and notes, comments, files, links, times on it) only if they are owner or member **and** have the Work add-on **and** the project's company is not archived; the rule is applied by the database (`work_can_edit`) as well as by the app. | Must | migrations 071, 074 |
| FR-WLM-003 | The system shall let only the owner (with the add-on) create, edit and delete projects; deleting a project does not require the add-on to be active; only the owner can delete a project. | Must | migration 071 (policies) |
| FR-WLM-004 | The system shall let a **viewer** read tasks, folders and notes, comments, files, links, per-task time totals and the list of people, but change nothing and write no comment, even if the viewer has the add-on. | Must | migrations 071–080 |
| FR-WLM-005 | The system shall let a **guest** (no add-on) who was added to a project open Work (Projects and Tasks tabs, a note "You are viewing projects other people shared with you", **Get Work** button) and look at what they were added to; the Work menu is limited to Work, the Company page is hidden and invitations read "You can look at it (changing tasks needs the Work add-on)". Owning projects is not needed. | Must | work.js (wkProjectsView, wkCheckGuest), modes.js |
| FR-WLM-006 | The system shall let an **outsider** read nothing: projects, tasks, folders, comments, history, files, links, time totals and member lists return no rows or "Not allowed". | Must | migrations 071–080 (RLS) |
| FR-WLM-007 | The system shall let a member whose add-on has ended keep seeing the project but not change it (read-only), and become able again as soon as the add-on is active. | Must | migration 071 |

### 10.2 People on a project

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WLM-008 | The system shall let **only the owner, with the add-on,** invite people ("Add people to this project", chosen from their contacts) as member (default) or viewer; errors: "Only the project owner can invite people", "The Work add-on is needed to invite people", "You can only invite people in your contacts", "Unknown role". The toast reads "Invitations sent — N people added". | Must | work.js (wkTeamAdd), migrations 071, 077 |
| FR-WLM-009 | The system shall refuse to exceed the people limit (Work 8, Work Pro 15, counting invited and accepted, not declined, not the owner): "Your plan allows up to N people on a project" (shown as "Your Work add-on allows …"). | Must | migration 077/083 (work_invite) |
| FR-WLM-010 | The system shall notify an invited person ("💼 <owner> added you to a project", "<project>. Open Work to accept.") and show the invitation in Work (Overview and Projects) with **Accept** and **Decline**; accepting or declining notifies the owner ("✅ <name> joined <project>" / "❌ <name> declined <project>"); an answer is only possible while the invitation is pending ("No invitation found"). | Must | work.js (wkInvites), migration 071 (work_respond) |
| FR-WLM-011 | The system shall let an invitee with the add-on see "You can add and change tasks", a viewer "You can look at it", and a guest "You can look at it (changing tasks needs the Work add-on)". | Should | work.js (wkInvites) |
| FR-WLM-012 | The system shall let the owner change a person's role with **Make member / Make viewer** and remove a person ("Remove this person? They lose access, and their tasks become unassigned."); the removed person's assignments are removed from tasks and their file sharing is taken away; only the owner can change roles ("Only the project owner can change roles"); a person may also remove themselves (database rule). | Must | work.js, migrations 071, 072, 075 |
| FR-WLM-013 | The system shall let the owner invite again a person who declined (the invitation becomes pending again) and ignore invitations for people already invited or on the project. | Should | migration 071 (work_invite) |
| FR-WLM-014 | The system shall show pending invitees only to the owner, and accepted people to everyone on the project. | Must | migration 071 (my_work_people, work_project_members) |

### 10.3 Plan and add-on limits

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WLM-015 | The system shall decide the Work limits by the **add-on size of the person who owns the project / company** and not by the plan: Work = 5 companies, 20 projects, 8 people on a project, 600 tasks in a project, 5 teams; Work Pro = 20, 60, 15, 1,500, 20; a person without an active add-on is given the Work numbers; the numbers are stored in `luma.plan_limits` under plans `work` and `work_pro` and sent to the app with `my_limits`. | Must | migration 083, modes.js (WORK_SIZES) |
| FR-WLM-016 | The system shall refuse the next project when the owner already has the maximum ("Your plan allows up to N projects"), the next task when the project has the maximum ("Your plan allows up to N tasks in a project"; the count is by the project owner's size, even when a member adds it), and, when moving a task, a full target ("That project is full (up to N tasks on its owner's plan)"). | Must | migrations 077, 078, 083 |
| FR-WLM-017 | The system shall show limit messages in the app as "Your <Work or Work Pro> add-on allows …" and, for Work, add "Work Pro allows more: see Settings → your plan → Add-ons." | Should | work.js (wkHint) |
| FR-WLM-018 | The system shall, after an add-on ends or is lowered to Work, delete nothing: what exists stays and only adding more is blocked. | Must | migrations 077, 083; CHANGELOG |
| FR-WLM-019 | The system shall let an administrator change the numbers (Admin → Plan limits, columns Work and Work Pro; unknown keys, negative numbers and non-admins are refused). | Should | migration 083, admin.js |
| FR-WLM-020 | The system shall show the sizes with prices and limits in the Work add-on popup (Work RM15 / month, Work Pro RM25 / month, "It works on every plan"), in Settings → Your plan and add-ons and on the Company page. | Should | modes.js (openAddon), plans.js |

### 10.4 Free trial, getting and renewing the add-on, admin grants, expiry

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WLM-021 | The system shall offer a **one-time 7-day free trial** of Work (button "Start 7-day free trial") to a person who does not have the add-on and has not used the trial; the trial gives the Work size; a second trial is refused ("The free trial was already used"), as is starting one while the add-on is active ("You already have this add-on"); on success the person is moved into Work mode and told "Work trial started — Free for 7 days". | Must | modes.js, migration 044 (start_addon_trial) |
| FR-WLM-022 | The system shall let a person ask for the add-on by WhatsApp with their name, email, plan, add-on and price ("Get Work · RM15 / month", "Get Work Pro · RM25 / month", the bundle "Work + Study · RM19 / month"), upgrade Work to Work Pro, and renew (also as the smaller size); if the WhatsApp number is not configured it says "The WhatsApp number for requests isn't set up yet." | Should | modes.js (requestAddon), plans.js |
| FR-WLM-023 | The system shall let only an administrator grant, extend or end the Work add-on (`admin_set_addon`) with a size (Work or Work Pro), a number of months or an end date and an extend option; keeping the old size when none is chosen; an unknown size is refused; a person who is not an administrator is refused ("Not allowed"); the person is notified "🎉 Work mode is on" (or "Work Pro mode is on") with the end date. | Must | migration 083, admin.js |
| FR-WLM-024 | The system shall show the add-on status: in the Work header "· add-on until <date>" or "· free trial until <date>" and, within 7 days of the end, "(N days left)"; in Settings a pill (Work, Work Pro, "Trial until …", "Active until …"). | Should | work.js (MODULES.work), plans.js |
| FR-WLM-025 | The system shall, when the add-on has ended, take the person out of Work mode to the Dashboard (a guest stays in as read-only), hide the Overview, Teams and Time tabs, refuse creating or changing in the database at once, and check the plan again when the person returns to the app after 2 minutes or more; a notification "Your Work add-on has ended" is sent. | Must | modes.js (enforceModeAccess), migration 062 |
| FR-WLM-026 | The system shall lock the Work mode switch for a person with neither the add-on nor guest access and show the add-on popup (Work mode, perks, sizes, "Get Work", trial). | Should | modes.js (lumaModeOpen, openAddon) |
| FR-WLM-027 | The system shall let an administrator read the Work figures (`admin_work_stats`: users with Work, trial, paid or granted, trials started, companies, archived companies, projects, shared projects, tasks, done tasks, accepted people, hours logged, active in 30 days, and 12 months of new projects, tasks, hours, new users); anyone else is refused. | Could | migration 080 |

### 10.5 Non-functional requirements (WLM)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WLM-001 | Every Work table shall have row-level security; `anon` shall have no access; functions are granted to `authenticated` only; "security definer" functions shall set an empty search path. | Must | migrations 071–085 |
| NFR-WLM-002 | Roles and limits shall be enforced in the database; the app only explains them. A client that skips the app shall hit the same rules. | Must | migrations 071–085 |
| NFR-WLM-003 | If the plan cannot be fetched the app shall behave as the strictest plan, never a bigger one. For Work company counts the app uses 5 when the limit is unknown. | Should | luma-plan.js, work.company.js |

## 11. WNT — Notifications, reminders, Lumi and budgets

### 11.1 Notifications

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WNT-001 | The system shall create these Work notifications: `work_invite` (added to a project), `work_reply` (answer to the owner), `work_task` ("📌 <name> gave you a task", "<task> · <project>"), `work_comment`, `work_mention`, `work_budget` ("⏱ <task> is over its time budget"), `work_team`, `reminder_work`; each shows an orange icon in the notification centre. | Must | migrations 071–085, notifications.js |
| FR-WNT-002 | The system shall notify a person when they are **added to a task** (on insert or when newly added), but not the person who made the change, not people who were already on the task, and not on other edits. | Must | migration 072 (work_task_assigned) |
| FR-WNT-003 | The system shall open the right place from a Work notification: a comment, mention or budget notification opens the task; "gave you a task" and a reminder open Tasks for that project; invitations and answers open Projects (or Overview); a team notification opens Teams (Projects without the add-on). | Should | work.js (LU_FOCUS_HOOKS) |
| FR-WNT-004 | The system shall show the **"Show Work in Personal"** switch (Settings → Preferences, only with the add-on, default off) which makes Work items also appear while in Personal mode (Calendar spans and deadlines, the Dashboard Work card, Work-mode events, reminders, notes and documents); with it off, what was made in Work is not shown in Personal. | Must | settings.js, luma-space.js, work.js |
| FR-WNT-005 | The system shall file items created in Work mode (tasks, events, reminders, notes, documents, habits, goals, bills, money entries) under the Work space; the Work tables themselves (companies, projects, work tasks, time) are not filtered by space. | Should | luma-space.js, migration 050 |

### 11.2 Due-date reminders

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WNT-006 | The system shall remind each **assignee who has the Work add-on** about an open task with a due date: **N days before** (Settings "First reminder", 1–14 days, default 1), **the day before** and **on the day**, at the hour the person chose ("Send at", default 09:00, in their own time zone). | Must | migration 077 (run_work_reminders) |
| FR-WNT-007 | The system shall send a daily "⚠️ <task> is overdue by N day(s)" nudge at the chosen hour for up to **7 days** after the due date, and nothing after that. | Must | migration 077 |
| FR-WNT-008 | The system shall not remind for Done tasks, tasks without a due date or without assignees, tasks due more than the chosen days ahead, tasks in an archived company, assignees without the add-on, or when the person switched Work reminders off; the same title is not sent twice within 12 hours. | Must | migration 077 |
| FR-WNT-009 | The system shall run the reminders from the hourly job `luma-work-reminders` (minute 0 of every hour); if the job cannot be scheduled the migration prints the notice "Could not schedule the Work reminder job … Enable pg_cron under Database → Extensions". | Must | migration 077 |
| FR-WNT-010 | The system shall show in Settings → Reminders, for people with the add-on, a **Work** card: a switch (default on), "First reminder" and "Send at"; people on Dawn see the standard times (choosing them needs Glow or Zenith). | Should | settings.js |

### 11.3 Time budget

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WNT-011 | The system shall let an editor set a **time budget** on a task in hours (0 – 1000, steps of 0.5; stored in minutes 1 – 60,000; empty means none), show "3h / 8h" on the card (red once over) and a progress bar with "X logged of Y" and "over by Z" in the task window. | Must | work.js (wkBud, wkPaintBudget), migration 080 |
| FR-WNT-012 | The system shall notify **once** when the logged time of a task crosses its budget: the assignees, the project owner and the task's creator who are still on the project, except the person who logged the time; more time later does not notify again. | Must | migration 080 (work_budget_watch) |

### 11.4 Lumi's Work tools

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WNT-013 | The system shall let Lumi **create a project** (`create_work_project`: name ≤80, client ≤80, kind project / general, deadline, notes ≤2000) in the person's first active company (creating "My company" if none). | Should | lumi/index.ts |
| FR-WNT-014 | The system shall let Lumi **add up to 20 tasks** (`add_work_tasks`) to one active project found by part of its name (title ≤140, notes, priority, start / end dates, a phase or folder by name, `budget_hours` capped at 60,000 minutes); without a project name it uses the only active project or asks "Which project? …". | Should | lumi/index.ts |
| FR-WNT-015 | The system shall let Lumi **update a task** (`update_work_task`: status, title, priority, dates or clear them) found by part of its title, asking when several match ("Several tasks match "…": …. Ask which one.") or saying "I couldn't find a Work task called "…"." | Should | lumi/index.ts |
| FR-WNT-016 | The system shall let Lumi **move a task** to another project and **move a project** to another active company using the same database functions as the app ("… is already in <project>." when it is). | Should | lumi/index.ts |
| FR-WNT-017 | The system shall let Lumi **log time** (`log_work_time`: hours and / or minutes, 1 – 1440 total, "Say how long: between 1 minute and 24 hours.", date default today, a task, a project or general time under the first active company, name ≤100, note ≤200) and **start / stop the timer** (`work_timer`; "No timer is running." when stopping with none). | Should | lumi/index.ts |
| FR-WNT-018 | The system shall let Lumi's Work answers be bound by the database rules (add-on, role, archived company, limits and the 24-hour cap): the database message is returned, and "Work isn't switched on for this account." when row-level security refuses; Lumi can only find **active** projects and **open** tasks for time. | Must | lumi/index.ts |
| FR-WNT-019 | The system shall let `get_overview` return a Work section (projects, 40 open tasks, hours this month and per project) when the person has projects, and tell Lumi that in Work mode "add a task" means a Work task and "I worked 2 hours on X" means log time. | Could | lumi/index.ts |

### 11.5 Non-functional requirements (WNT)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-WNT-001 | Reminders shall be sent within the chosen hour of the person's own time zone (job runs hourly). | Should | migration 077 |
| NFR-WNT-002 | Notification texts shall be written by the database functions so that every route (app, Lumi, admin) produces the same message. | Should | migrations 071–085 |
