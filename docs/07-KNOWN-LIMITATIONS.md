# Known limitations and open items

Things that are intentionally not built, decisions that are provisional, and items that still need confirmation. Findings from the detailed review of each area are at the end of the five `docs/tests/TC-*.md` files.

## 1. Not built (by decision)

| Area | Limitation |
|---|---|
| Payments | No online payment. A plan or add-on is requested through a WhatsApp message and switched on by an administrator. |
| Work → Lumi | Lumi has tools for Work projects, tasks, moving and time, but cannot create teams or give a task to a team. |
| Work → Gantt | Dragging a bar moves linked tasks only along "waits for" links: later tasks that now overlap are pushed later; tasks that started the very next day follow it earlier (never before their other predecessors; a deliberate gap stays). There is no "critical path" or baseline. |
| Work → teams | Only the owner sees who is in a team. A person added to a team is notified, but has no "leave team" action. |
| Busy-day alerts | Three fixed sensitivities (Sensitive, Normal, Relaxed); no custom numbers. The 6 pm push counts events, tasks, bills, Work tasks and Study items for tomorrow only. |
| Gifts, plans, add-ons | A Study or Work gift / trial always gives the normal Work size (Work Pro is granted by an administrator). |
| Language | The interface is English only. |
| Native apps | None; installable PWA only. |

## 2. Provisional decisions (the numbers can change without a release)

- The limits in `docs/srs/SRS-99-appendices.md` (Dawn / Glow / Zenith, Work / Work Pro) were chosen by the developer and can be edited in Admin → Plan limits.
- The price of Work Pro (RM25 / month) is typed into `app/core/modes.js` (`WORK_SIZES`) and the FAQ text in `app/modules/support/support.js`; change it in both places.

## 3. Operational gaps

| ID | Item | Where |
|---|---|---|
| F-OPS-1 | `scripts/deploy-functions.sh` deploys `lumi` and `send-push` but not the `account` function | `scripts/deploy-functions.sh` |
| F-OPS-2 | Stylesheets are linked without a version in their address, so a browser can keep an older copy after an update (a hard refresh fixes it). Scripts are versioned. | `app/index.html` |
| F-OPS-3 | The automated checks are not part of a CI pipeline; they run by hand (`docs/test-automation/run_all.sh`). | — |
| F-OPS-4 | The main `README.md` still says that several modules are "mock / static UI"; they are all backed by Supabase now. Treat `docs/` and `CHANGELOG.md` as current. | `README.md` |

## 4. Reported but not reproduced

| Report | What was checked | Next step |
|---|---|---|
| Settings page looked empty in Work and Study | The page renders fully in Personal, Work and Study in the headless-browser check (all cards present) | If it happens again: hard refresh, then send a screenshot and the browser name |
| Work stayed on "Loading…" after a plan upgrade | Not reproduced; Work requests now time out after 20 seconds, name the request that stalled and offer "Try again" | Check that migrations 071–085 are applied on that project |

## 5. Not yet tested on real devices

File upload on a phone, PDF printing of the timesheet, the timer running on two devices, dragging Gantt bars with a finger, feedback pictures (the `luma-feedback` bucket), push notifications on iPhone, the installed app. These are the **Device only** test cases.

## 6. Findings register (from writing the documentation)

Writing the requirements and test cases from the code turned up the items below. They are **reported by the review and have not all been reproduced**: confirm each in the cited place before fixing. Every area's complete list (about 100 items) is in the **Findings** section at the end of its `docs/tests/TC-*.md` file and in the "Risks" sections of `docs/design/`.

### 6.1 Security and abuse (look at these first)

| ID | Finding | Where |
|---|---|---|
| S-1 | Any signed-in person can call `refund_assistant` again and again, which gives their daily Lumi questions back: the daily limit can be bypassed. (Confirmed in the migration.) | migration 029 (`grant execute … to authenticated`) |
| S-2 | The "Study trial is off on production" rule exists only in the page; `start_addon_trial` works for anyone who calls it. | `app/core/modes.js`, migration 044 |
| S-3 | Wallpaper, theme and own-wallpaper plan limits are checked only in the browser; the storage policy checks only the folder. | `app/core/skins.js` / settings, migration 042 |
| S-4 | `profiles.email` can be edited by the person and has no unique index; contact requests look people up by e-mail (probing, and one person could set another's address). Whether the page blocks editing is TBC. | migrations 001, `request_contact` |
| S-5 | The contact limit can be passed: a declined request that is re-opened is an UPDATE, which the limit trigger does not check. | migration 033 |
| S-6 | The push trigger is not in the migrations (it lives in `supabase/setup/push_webhook.sql` and holds the webhook secret as a literal in a function body). A project built only from `ALL_MIGRATIONS.sql` has no push. | `supabase/setup/` |
| S-7 | Every `cron.schedule` call is inside a block that only prints a notice when it fails: without `pg_cron` the migrations "succeed" and no reminder ever runs. | migrations 014–082 |
| S-8 | Account deletion removes files first, then the sign-in; a failure in between leaves a live account with no files. It reads at most 1000 files per folder, 4 levels deep. | `supabase/functions/account` |

### 6.2 Data and limits

| ID | Finding | Where |
|---|---|---|
| D-1 | A Work limit set to "unlimited" (null) falls back to the Work Pro number in the guards (and to 5 companies in the page). | migrations 077, 078, 083, 084 |
| D-2 | Deleting a company also deletes its logged time; the confirmation mentions only projects, tasks and notes. | migration 076 cascade |
| D-3 | Deleting a semester also deletes flashcard decks and cards (the form says subjects stay); it can delete the active semester without typing DELETE. | migration 067 |
| D-4 | Restoring a semester un-archives subjects archived by hand and switches reminders back on. | Study archive |
| D-5 | After the Study add-on ends, the data is kept but cannot be seen or exported (the person is treated as a guest). "Export my data" leaves out Study data, and is mode-dependent: contacts, chat and Work projects are not exported. | `study.js`, `account` |
| D-6 | The Gantt cascade saves the dragged task and each linked task in separate requests: a failure can leave the chain half moved. | `work.views.js` |
| D-7 | Re-running migrations 033, 037, 043, 064 or 077 overwrites limits an administrator changed (`on conflict do update`). | those migrations |

### 6.3 Behaviour and screens

| ID | Finding | Where |
|---|---|---|
| B-1 | The Support form does not send anything: it clears the box and shows "Thanks! Our team will reply…". | `app/modules/support/support.js` |
| B-2 | The Terms of Service and Privacy Policy links on Register point to `#`, but the box must be ticked. | `register/index.html` |
| B-3 | The Documents upload box says "max 25 MB each"; the real limits are 5 / 20 / 50 MB by plan. | `documents.js` |
| B-4 | Invited event guests get no reminders and nobody is told when an event is edited or deleted. | `run_event_reminders` |
| B-5 | The 6 pm busy-day push counts differently from the page (all modes, double-counted overlaps, bills only on the first due date, ignores class dates and breaks). | migration 082 vs `core/busy.js` |
| B-6 | Focus mode is only a type filter (no quiet hours) and also silences plan-end warnings, gifts and busy-day alerts. | `core/appearance.js` |
| B-7 | Habit starters skip the plan check (raw database message); Lumi `log_habit` cannot complete "amount" habits. | `habits.js`, `lumi/index.ts` |
| B-8 | Editing a split entry in Money turns its category into "Other"; non-owner members get no Money entry. | `split.js`, `money.js` |
| B-9 | `@Anna Tan` also tags a person called "Ann"; tasks with only a start date are missing from the .ics export, Overview "Due soon" and reminders. | `work.js` |
| B-10 | No Contacts entry in the Study menu (group projects and note sharing need contacts); no "Leave project" button in Work; no way to remove an accepted contact on the page. | menus, `contacts.js` |
| B-11 | Undo after deleting a task, note or event does not bring back everything (budget, team, links, comments, files, attachments, guests). | various |
| B-12 | `pg_work_test` still asserts the people limit as "at most 15" (it is 8); several `ok(…, true)` checks in `pg_time_test` and `pg_move_test` always pass. | `docs/test-automation/sql` |

## 7. Documentation status

The SRS, SDD and test cases were written from the code and migrations of version 0.26.x. Where a behaviour could not be confirmed it is marked **TBC**. When behaviour changes, update the requirement, the test cases that trace to it, and the matrix (`python3 docs/build-docs.py`).
