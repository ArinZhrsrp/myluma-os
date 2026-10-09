# Automated checks

These scripts check LUMA automatically. They do **not** replace the manual test cases in `docs/tests/` (those cover what a script cannot: real phones, real files, real e-mail, look and feel). Each test case says in its **Automation** line which script covers it.

## What is here

| Folder | What it does | Needs |
|---|---|---|
| `sql/` | Boots an in-memory Postgres (PGlite), applies every migration in order, then tests the database rules: RLS (who can read / change what), triggers, limits, security-definer functions, notifications. | Node |
| `ui/` | Loads the real app in a simulated browser (jsdom) with a fake Supabase client and walks the screens: `v41_test.js` opens every page and fails on any script error; `v49_test.js` exercises Work, Feedback, busy-day alerts, date picker, teams, Gantt cascade; `v30_test.js` holds the demo data the phone-width rig reuses. | Node |
| `edge/` | Small tests that load the Edge-function source or a page script in isolation (Lumi tools, space filter, reset-password page, account deletion, update tool). | Node |
| `rig/` | A headless-Chrome rig: serves the app on `http://localhost:8765` with a stub back end and checks every page and popup for sideways overflow at 320 and 360 px wide; also takes screenshots (`shot.sh`, `wshot.sh`). | Chrome on macOS, Python 3 |
| `run_all.sh` | Runs all of the above and prints a summary. | all of the above |

## Set up and run

```bash
cd docs/test-automation
npm install            # PGlite, jsdom, esbuild (see package.json)
./run_all.sh           # about 5–6 minutes
```

The scripts find the project folder three levels up; set `LUMA_ROOT=/path/to/myluma-os` if you copy them elsewhere. A single suite: `node sql/pg_team_test.js`. The macOS `timeout` helper in `run_all.sh` is `perl -e 'alarm N; exec @ARGV'`.

## What the database suites check (last run, version 0.26.x: all passed)

| Suite | Checks | Covers |
|---|---|---|
| `pg_boot.js` | 85 migrations | Every migration file applies cleanly in order |
| `pg_work_test.js` | 35 | Work projects, tasks, members, roles, RLS, assignees, invitations |
| `pg_phase_test.js` | 15 | Project phases and general-project folders |
| `pg_company_test.js` | 27 | Companies, archive freeze, restore, delete, limits |
| `pg_wfiles_test.js` | 25 | Task comments (edit history), files, document sharing |
| `pg_time_test.js` | 31 | Timer, manual entries, 24 h cap, summaries, team time |
| `pg_wreminder_test.js` | 17 | Due-date reminders, Work / Work Pro limits, `my_limits` |
| `pg_move_test.js` | 25 | Moving tasks and projects, edit history |
| `pg_extras_test.js` | 20 | Task links and loop check, time budgets, @mentions, admin Work report |
| `pg_team_test.js` | 25 | Teams, limits, visibility, notifications |
| `pg_feedback_test.js` | 18 | Feedback rows, notifications to admins, status updates, daily cap |
| `pg_busy_test.js` | 29 | Busy-day statistics, 6 pm push, Work sizes in admin, plan-limit editor |
| `pg_study_test.js` | 71 | Study: semesters, notes sharing, group projects, archive, grade scales |
| `pg_study2_test.js` | — | Extra Study checks (not part of `run_all.sh`) |
| `pg_split_test.js` | 27 | Split expenses |
| `pg_admin_test.js` | 31 | Admin plan / add-on functions, user list, bulk access |
| `pg_tasks_test.js` | 14 | Personal tasks rules |
| `pg_gift_test.js` | 21 | Free-access gifts |
| `pg_refs_test.js` | 10 | Notification `ref` values used for click-through |

## Known harmless messages

`ui/v49_test.js` prints two jsdom limitations at the end (`Not implemented: navigation to another Document`, `URL.revokeObjectURL is not a function`). They come from the simulated browser (file download / navigation), not from LUMA.

## What these checks cannot see

Real devices (iPhone push, install to Home Screen, file upload, PDF printing, finger drag on the Gantt chart, timer on two devices), real e-mail links, real Supabase (Realtime, Storage, pg_cron, Edge-function runtime), visual quality, and performance. Those are manual or "Device only" in the test cases.

## Adding a test

1. Database rule: copy the closest `sql/pg_*_test.js`, keep the `boot()` call, create users with `insert into auth.users`, act as a person with `as(userId, sql)`, and assert with `ok(name, condition)`. Add the suite name to the `for t in …` list in `run_all.sh`.
2. Screen: add a block to `ui/v49_test.js` (it has helpers `ev(js)`, `wait(ms)`, `txt(el)`), then check the printed line.
3. Update the **Automation** line of the matching test cases and `docs/04-TEST-PLAN.md`.
