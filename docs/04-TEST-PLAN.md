# Test Plan — LUMA

| | |
|---|---|
| Product / version | LUMA 0.26.x (staging) |
| Applies to | Personal, Work and Study modes and the shared platform |
| Test cases | `docs/tests/TC-personal-a.md`, `TC-personal-b.md`, `TC-work.md`, `TC-study.md`, `TC-platform.md` (index: `docs/tests/TC-INDEX.md`) |
| Requirements | `docs/srs/` (traceability: `docs/05-TRACEABILITY.md`) |
| Automated checks | `docs/test-automation/` |

## 1. Objectives

1. Show that every requirement in the SRS works as written, in each of the three modes.
2. Show that people cannot read or change each other's data, or use features outside their plan or add-on.
3. Show that the app is usable on a phone (320–430 px wide) and on a laptop / monitor.
4. Find regressions early: every release repeats the automated checks and the P1 manual cases.

## 2. Scope

**In scope:** everything described in the SRS parts 1–5: account, Personal, Work, Study, plans and add-ons, settings, notifications and push, busy-day alerts, feedback, support, administration, data export and deletion; the database rules (RLS, triggers, functions, cron jobs); the three Edge functions.

**Out of scope:** load testing beyond the sanity checks in section 9, penetration testing by an outside party, translation, native apps, payment gateways (payment is manual).

## 3. Test levels and approach

| Level | What | How | Who |
|---|---|---|---|
| 1. Database rules | RLS, triggers, limits, RPCs, notification creation | Automated: `docs/test-automation/sql` (PGlite, ~440 checks) | Developer, on every database change |
| 2. Screen logic | Every page renders; Work, Feedback, busy-day, date picker, teams, Gantt | Automated: `docs/test-automation/ui` (jsdom) | Developer, on every front-end change |
| 3. Edge functions | Lumi tools, account deletion, update tool | Automated syntax check + `edge/` tests; manual calls against staging | Developer |
| 4. Layout on phones | Sideways overflow of every page and popup at 320 / 360 px | Automated: `docs/test-automation/rig` (headless Chrome) | Developer |
| 5. Functional (system) | Every test case in `docs/tests/` | Manual on staging with the personas in `docs/tests/TEST-DATA.md` | QA |
| 6. Security | Cross-account access, admin-only functions, storage policies, add-on gating | The Security cases in `docs/tests/` + the SQL suites | QA + developer |
| 7. Compatibility | Chrome, Edge, Firefox, Safari (macOS), Safari on iPhone (browser and installed PWA), Chrome on Android | Manual: the Compatibility cases | QA |
| 8. Exploratory | Unscripted sessions, 60 minutes each, per mode | Charters in section 8 | QA / product owner |
| 9. Acceptance (UAT) | The product owner runs the P1 cases of each mode on staging before a release | Manual | Product owner |

## 4. Test items and environments

| Environment | Purpose | Notes |
|---|---|---|
| Local (PGlite + jsdom + headless Chrome) | Fast developer feedback | No real Supabase: no Realtime, Storage, pg_cron or Edge runtime |
| Staging (own Supabase project + Vercel site, shows "STAGING") | Manual testing, UAT, device testing | Add-ons' free trial is on for Work and Study; use test accounts only |
| Production | Smoke test after a release only | Use one dedicated test account; do not create bulk data |

Items under test are identified by `window.LUMA_VERSION` (shown under "Your Personal OS" in the side menu) and by the highest migration applied. Record both in every test run.

## 5. Entry and exit criteria

**Entry (start a test run when):** the build is deployed to staging; all migrations up to the release's last one are applied in order; the Edge functions are deployed; `run_all.sh` passes; the version number and `CHANGELOG.md` entry for the release exist.

**Exit (the release may go out when):**
- all automated checks pass (the two known jsdom messages are allowed);
- every P1 test case has been run in this release and passed (or has an accepted, written exception);
- no open defect of severity 1 or 2;
- at least 95 % of P2 cases have passed, and each failure has a defect with an owner;
- the Compatibility cases passed on Chrome, Safari (macOS) and Safari on iPhone;
- the release checklist in `docs/OPERATIONS.md` is complete.

## 6. Defect handling

| Severity | Meaning | Example | Target |
|---|---|---|---|
| 1 Critical | Data loss or exposure, cannot sign in, the app does not load, wrong person can read data | Another person's tasks visible | Fix before release, same day |
| 2 Major | A main feature does not work, no workaround | Cannot save a task; notification does not open anything | Fix before release |
| 3 Minor | Works with a workaround, or a wrong message / layout issue | Text cut off at 320 px | Fix in the next release |
| 4 Trivial | Cosmetic | Spacing, wording | When convenient |

Every defect records: test case ID, build version, environment, steps, expected vs actual, screenshot, device and browser. Defects found by users go through the in-app Feedback page (Admin → Feedback inbox) and are triaged into the same list.

## 7. Test data and accounts

`docs/tests/TEST-DATA.md` lists the personas (plan, add-ons, contacts, data) that the test cases refer to, how to create them on staging, and the data sets for boundary tests.

## 8. Exploratory charters

| Charter | Mission |
|---|---|
| Personal day | Plan a normal day: events with repeats, reminders, tasks, a bill, a habit tick. Try to make things overlap, then use the busy-day alerts. |
| Plan edges | Run each limit on Dawn up to the limit and one over; upgrade and check the limit lifts. |
| Work team | Two people, one company: project, tasks, a team, comments with @mentions, time tracking, a Gantt drag with linked tasks. |
| Work admin | Archive a company, restore it, move a project, downgrade Work Pro to Work with more than the Work limit. |
| Study semester | New semester, classes, assignments, grades, archive it, restore it. |
| Cross-mode | Create events in Work and Study, then click their notifications from the other modes. |
| Phone | The same journeys on an iPhone and an Android phone, including installing the app and receiving a push. |
| Break it | Rapid double taps, offline, expired session, two tabs, back button, huge text, empty states. |

## 9. Non-functional checks

| Area | Check | Pass |
|---|---|---|
| Performance | Open Dashboard, Calendar (month with 200 events), Work (600 tasks) on a mid-range phone over 4G | Usable in under 3 s after the data arrives; no frozen screen |
| Security | Try to read / change another account's rows through the app and through direct API calls with a second account's token | Always refused |
| Privacy | Export and delete an account | The export contains the person's data; deletion removes data and files (storage buckets included) |
| Accessibility | Keyboard use of dialogs, visible focus, contrast of hint text on bright wallpapers | No blocker |
| Resilience | Turn the network off while saving; reload during a save | A clear message; no duplicate records |

## 10. Regression strategy

- **Every change:** the relevant SQL suite and `v41_test.js`.
- **Every release candidate:** `run_all.sh` in full + all P1 test cases + the test cases linked to every changed requirement (use the traceability matrix) + a smoke run of each mode.
- **After a database migration:** `pg_boot.js` (applies all migrations), then the suites of the tables it touched, then the manual checks of the same features on staging with a real login.
- **After changing limits or plans:** the limit cases of the affected area for each plan (boundary values in `TEST-DATA.md`).

## 11. Roles

| Role | Responsibility |
|---|---|
| Product owner | Accepts the scope; runs UAT; decides on exceptions |
| Developer | Keeps the automated suites green; fixes defects; updates the docs when behaviour changes |
| QA | Plans runs, executes manual cases, logs defects, keeps `docs/tests/` current |
| Administrator (test) | Grants plans and add-ons to test accounts on staging |

## 12. Deliverables

Test plan (this file); test cases per mode; traceability matrix; execution log (`docs/tests/execution-log-template.csv` — one row per case per run); defect list; test summary report at the end of each release (counts of passed / failed / blocked by area, open defects, risks, a go / no-go note).

## 13. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Real-device behaviour (push, file upload, PDF print, finger drag) cannot be automated | Defects reach users | The "Device only" cases are run by hand on every release |
| Cron jobs (reminders, expiry, busy-day push) depend on time and on `pg_cron` | Reminders silently stop | Check the jobs exist after each deploy (`docs/OPERATIONS.md`) and run the Notification cases with a short lead time |
| Shared global scope in classic scripts: a new top-level name can collide with an old one | A page breaks only at run time | `v41_test.js` opens every page and fails on any script error |
| Settings that live in the browser (cached styles, local storage) hide or fake bugs | Wrong bug reports | Hard-refresh before every run and note the browser |
| Staging free trials and test data differ from production | Missed issues | Smoke test on production after release |

## 14. How to record a run

1. Copy `docs/tests/execution-log-template.csv` for the release (for example `execution-0.26.4.csv`).
2. For each case: Result (Pass / Fail / Blocked / N/A), tester, date, build, defect ID, notes.
3. Summarise with the counts per area; attach it to the release notes.
