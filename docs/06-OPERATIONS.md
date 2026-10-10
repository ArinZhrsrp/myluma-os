# Operations guide — deploying, releasing and keeping LUMA running

For first-time set-up of a new environment follow `docs/STAGING_SETUP.md` (screen by screen). This guide is the reference for everything after that.

## 1. Environments

| | Staging | Production |
|---|---|---|
| Git branch | `staging` (merged from `development`) | `main` (Vercel's Production Branch) |
| Website | Vercel staging site | Vercel production site |
| Supabase project | own project (`luma-staging`) | own project |
| Config | `shared/supabase-config.js` picks the project from the address the site is opened on (`PROD_HOSTS`) | same file |
| Marker | yellow **STAGING** tag; version number in the side menu | version number only |
| Add-on trials | Work and Study trials are on | Work trial is on; Study trial follows `ADDONS.study.live` in `app/core/modes.js` (off in production until switched on) |

## 2. Release flow (from `README.md`, "Staging and production")

Branches: `development` (built and tested on the developer's computer) → `staging` (testers, on the server) → `main` (**the live site**: Vercel's Production Branch is `main`). There is no `production` branch.

1. **Local.** Work on `development`; run `docs/test-automation/run_all.sh`; look at the screens with a local web server (it uses the **staging database**, so a migration that is not on staging yet cannot be tried on screen). Push (only a preview link updates). Previews and the staging site share the staging database: do not run a new migration until step 2.
2. **Staging.** Merge `development` into `staging` and push. Run the release's migrations in the **staging** SQL Editor (in order), run `python3 scripts/build-all-migrations.py`, deploy functions to staging (section 4). Bump `window.LUMA_VERSION` in `shared/supabase-config.js` and add a `CHANGELOG.md` entry. Test on staging (`docs/04-TEST-PLAN.md`).
3. **Release.** Run the same migrations in the **production** SQL Editor, deploy the functions to production, then merge `staging` into `main` and push. Vercel publishes the live site.
4. Smoke test production (section 8).

**Never push to `main` for anything that is not a release**, and never run a migration on production before its code is ready to merge. Check after any Vercel change that Settings → Environments → Production → Branch Tracking says `main`.

**Rule of thumb:** run migrations in numeric order, one at a time, and read the SQL Editor result. The app tolerates some missing newer columns (it falls back), but not all (for example, Work expects `071`–`085`).

## 3. Database

- `supabase/migrations/` — numbered, idempotent files (`001` … latest). `supabase/ALL_MIGRATIONS.sql` is all of them in one file for a brand-new project.
- Enable the `pg_cron` extension (Database → Extensions) **before** running the migrations that schedule jobs; a migration that cannot schedule its job prints a notice: enable the extension and run that file again.
- Expose the `luma` schema in Settings → Data API (exposed schemas).
- Storage buckets are created by migrations: `luma-documents`, `luma-backgrounds`, `luma-feedback`.
- `supabase/reset/00_RESET_EVERYTHING.sql` wipes the schema — staging only, never production.
- Details of every table, function and job: `docs/design/DATABASE.md`.

### Scheduled jobs (pg_cron)

There are 16 jobs (the list below is taken from the migrations; `docs/design/DATABASE.md` explains each one). After any deploy, confirm the jobs exist:

```sql
select jobname, schedule, active from cron.job order by jobname;
select jobname, status, return_message, start_time from cron.job_run_details order by start_time desc limit 30;
```

| Job (name in `cron.job`) | Schedule | What it does |
|---|---|---|
| `luma-health-reminders` | every minute | water / steps / sleep reminders at the person's chosen times |
| `luma-event-reminders` | every minute | event reminders ("starts in 15 min") and all-day heads-ups |
| `luma-class-reminders` | every minute | Study class reminders |
| `luma-habit-reminders` | every minute | habit reminders |
| `luma-custom-reminders` | every minute | the person's own reminders |
| `luma-morning-reminders` | hourly (minute 0) | morning task / bill digest reminders |
| `luma-subscription-reminders` | hourly and daily (see DATABASE.md) | subscription renewal reminders |
| `luma-budget-alerts` | hourly (minute 30) | budget threshold alerts |
| `luma-study-reminders` | hourly (minute 0) | assignment / exam reminders |
| `luma-group-task-reminders` | hourly (minute 0) | Study group task reminders |
| `luma-work-reminders` | hourly (minute 0) | Work due-date reminders |
| `luma-busy-alerts` | hourly (minute 5) | "tomorrow is busy / packed" push, sent at 18:00 in the person's time zone |
| `luma-plan-expiry` | hourly (minute 5) | plans / add-ons that ended; warnings 7 days and 1 day before |
| `luma-gift-reminders` | hourly (minute 10) | reminders about unclaimed free-access gifts |
| `luma-birthday-alerts` | hourly (minute 20) | tells each administrator, at 9 am their time, who has a birthday today or in the next 7 days |
| `luma-weekly-review` | hourly (minute 5) | sends the weekly review on Sunday 18:00 local time |

## 4. Edge functions

| Function | Deploy | JWT check | Secrets |
|---|---|---|---|
| `lumi` | `npx supabase functions deploy lumi --project-ref <ref>` | **on** (it is how Lumi knows who is asking) | `GEMINI_API_KEY` and / or `GROQ_API_KEY`; optional `LUMI_DAILY_LIMIT`, `LUMI_INSIGHTS_LIMIT`, `GEMINI_MODEL`, `GROQ_MODEL` |
| `send-push` | `npx supabase functions deploy send-push --no-verify-jwt --project-ref <ref>` | **off** — protected by the `x-webhook-secret` header instead | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:…`), `WEBHOOK_SECRET` |
| `account` | `npx supabase functions deploy account --project-ref <ref>` | **on** | none of its own (uses the project's `SUPABASE_*` values) |

`scripts/deploy-functions.sh staging|prod` deploys **`lumi` and `send-push` only**. Deploy `account` separately (or add it to the script) — otherwise "Delete my account", "Export my data" and the admin delete will fail or use an old version. (Finding F-OPS-1.)

Set secrets per project: `npx supabase secrets set KEY=value --project-ref <ref>`.

**Push webhook:** Supabase dashboard → Database → Webhooks → table `luma.notifications`, event Insert, type Edge Function → `send-push`, with the HTTP header `x-webhook-secret` equal to `WEBHOOK_SECRET`. (`supabase/setup/push_webhook.sql` contains the SQL form.) Without it, notifications appear in the bell but no push reaches the phone.

**Client keys:** the public VAPID key goes in `shared/push-config.js`; the WhatsApp number for plan / add-on requests in `shared/plan-config.js` (`window.LUMA_WHATSAPP`).

## 5. Authentication settings (per Supabase project)

- Confirm e-mail on (6-digit code flow, see `README.md`), with the e-mail template that contains the code; a custom SMTP sender for production (the built-in sender is rate limited).
- URL Configuration: site URL and redirect URLs for that environment (the reset-password link opens the site of the environment it was requested from).
- Password reset links and confirmation links cannot be tested from `localhost` unless the redirect list contains it.

### 5a. Sign in with Google and Apple

The Login and Register pages have a **Google** button and an **Apple** button (Apple is shown only on iPhone, iPad and Mac). The buttons use Supabase Auth, so each provider must be switched on **per Supabase project** (staging and production separately) before it works. Until then, pressing a button ends on a Supabase error page.

**Every project: allow the return address.** Supabase → Authentication → URL Configuration: add `https://<your site>/login/` to *Redirect URLs* (and `http://localhost:8000/login/` for local tests). People come back to `/login/`, which opens the app.

**Google**
1. Google Cloud Console → *APIs & Services* → *OAuth consent screen*: user type External; app name LUMA; support e-mail; a link to a privacy policy and terms page (**the Terms and Privacy links on Register are placeholders today, so write these pages first**); authorised domains `supabase.co` and your site's domain. Scopes: the defaults (`openid`, `email`, `profile`).
2. *Credentials* → *Create credentials* → *OAuth client ID* → *Web application*. *Authorised redirect URI*: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. Copy the **Client ID** and **Client secret**.
3. Supabase → Authentication → Providers → **Google**: enable, paste both, save.
4. While the consent screen is in *Testing*, only the test users you list can sign in; press *Publish app* before real people use it.

**Apple** (needs a paid Apple Developer account)
1. Apple Developer → *Identifiers*: an **App ID** with the *Sign in with Apple* capability, then a **Services ID** (for example `com.yourname.luma.web`) with *Sign in with Apple* configured: *Domains* = `<PROJECT_REF>.supabase.co`, *Return URL* = `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
2. *Keys* → create a key with *Sign in with Apple*; download the `.p8` file (only once) and note the **Key ID**; your **Team ID** is in *Membership*.
3. Make the **client secret**: a signed token built from the `.p8`, Team ID, Key ID and the Services ID (Supabase's Apple-provider page links a generator). **It expires after at most 6 months, and Apple sign-in stops working the day it does: put a reminder in your calendar to make a new one and paste it in.**
4. Supabase → Authentication → Providers → **Apple**: enable, *Client ID* = the Services ID, *Secret key* = the token from step 3, save.

**Good to know**
- **Register creates, Login never does.** Pressing Google / Apple on the **Register** page (with the Terms box ticked) creates the account and marks it registered; no form is filled in. Pressing it on the **Login** page with an ID that has no LUMA account does not keep anything: Supabase creates the account the moment Google says yes, so the Login page deletes it again (using the `account` function, which therefore **must be deployed**) and says "Press Create one and register with Google first". Keep *Authentication → Sign In / Providers → Allow new users to sign up* **on**: the rule is enforced by LUMA, not by Supabase.
- A new Google / Apple sign-in from Register creates the account (no e-mail code step). The name comes from the provider; Apple sends it only the very first time, and "Hide my e-mail" gives an `@privaterelay.appleid.com` address.
- If someone already has an e-mail account with the same verified address, Supabase links the sign-in methods when *Authentication → Settings → "Link accounts with the same e-mail"* is on (check the setting in each project).
- The first sign-in fills the time zone and country from the browser (once); people can change them in Settings → Profile.
- Test with a real phone: Safari on iPhone for Apple, and any browser for Google. The test cases are `TC-AUTH-031` to `TC-AUTH-042`.

## 6. Monitoring and routine checks

| When | Check |
|---|---|
| Daily | Admin → Feedback inbox (new items); Supabase dashboard → Logs for Edge function errors (`lumi`, `send-push`, `account`) |
| Weekly | Admin → Plan report and Work report (people per plan, trials); `cron.job_run_details` for failures; storage usage per bucket |
| Monthly | Review add-ons and plans that end soon (Admin shows end dates); database size and backups; rotate secrets if people with access changed |
| After each deploy | The release checklist (section 8) |

## 7. Backup, restore and data requests

- Backups: use Supabase's project backups (daily on paid plans; on the free plan take a manual dump before risky migrations: `supabase db dump`).
- Restore: restore to a new project first, check, then switch.
- Data export / deletion requests from people: Settings → Account & data (self-service). An administrator can delete an account from Admin (the `account` function removes data, files and the sign-in).
- Rolling back a migration: migrations are forward-only. Write a new numbered migration that reverses the change; for a bad release, roll the website back in Vercel (Deployments → Promote a previous deployment) and keep the database change if it is backward compatible.

## 8. Release checklist

**Before**
- [ ] `docs/test-automation/run_all.sh` passes.
- [ ] Migrations for the release are in order and re-runnable; `ALL_MIGRATIONS.sql` rebuilt.
- [ ] `LUMA_VERSION` bumped; `CHANGELOG.md` entry written; `README.md` migration list updated.
- [ ] P1 test cases of the changed areas passed on staging.

**Deploy**
- [ ] Migrations applied on the target project, in order, no errors.
- [ ] Edge functions deployed: `lumi`, `send-push` (`--no-verify-jwt`), `account`.
- [ ] Secrets present; push webhook exists.
- [ ] Website deployed; hard refresh; the version in the side menu is the new one.

**After (smoke test, 10 minutes, one test account)**
- [ ] Register / sign in / sign out.
- [ ] Dashboard loads; add a reminder, an event and a task; they show on the Calendar.
- [ ] Switch to Work (if the account has it): the company, a project, a task, the Teams and Time tabs open.
- [ ] Switch to Study: Overview, Timetable, Assignments open.
- [ ] Bell: create a reminder due in 2 minutes; the notification arrives (and the push on a phone).
- [ ] Settings → plan card shows the right plan and add-ons; the Feedback page sends a message.
- [ ] `select jobname, active from cron.job;` shows every job active.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| A page shows a message about running a migration | The migration for that feature has not been applied on this project | Run the named file(s) in order |
| Work shows "Loading…" or "Could not load" | A Work migration (071–085) is missing, or a request timed out (the page now names the request after 20 seconds) | Apply missing migrations; press "Try again" |
| Reminders / busy-day push never arrive | `pg_cron` not enabled, or a job inactive; or no push webhook | Enable the extension, re-run the migration that schedules the job; check `cron.job`; create the webhook |
| Push works on desktop but not on iPhone | The app is not installed to the Home Screen, or notifications not allowed | Add to Home Screen (iOS 16.4+), allow notifications, press Enable in Settings |
| Styles look wrong after an update | The browser holds an older stylesheet | Hard refresh (Cmd+Shift+R) |
| "Delete my account" fails | `account` function not deployed on this project | Deploy it (section 4) |
| Lumi answers "limit reached" or does not act | Daily limit for the plan; "Lumi actions" is off for Dawn | Expected; check `plan_limits` |
| Someone cannot sign in after registering | E-mail not confirmed (code expired) | They sign in again: a fresh code is sent |
