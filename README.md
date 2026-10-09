# myluma-os

> LUMA is an AI personal operating system with a calm glass dashboard for tasks, notes, documents, health and contacts, built with plain HTML/JS and Supabase.


LUMA is an AI personal operating system — a calm, glassmorphism dashboard that
unifies calendar, tasks, finances, habits and more into one surface, with an
AI assistant (**Lumi**) built in. This folder is the standalone, runnable
slice of that product: authentication is real (backed by Supabase), the rest
of the dashboard is currently a working UI prototype over mock data.

## Stack

Plain HTML/CSS/JS — no build step, no framework, no bundler. Each page is a
single self-contained `.html` file. The only external dependency is
[Supabase](https://supabase.com) (Postgres + Auth), loaded client-side via
its JS SDK from a CDN.

## What's real vs. mock right now

**Real, backed by Supabase:**
- Registration (email + password), with email confirmation handled either way
- Login / logout, with session persisted across visits — or, if "Remember me"
  is unticked, only until the browser/tab is closed
- Password reset (forgot-password email → reset page)
- The dashboard is session-gated — you can't reach it while signed out
- Your real name/email/avatar initial appear in the dashboard greeting and
  Settings → Profile
- **Tasks & Work** — a three-column board (To do / In progress / Done) backed
  by `luma.tasks`; add, advance, reopen and delete tasks. See
  `app/modules/tasks/tasks.data.js`.
- **Documents** — upload files (private Supabase Storage, 25 MB each), rename
  them, file them under categories, filter by category, preview them in-app (images, PDFs, Word .docx, Excel/CSV sheets, video, text), share them read-only with
  accepted contacts, delete. Categories are per-user and editable (add / rename /
  delete). See `app/modules/documents/documents.data.js`.
- **Notes & Docs** — create/edit/delete notes with tags, search and tag
  filters, and attach documents from the Documents menu (own files or files
  shared with you), or upload a file straight from the note. See
  `app/modules/notes/notes.data.js`.
- **Health** — log a day (sleep, water, steps, active minutes, mood, note), set
  daily goals, see today's rings, 7-day mood/sleep/steps charts and recent
  entries (edit/delete); one-tap +250 ml water. See `app/modules/health/health.data.js`.
- **Habits** — create habits (icon, colour, goal, repeat days), tick them off for today or any of the last 7 days, streaks, consistency heat-map and weekly chart; the dashboard's Habit Streaks widget shows your top 3. Run `016_habits.sql`. See `shared/luma-habits.js`.
- **Notifications** — a bell with an unread badge; the dropdown shows today's
  notifications with *Mark all as read* and *See all notifications* (full page,
  grouped by day, All/Unread filter, delete). Created by database triggers for:
  welcome after registration, a document shared with you, and contact
  requests / acceptances. New ones slide in live as a toast. See
  `app/modules/notifications/notifications.data.js`.
- **Contacts** — add another LUMA user by email (request → accept, not
  instant), 1:1 chat with accepted contacts (realtime, via Supabase), and a
  "Follow-ups" panel for contacts you haven't messaged in 7+ days, and a **Nudge**
  button that sends the contact a notification to read your message. See
  `luma.contacts` / `luma.messages` in the schema and `app/modules/contacts/contacts.data.js`.

**Still mock / static UI:** every other dashboard module — Calendar,
Money, Subscriptions, Bills, Goals, Habits,
Analytics, the Lumi chat replies. These render and are interactive in the
browser, but nothing persists to a database yet. The
migrations in `supabase/migrations/` set up the `luma` schema (profiles,
contacts, messages, tasks, documents) that each of those modules builds on next.

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com) (or reuse one — see
*Multi-project workspaces* below). From **Project Settings → API**, copy the
**Project URL** and the **`anon` / `publishable`** key into
[`shared/supabase-config.js`](shared/supabase-config.js):

```js
window.LUMA_SUPABASE_URL = "https://xxxxx.supabase.co";
window.LUMA_SUPABASE_ANON_KEY = "sb_publishable_xxxxx";
```

This key is safe to expose client-side by design — access control is
enforced by Row Level Security on the database side, not by hiding the key.

### 2. Database schema

Open **SQL Editor** in the Supabase dashboard and run each file in
[`supabase/migrations/`](supabase/migrations/) in numeric order (all are safe
to re-run). `001_profiles_contacts_chat.sql` creates:
- a dedicated `luma` Postgres schema (kept separate from `public`, so this
  project's tables never collide with another project's tables in the same
  Supabase instance)
- `luma.profiles` — one row per user (name, email, plan), row-level-secured
  so a user can only read/write their own row
- a trigger that auto-creates a `luma.profiles` row on signup
- `luma.contacts` — a request/accept relationship between two users, plus
  `luma.messages` for the chat between an accepted pair, both row-level-secured
  to their participants; a `request_contact(email)` RPC to add someone (looking
  them up server-side, since the client can't read other users' profiles
  directly) and a `list_contacts()` RPC for the Contacts page

`003_documents.sql` adds `luma.documents`, `luma.document_categories` (seeded
with defaults per user) and a private `luma-documents` Storage bucket with
per-user-folder policies.

`004_document_sharing.sql` adds `luma.document_shares`: share a document with
an accepted contact (read-only; the database enforces both rules, including
access to the underlying file).

`014_server_reminders_and_push.sql` runs the reminder job on the server and stores
Web Push subscriptions (see *Background reminders & push*).

`013_health_reminders.sql` adds `luma.health_reminders` (per-user settings),
`bedtime` / `wake_time` on health logs, and `luma.push_reminder()` which lets the
app create a rate-limited reminder notification for the signed-in user.

`012_health_quick_add.sql` adds the per-user quick-add amounts used by the + / −
buttons on each Health ring.

`011_health.sql` adds `luma.health_logs` (one row per user per day, every metric
optional) and `luma.health_goals` (daily targets).

`010_message_notifications.sql` notifies the receiver of every new chat message
(one rolling notification per conversation while unread).

`009_nudges.sql` adds `luma.nudge_contact()`: the other person in an accepted
contact gets a push-style notification (limited to one per 3 minutes per sender → receiver).

`008_notifications.sql` adds `luma.notifications` and the triggers that fill it
(registration, document shares, contact requests); clients can read, mark read
and delete their own, but never insert.

`006_colors.sql` adds a `color` to document categories and a `luma.note_tags`
table holding per-user tag colours (10-colour palette; new ones start random).

`005_notes.sql` adds `luma.notes` and `luma.note_documents` (links a note to
documents it references).

`002_tasks.sql` adds `luma.tasks` (title, status, priority, tag, due date),
row-level-secured to its owner, with a trigger that stamps `completed_at`.

Then expose the schema to the API: **Project Settings → API → Exposed
schemas** → add `luma` to the list (default is just `public`). Without this
step, `luma.profiles` exists in the database but the client can't query it.

### 3. Auth behavior

**Authentication → Sign In / Providers → Email → Confirm email** controls
whether new accounts need to click an email link before they can sign in:
- **On** (Supabase's default): `signUp()` sends a confirmation email; no
  session until it's clicked. Register.html shows a "check your email"
  message in this case.
- **Off**: `signUp()` returns an active session immediately — useful for
  local development so you're not gated on a real inbox. Supabase's shared
  default mailer also rate-limits outgoing email fairly aggressively
  (roughly a handful per hour), which this avoids entirely.

Either way, use a real email address for password reset. The configured
Supabase project also blocks reserved placeholder domains such as
`@example.com` and `@test.com`.

### 4. Run it

No build step — just serve the folder statically (opening the files directly
via `file://` mostly works, but a local server avoids some browser quirks
around storage and auth redirects):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/LUMA%20Login.html`. If you want the
password-reset email link to land back on this app, set **Authentication →
URL Configuration → Site URL** (and add to **Redirect URLs**) to match
wherever you're serving it from, e.g. `http://localhost:8000`.

## Deploying to Vercel (via GitHub)

The app is static (no build step), so Vercel just serves the folder.

1. Create an empty repository named `myluma-os` on GitHub, then from this folder:
   ```bash
   git remote add origin https://github.com/<your-user>/myluma-os.git
   git push -u origin main
   ```
2. At [vercel.com](https://vercel.com) choose **Add New → Project**, import the repo, and
   leave everything at its defaults (Framework: *Other*, no build command, output
   directory `.`) and keep the project name `myluma-os`. Every later `git push` redeploys automatically.
3. In Supabase → **Authentication → URL Configuration** set **Site URL** to your Vercel
   address (`https://myluma-os.vercel.app`) and add it under **Redirect URLs**, so
   password-reset and email-confirmation links come back to the live app.

`index.html` forwards the site root to the sign-in page; `vercel.json` stops browsers
caching the pages and the service worker, so a new deploy shows up on the next load.
The Supabase *publishable* key in `shared/supabase-config.js` is meant to be public — never
commit the Supabase service-role key or the VAPID private key.

## Background reminders & push (optional)

Health reminders work in two layers, and you can stop after the first:

**1. Server-side reminders — no extra services.** Run
`supabase/migrations/014_server_reminders_and_push.sql`. It schedules a job
(`pg_cron`, every minute) that creates the water / steps / sleep reminder
notifications on the server at the times you set, so they are waiting in the bell
whenever you open LUMA — even if the app was closed at the time. If the file prints
a notice that the job couldn't be scheduled, enable **Database → Extensions →
pg_cron** in the Supabase dashboard and run the file again. (The in-app timer still
runs as a fallback; the two never send the same reminder twice.)

**2. Push to the device while LUMA is closed — Web Push.** This also delivers
messages, nudges, shares, etc. To set it up:

1. Serve the app over `http://localhost` or `https` — service workers don't run from
   `file://`. (`python3 -m http.server 8000`, then open `http://localhost:8000/LUMA%20Login.html`.)
2. Generate keys once: `npx web-push generate-vapid-keys`. Put the **public** key in
   [`shared/push-config.js`](shared/push-config.js).
3. Deploy the Edge Function and give it its secrets:
   ```bash
   supabase functions deploy send-push --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=<a long random string>
   ```
4. In the Supabase dashboard go to **Database → Webhooks → Create a new hook**: table
   `luma.notifications`, event **Insert**, type **Supabase Edge Functions** →
   `send-push`, and add the HTTP header `x-webhook-secret` with the same
   `WEBHOOK_SECRET` value.
5. In LUMA open **Health → Reminders → Notifications on this device → Enable** on each
   device you want notifications on.

The service worker (`sw.js`, same folder as the pages) shows the notification only
when no LUMA window is in front, and tapping it opens the right page. On iPhone/iPad,
push only works once LUMA is added to the Home Screen.

## Lumi assistant (free AI, optional)

Lumi (the chat bubble + the Lumi page + "Get AI insights" in Analytics) runs through the `lumi` Edge Function, which calls a free-tier
model: **Gemini first, Groq as the fallback**. Each user gets **15 chat questions per day** (and 10 AI-insight requests per day).
Lumi can add events / tasks / notes / expenses and log health; it can't delete anything, and it only answers about LUMA.

1. Run `supabase/migrations/029_assistant.sql` in the SQL Editor.
2. Get free keys: Gemini → https://aistudio.google.com/apikey · Groq → https://console.groq.com/keys (one of them is enough; both = automatic fallback).
3. Store them on the server (never in the page):
   `npx supabase secrets set GEMINI_API_KEY=... GROQ_API_KEY=...`
   (or Dashboard → Edge Functions → Secrets). Optional: `LUMI_DAILY_LIMIT`, `LUMI_INSIGHTS_LIMIT`, `GEMINI_MODEL`, `GROQ_MODEL`.
4. Deploy: `npx supabase functions deploy lumi` (leave JWT verification ON — it is how Lumi knows who is asking).

## Plans (Dawn / Glow / Zenith)

New accounts start on **Dawn** (free); on the first login they are offered the plans once. Picking Glow or Zenith opens WhatsApp with
their name, email, plan and price already typed in, so you can arrange payment and then upgrade them by hand.
1. Run `supabase/migrations/033_plans.sql` (existing accounts become Zenith so nobody loses anything). Re-deploy the Lumi function.
2. Put your WhatsApp number in `shared/plan-config.js` (`window.LUMA_WHATSAPP`, international format, digits only, e.g. `60123456789`).
3. To change someone's plan: `update luma.profiles set plan = 'glow' where email = 'them@example.com';` (users cannot change their own plan).
4. Every limit lives in the `luma.plan_limits` table. Edit a row to change a limit (NULL = unlimited).

## Email verification (6-digit code) and the admin account

**How sign-up works now:** Register → we email a 6-digit code → the person types it on `/verify-email/` → they are verified and
signed in at once. People who try to sign in before verifying are sent a fresh code automatically.

Set this up in the Supabase dashboard (one time):
1. **Authentication → Providers → Email:** keep **Confirm email ON**.
2. **Authentication → Emails → Templates → "Confirm signup"** — subject `Your LUMA verification code`, body:
   ```html
   <h2>Welcome to LUMA</h2>
   <p>Your verification code is:</p>
   <p style="font-size:32px;font-weight:700;letter-spacing:8px">{{ .Token }}</p>
   <p>Enter it on the sign-up page. If you didn't create an account, ignore this email.</p>
   ```
3. **Authentication → Emails → the "SMTP Settings" tab** (direct link: `https://supabase.com/dashboard/project/<your-project-ref>/auth/smtp`): switch on **Custom SMTP** with a real email provider (Resend, Brevo, Gmail SMTP, …).
   Supabase's built-in sender is limited to a handful of emails per hour and is only meant for testing, so real sign-ups will not get their codes without this.
4. **Authentication → URL Configuration:** Site URL `https://myluma-os.vercel.app`, and add `https://myluma-os.vercel.app/**` to Redirect URLs.

**Admin account:** run `supabase/migrations/036_admin.sql`, register your own account on the site (verify it), then in the SQL Editor:
```sql
insert into luma.admin_users (user_id) select id from auth.users where email = 'YOUR-EMAIL' on conflict do nothing;
update luma.profiles set plan = 'zenith' where email = 'YOUR-EMAIL';
```
An **Admin** page then appears in your sidebar: every account, search, and a plan dropdown per account (your own included). Each change is
logged in `luma.plan_changes` and the person gets a notification. Only accounts in `luma.admin_users` can use it, and that table can only be edited in the SQL Editor.

**Fresh start:** `supabase/reset/00_RESET_EVERYTHING.sql` erases every account and all data (it refuses to run until you delete its safety guard).
Empty the `luma-documents` Storage bucket by hand afterwards.

## Staging and production

**Version:** the line under "Your Personal OS" ("Version 0.9.0 · STAGING") comes from `window.LUMA_VERSION` in `shared/supabase-config.js`. Bump it when you push to staging: patch (0.9.1) for fixes and small tweaks, minor (0.10.0) for a new feature or module, and 1.0.0 for the first production release. Describe each change in `CHANGELOG.md`.

Two Supabase projects, two websites, three git branches, one codebase:

| Branch | Purpose | Website | Supabase |
|---|---|---|---|
| `staging` | where every change is built and tried first | the staging site (`myluma-os-staging.vercel.app`) | the **staging** project (test accounts) |
| `main` | approved code, the source of truth (nothing deploys from it to users) | preview link only | none |
| `production` | exactly what real users get | `myluma-os.vercel.app` | the **production** project |

`shared/supabase-config.js` picks the Supabase project from the address the site is opened on (`PROD_HOSTS`), so the same code runs in both.
Staging shows a yellow STAGING tag in the corner.

**Releasing a change**
1. `git checkout staging`, make the change, `git push`. Vercel updates the staging site.
2. Database change? Add a numbered file in `supabase/migrations/` and run it in the **staging** SQL Editor. Function change? `./scripts/deploy-functions.sh staging`.
3. Test on the staging site with test accounts.
4. Approved: `git checkout main && git merge staging && git push`.
5. Release: run the same migration in the **production** SQL Editor, `./scripts/deploy-functions.sh prod`, then
   `git checkout production && git merge main && git push`. Vercel publishes production.
6. `python3 scripts/build-all-migrations.py` refreshes `supabase/ALL_MIGRATIONS.sql` (used to set up a brand-new project).

Each Supabase project has its own settings that you set once: Authentication (confirm email, email template, SMTP, URL Configuration with that environment's address),
the `luma` schema exposed in the Data API settings, the Edge Function secrets, and the database webhook for push.

## File structure

```
index.html                   Site root: sends visitors to /login/
login/                       Sign-in page                (index.html, login.css, login.js)
register/                    Sign-up page
verify-email/                6-digit email code page
reset-password/              Password-reset landing page (opened from the email link)
app/                         The main app (needs a signed-in session)
  index.html                 Shell: lists the stylesheets, then core/boot.js starts everything
  core/                      Shared by every module
    boot.js                  Fetches the markup, puts it in place, then loads the scripts in order
    core.css, shell.html     The shared look (layout, cards, buttons, popups) + sidebar / top bar
    router.js                Menu, pages (goTo), and the MODULES / WIRE registries each module fills
    modes.js                 Personal / Work / Study switcher and the add-on popup (shared/luma-space.js files each item under the mode)
    ui.js  time.js  dialogs.js  session.js  appearance.js  shell.js  push.js
    plans.js search.js dirtywatch.js skins.js      Plans popup, global search, themed pickers…
    start.js                 Signed-in start-up (runs last)
  modules/<name>/            ONE FOLDER PER MODULE
    <name>.html              its page markup and popups   (<!--@page--> and <!--@modals--> sections)
    <name>.css               its styles
    <name>.js                its code (renderer, wiring, popups)
    <name>.data.js           its Supabase helpers (when it has a table)
    dashboard  calendar  work  study  tasks  reminders  money  bills  subscriptions  goals  habits  health
    notes  documents  contacts  assistant (Lumi)  analytics  settings  support  notifications
    focus  admin  adminreport
shared/                      Used by every page: supabase-config.js, luma-auth.js, luma-loader.js,
                             luma-plan.js, plan-config.js, push-config.js, recovery-redirect.js,
                             luma-mark.svg, luma-ambient-bg.jpg
sw.js                        Service worker (shows push notifications)
supabase/migrations/
  001_profiles_contacts_chat.sql   profiles, contacts, messages, read markers
  002_tasks.sql                    tasks
  003_documents.sql                documents, nested categories, storage bucket
  004_document_sharing.sql         share documents with accepted contacts
  005_notes.sql                    notes + links to documents
  006_colors.sql                   user-chosen colours for categories and tags
  007_shared_document_categories.sql   file shared documents under your own categories
  008_notifications.sql            notifications table + triggers + realtime
  009_nudges.sql                   nudge a contact (rate-limited notification)
  010_message_notifications.sql    notify the receiver of new chat messages
  011_health.sql                   health logs + goals
  012_health_quick_add.sql         configurable quick-add amounts for the rings
  013_health_reminders.sql         water / steps / sleep reminders + bedtime & wake-up time
  014_server_reminders_and_push.sql  server-side reminder job (pg_cron) + push subscriptions
  015_active_reminder.sql      "Stay active" reminder
  016_habits.sql               habits + daily check-ins (streaks are worked out in the app)
  017_habit_periods.sql        daily / weekly / monthly habits, amounts (5 pages, 30 min), sleep habit from Health
  018_habit_reminders.sql      per-habit reminder time (pg_cron job → notification → push)
  019_goals.sql                goals with a target, progress, deadline and category
  020_bills.sql                bills (once / monthly / yearly) and their payments
  021_bill_active.sql          pause a subscription (hides it from Bills)
  022_bill_weekly.sql          weekly bills / subscriptions
  023_money_country.sql        Money (income, budget, entries) + country on profiles
  024_money_pcb.sql            use the PCB amount from your own payslip
  025_subscription_reminders.sql  daily job: notification / push 3 days before a subscription renews
  026_task_notes.sql           notes on tasks
  027_events.sql               calendar events
  028_timezone.sql             time zone (GMT) per user — dashboard times + push reminders follow it
  029_assistant.sql            Lumi assistant daily question limit (15 per user per day)
  030_more_reminders.sql       event / task / bill / goal reminders + budget alerts (inbox + push)
  031_reminder_prefs.sql       Settings → Reminders: on/off + timing per reminder type
  032_reminders.sql            Reminders page: your own reminders (e.g. last weekday of the month), inbox + push
  033_plans.sql                plans Dawn / Glow / Zenith: limits table + enforcement (existing accounts become Zenith)
  035_more_reminder_prefs.sql  Settings → Reminders: habits + health on/off, budget warning percentage
  043_more_wallpapers.sql      11 built-in wallpapers (Dawn 4, Glow 8, Zenith all)
  044_addons.sql               Work / Study add-ons: who has them, 7-day trial, Admin switches
  045_study.sql                Study v1: subjects, timetable, assignments, reminders, Focus subject tag
  046_fix_addon_policies.sql   Fix: Study rules call luma.has_my_addon (users can't call has_addon)
  047_study_class_dates.sql    Timetable classes can run for N weeks / months / until a date
  048_event_invites.sql        Invite contacts to calendar events (accept / decline, guest list)
  049_study_v2.sql             Study v2: semesters, subject target / final marks (GPA, CGPA)
  050_spaces.sql               Work / Study keep what you create there out of Personal (a `space` on each item)
  051_assistant_pending.sql    Lumi can delete your own items, only after a preview and a yes
  052_study_extras.sql         Cancelled class dates, breaks and holidays, class reminders ("starts in 15 min")
  053_study_notes.sql          Notes per subject, shareable with contacts (read-only for them)
  054_study_groups.sql         Group projects: invite classmates, tasks, shared notes, nudges
  055_study_semester_archive.sql  Archive a whole semester (Study → Archive)
  056_study_active_semester.sql  One ACTIVE semester at a time; everything new in Study goes into it
  057_delete_archived_semester.sql  Delete an archived semester and everything in it for good
  058_study_groups_extras.sql  Group projects: comments, files, task reminders, anyone can start one
  059_study_notes_extras.sql   Shared notes you can edit together; files on notes
  060_study_reminders_v2.sql   Own reminder per assignment, timed items, overdue nudges; archived semesters stay quiet
  061_grade_scales.sql         Grade scale per semester or subject
  062_plan_expiry.sql          Plans and add-ons run for a period: end dates, automatic return to Dawn, admin sets or adds time
  063_purchase_history.sql     Purchase history: every plan and add-on change (trial, started, extended, removed, ended) kept per person
  064_split_expenses.sql       Split expenses (Zenith): shared bills, who paid, shares, mark-as-paid, your share in Money
  042_backgrounds.sql          your uploaded wallpaper is saved with your account (private storage bucket)
  041_focus_sessions.sql       Focus mode: every completed focus session is saved
  040_admin_report.sql         Admin page: monthly report of people per plan + log of every plan change
  039_lock_health_reminder_times.sql  Dawn: Health reminder times fixed (Glow / Zenith can choose)
  038_lock_budget_pct.sql      Dawn: budget warning level fixed at 80% (Glow / Zenith can choose)
  037_chat_limit.sql           chat: 50 messages a day per person on every plan (luma.plan_limits 'chat_messages')
  036_admin.sql                super admin: Admin page, change anyone's plan (audit log)
  034_weekly_review.sql        Sunday 18:00 weekly review notification (Settings → Preferences → Weekly review)
```

### How the app starts, and adding a module
`app/index.html` loads the stylesheets and the shared helpers, then `app/core/boot.js` fetches every module's `.html`, builds the page
(sidebar, one container per page, popups), and finally loads the scripts one after another in the order listed in `boot.js`
(core first, then modules, then `skins.js` and `start.js`). All scripts share one global scope, so a module can use helpers from
`core/` directly (`docEl`, `card`, `luConfirm`, `flashToast`, `goTo`…).

To add a module `foo`: create `app/modules/foo/foo.html|css|js`, register its page with `MODULES.foo = function () { … }` and its wiring
with `WIRE.foo = function (pg) { … }`, then add its files to `app/index.html` (css) and `app/core/boot.js` (markup + script lists, and its
page name in `PAGES`) and a menu item in `app/core/shell.html`.

`shared/luma-auth.js` exposes a global `LumaAuth` object used by every page:
`signUp`, `signIn`, `signOut`, `sendPasswordReset`, `updatePassword`,
`getSession`, `requireSession` (guards a page, redirects signed-out visitors
to Login), `redirectIfSignedIn` (sends already-signed-in visitors away from
Login/Register), `getProfile` / `updateProfile` (reads/writes `luma.profiles`),
and `displayName` / `fullName` / `initial` (formatting helpers for the UI).

`app/modules/contacts/contacts.data.js` (dashboard only, depends on `luma-auth.js` for its
Supabase client) exposes `LumaContacts`: `requestByEmail`, `listContacts`,
`acceptRequest` / `declineRequest` / `removeContact`, `listMessages` /
`sendMessage`, `subscribeToMessages` / `unsubscribe` (realtime), and
`needsFollowUp` / `relativeTime` helpers behind the "Follow-ups" panel.

`app/modules/documents/documents.data.js` exposes `LumaDocuments`: `listDocuments`, `upload`,
`updateDocument`, `remove`, `download`, `signedUrl`, `listMyShares` /
`listSharedWithMe` / `share` / `unshare`, and `listCategories` / `addCategory` /
`renameCategory` / `deleteCategory`.

`app/modules/tasks/tasks.data.js` exposes `LumaTasks`: `list`, `add`, `update`, `remove`
and a `dueLabel` formatter.

## Multi-project workspaces

If this Supabase project is meant to host more than one app, give each app
its own Postgres schema the same way the migrations here do —
`create schema myotherapp;`, its own tables, its own RLS policies, added to
Exposed Schemas. One important consequence: `auth.users` itself is *not*
namespaced — every schema in one Supabase project shares the same pool of
logins. If a project needs a genuinely separate user base, it needs its own
Supabase project, not just its own schema.

## Next steps

Tasks is done; the natural extension is giving each remaining dashboard
module (Calendar, Bills, Habits, …) its own table in the `luma` schema, following the same
pattern as `profiles`: a table with `user_id references auth.users(id)`, RLS
scoped to `auth.uid()`, and the corresponding module's JS swapped from
reading its hardcoded mock array to querying Supabase.
