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
  `assets/luma-tasks.js`.
- **Documents** — upload files (private Supabase Storage, 25 MB each), rename
  them, file them under categories, filter by category, preview them in-app (images, PDFs, Word .docx, Excel/CSV sheets, video, text), share them read-only with
  accepted contacts, delete. Categories are per-user and editable (add / rename /
  delete). See `assets/luma-documents.js`.
- **Notes & Docs** — create/edit/delete notes with tags, search and tag
  filters, and attach documents from the Documents menu (own files or files
  shared with you), or upload a file straight from the note. See
  `assets/luma-notes.js`.
- **Health** — log a day (sleep, water, steps, active minutes, mood, note), set
  daily goals, see today's rings, 7-day mood/sleep/steps charts and recent
  entries (edit/delete); one-tap +250 ml water. See `assets/luma-health.js`.
- **Habits** — create habits (icon, colour, goal, repeat days), tick them off for today or any of the last 7 days, streaks, consistency heat-map and weekly chart; the dashboard's Habit Streaks widget shows your top 3. Run `016_habits.sql`. See `assets/luma-habits.js`.
- **Notifications** — a bell with an unread badge; the dropdown shows today's
  notifications with *Mark all as read* and *See all notifications* (full page,
  grouped by day, All/Unread filter, delete). Created by database triggers for:
  welcome after registration, a document shared with you, and contact
  requests / acceptances. New ones slide in live as a toast. See
  `assets/luma-notifications.js`.
- **Contacts** — add another LUMA user by email (request → accept, not
  instant), 1:1 chat with accepted contacts (realtime, via Supabase), and a
  "Follow-ups" panel for contacts you haven't messaged in 7+ days, and a **Nudge**
  button that sends the contact a notification to read your message. See
  `luma.contacts` / `luma.messages` in the schema and `assets/luma-contacts.js`.

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
[`assets/supabase-config.js`](assets/supabase-config.js):

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
The Supabase *publishable* key in `assets/supabase-config.js` is meant to be public — never
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
   [`assets/push-config.js`](assets/push-config.js).
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

## File structure

```
LUMA Login.html              Sign-in page
LUMA Register.html           Sign-up page
LUMA Reset Password.html     Password-reset landing page (opened from email link)
LUMA Glass Dashboard.html    The main app — session-gated, all modules live here
assets/
  supabase-config.js         Your project's URL + publishable key
  luma-auth.js                Shared auth helpers (signUp/signIn/signOut/session/profile)
  luma-contacts.js             Shared contacts + chat helpers (request/accept, messages, realtime)
  luma-tasks.js                Tasks helpers (list/add/update/remove)
  push-config.js               Web Push public (VAPID) key
  luma-notifications.js        Notifications helpers (list/mark read/delete/realtime)
  luma-notes.js                Notes helpers (CRUD + document attachments)
  luma-documents.js            Documents helpers (upload, categories, signed links)
  luma-mark.svg                App mark
  luma-ambient-bg.jpg          Background texture used on the auth pages
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
```

`assets/luma-auth.js` exposes a global `LumaAuth` object used by every page:
`signUp`, `signIn`, `signOut`, `sendPasswordReset`, `updatePassword`,
`getSession`, `requireSession` (guards a page, redirects signed-out visitors
to Login), `redirectIfSignedIn` (sends already-signed-in visitors away from
Login/Register), `getProfile` / `updateProfile` (reads/writes `luma.profiles`),
and `displayName` / `fullName` / `initial` (formatting helpers for the UI).

`assets/luma-contacts.js` (dashboard only, depends on `luma-auth.js` for its
Supabase client) exposes `LumaContacts`: `requestByEmail`, `listContacts`,
`acceptRequest` / `declineRequest` / `removeContact`, `listMessages` /
`sendMessage`, `subscribeToMessages` / `unsubscribe` (realtime), and
`needsFollowUp` / `relativeTime` helpers behind the "Follow-ups" panel.

`assets/luma-documents.js` exposes `LumaDocuments`: `listDocuments`, `upload`,
`updateDocument`, `remove`, `download`, `signedUrl`, `listMyShares` /
`listSharedWithMe` / `share` / `unshare`, and `listCategories` / `addCategory` /
`renameCategory` / `deleteCategory`.

`assets/luma-tasks.js` exposes `LumaTasks`: `list`, `add`, `update`, `remove`
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
