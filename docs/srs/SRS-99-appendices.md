# SRS — Appendices

## A. Plan and add-on limits

Values come from `luma.plan_limits` as created by the migrations (an administrator can change them under Admin → Plan limits; an empty value / ∞ means unlimited). "Work" and "Work Pro" are the two sizes of the Work add-on and set the Work numbers whatever the person's plan is.

| Limit key | What it limits | Dawn | Glow | Zenith | Work | Work Pro |
|---|---|---|---|---|---|---|
| bills | Bills you can keep | 5 | 12 | ∞ | | |
| chat_messages | Chat messages a day, per sender | 50 | 50 | 50 | | |
| contacts | Contacts | 3 | 12 | ∞ | | |
| file_mb | Largest single file (MB) | 5 | 20 | 50 | | |
| goals | Goals | 3 | 5 | ∞ | | |
| habits | Habits | 5 | 10 | ∞ | | |
| insights | AI insights a day | 0 | 3 | 10 | | |
| lumi_actions | Lumi may add / change things for you (0 = off, 1 = on) | 0 | 1 | 1 | | |
| lumi_questions | Lumi questions a day | 3 | 10 | 15 | | |
| own_wallpaper | Upload your own wallpaper (0 / 1) | 0 | 0 | 1 | | |
| payroll | Payroll helper (0 / 1) | 0 | 1 | 1 | | |
| reminders | Reminders | 5 | 25 | ∞ | | |
| split | Split expenses (0 / 1) | 0 | 0 | 1 | | |
| storage_mb | Total storage (MB) | 50 | 300 | 1000 | | |
| themes | Themes you can pick | 1 | 3 | 3 | | |
| timing | Fine-tune reminder times (0 / 1) | 0 | 1 | 1 | | |
| wallpapers | Built-in wallpapers | 4 | 8 | 11 | | |
| work_companies | Companies (active and archived) | | | | 5 | 20 |
| work_projects | Projects you own | | | | 20 | 60 |
| work_people | People on one project | | | | 8 | 15 |
| work_tasks | Tasks in one project | | | | 600 | 1500 |
| work_teams | Teams you own | | | | 5 | 20 |

Fixed (not in `plan_limits`): a task has at most 10 assignees; a Work team has at most 50 people; time entries are capped at 24 hours a day per person; a task's checklist has at most 30 steps.

Prices (shown in the app, requested through WhatsApp): Glow RM9 / month, Zenith RM19 / month; Study RM7 / month, Work RM15 / month, Work Pro RM25 / month, bundle Work + Study RM19 / month.

## B. Who may do what in Work

| Action | Owner | Member | Viewer | Guest (no Work add-on) | Outsider |
|---|---|---|---|---|---|
| See the project and its tasks | ✔ | ✔ | ✔ | ✔ (read-only) | ✘ |
| Create / edit / move / delete tasks | ✔ | ✔ | ✘ | ✘ | ✘ |
| Read comments and files | ✔ | ✔ | ✔ | ✔ | ✘ |
| Add comments, edit own comments, attach files | ✔ | ✔ | ✘ | ✘ | ✘ |
| Delete a comment | ✔ (any) | own only | ✘ | ✘ | ✘ |
| Log time on the project | ✔ | ✔ | ✘ | ✘ | ✘ |
| See other people's logged time | ✔ (Team time) | ✘ | ✘ | ✘ | ✘ |
| Invite / remove people, change roles | ✔ | ✘ | ✘ | ✘ | ✘ |
| Edit or delete the project, move it to another company | ✔ | ✘ | ✘ | ✘ | ✘ |
| Manage teams and see who is in them | ✔ | ✘ (sees the team name on a task) | ✘ | ✘ | ✘ |

A company that is archived freezes everything under it for everybody: it can be read, nothing can be changed until it is restored. Someone whose Work add-on has ended can still open, export and delete what they made, but cannot add new Work items.

(Rules are enforced by RLS policies and the functions `work_role`, `work_can_edit`, `work_people`; see `docs/design/DATABASE.md`. The test cases in `docs/tests/TC-work.md` check them.)

## C. Where the other catalogues are

| Catalogue | Location |
|---|---|
| Tables, functions, triggers, cron jobs, storage buckets | `docs/design/DATABASE.md` |
| Edge functions, Lumi tools, push flow | `docs/design/EDGE-FUNCTIONS.md` |
| Screens and modules | `docs/design/SDD.md` (module table) |
| Every test case, by requirement | `docs/05-TRACEABILITY.md` and `docs/tests/TC-INDEX.md` (generated) |
