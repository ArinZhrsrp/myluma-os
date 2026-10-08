# LUMA — staging setup, start to finish

Staging = a safe copy of LUMA with its own database and its own website, where new things are tried first.
Do the parts **in order**. Each part says what to click and what you should see.

You need: a Supabase account, a Vercel account (already connected to your GitHub repo), a Gmail account, and a terminal in the project folder
(`/Users/shirin/Desktop/myluma-os`) with Node installed.

---

## Part 1 — Supabase: organization and project

1. Open https://supabase.com/dashboard and sign in.
2. Top-left, click your organization's name → **New organization**.
   - Name: `LUMA` · Type: Personal (or Startup) · Plan: **Free** → **Create organization**.
   *(Or skip this and use your existing organization. A separate one just keeps LUMA tidy and leaves room for the production project later.)*
3. Inside the LUMA organization click **New project**.
   - Name: `luma-staging`
   - Database password: click **Generate a password**, then **copy it into a safe place** (a password manager or notes). You'll need it once, for the command line.
   - Region: **Southeast Asia (Singapore)**
   - Plan: Free → **Create new project**.
4. Wait 1–2 minutes until the dashboard finishes loading.
5. Write down two things:
   - **Project reference**: the code in the address bar `https://supabase.com/dashboard/project/<REFERENCE>`.
   - **Project URL**: `https://<REFERENCE>.supabase.co`.

## Part 2 — Supabase: build the database

1. Left menu → **Database → Extensions**. Search `pg_cron`, switch it **on**. Search `pg_net`, switch it **on**.
2. Left menu → **SQL Editor** → **New query**.
3. On your computer open `supabase/ALL_MIGRATIONS.sql`, select everything (Cmd+A), copy (Cmd+C).
4. Paste into the SQL Editor and click **Run**. Wait. You should see "Success. No rows returned".
   - If it is too big or errors out: run the files in `supabase/migrations/` one by one, in number order (001, 002 … 037).
   - If you see an error, copy the red message and send it to me.
5. Expose the luma schema: left menu → **Project Settings → Data API** (older dashboards: Settings → API) → **Exposed schemas** → add `luma` → **Save**.
6. Copy the keys: **Project Settings → API Keys** (or **API**). Copy the **Project URL** and the **publishable** key (starts `sb_publishable_…`; on older projects it is the `anon public` key).

## Part 3 — The code: point staging at this project

1. Open `shared/supabase-config.js`.
2. In the `STAGING` block put your new Project URL and publishable key:
   ```js
   var STAGING = {
     url: "https://<REFERENCE>.supabase.co",
     key: "sb_publishable_xxxxxxxx",
   };
   ```
   Leave `PROD` empty for now.
3. Open `scripts/deploy-functions.sh` and set `STAGING_REF="<REFERENCE>"`.
4. In the terminal:
   ```bash
   git checkout staging
   git add -A
   git commit -m "Staging: new Supabase project"
   git push
   ```
   (You can also just send me the URL and key and I will do steps 1–4.)

## Part 4 — Vercel: the staging website

1. Open https://vercel.com/dashboard → your LUMA project.
2. Click **Deployments**. After your push, a new deployment appears with the branch **staging**. Wait until it says **Ready**.
3. Give staging a fixed address: **Settings → Domains → Add**. Type `myluma-os-staging.vercel.app` and continue.
   When it asks what to connect, choose **Git Branch** and pick `staging`. Save.
   - If that name is taken, use another. Or use the automatic address: open the Ready deployment → **Domains** → copy the `…-git-staging-….vercel.app` address.
4. If opening the staging address asks you to log in to Vercel: **Settings → Deployment Protection** → turn **Vercel Authentication** off for **Preview** deployments → Save.
5. Write down the staging address, for example `https://myluma-os-staging.vercel.app`. Open it: you should see the LUMA login page with a small yellow **STAGING** tag at the bottom-left.
   You do **not** need to change `PROD_HOSTS`. Any address that is not `myluma-os.vercel.app` automatically uses the staging project.
6. Leave **Settings → Git → Production Branch** as it is for now (`main`).

## Part 5 — Supabase: sign-in and email settings

Use the staging address from Part 4 wherever it says `STAGING-URL`.

1. **Authentication → URL Configuration**
   - Site URL: `STAGING-URL`
   - Redirect URLs → Add: `STAGING-URL/**` → Save.
2. **Authentication → Sign In / Providers → Email**: make sure **Confirm email** is **ON**. Save.
3. **Authentication → Emails → Templates → Confirm signup**
   - Subject: `Your LUMA verification code`
   - Message body (replace everything):
     ```html
     <h2>Welcome to LUMA</h2>
     <p>Your verification code is:</p>
     <p style="font-size:32px;font-weight:700;letter-spacing:8px">{{ .Token }}</p>
     <p>Enter it on the sign-up page. If you didn't create an account, ignore this email.</p>
     ```
   - Save.
4. **Authentication → Emails → SMTP Settings** → switch on **Enable custom SMTP**. First get a Gmail app password:
   1. https://myaccount.google.com → **Security** → turn on **2-Step Verification**.
   2. https://myaccount.google.com/apppasswords → name it `LUMA` → **Create** → copy the 16 letters.
   3. Fill in: Sender email = your Gmail · Sender name = `LUMA` · Host = `smtp.gmail.com` · Port = `587` · Username = your full Gmail · Password = the 16 letters (no spaces). **Save.**
5. **Authentication → Rate Limits**: raise "emails sent per hour" if it is low (it starts at 30 after you add your own SMTP).

## Part 6 — Functions (Lumi + push) and the push connection

1. In the terminal (project folder):
   ```bash
   npx supabase login
   npx supabase link --project-ref <REFERENCE>
   ```
   `login` opens a browser to approve. `link` asks for the **database password** from Part 1. (A "Docker is not running" warning is harmless.)
2. Deploy the two functions:
   ```bash
   ./scripts/deploy-functions.sh staging
   ```
3. Set the secrets (use your own values; keep the quotes off unless there are spaces):
   ```bash
   npx supabase secrets set \
     GEMINI_API_KEY=your-gemini-key \
     GROQ_API_KEY=your-groq-key \
     VAPID_PUBLIC_KEY=your-vapid-public-key \
     VAPID_PRIVATE_KEY=your-vapid-private-key \
     VAPID_SUBJECT=mailto:aeinscape@gmail.com \
     WEBHOOK_SECRET=make-up-a-long-random-text \
     --project-ref <REFERENCE>
   ```
   - Gemini key: https://aistudio.google.com/apikey · Groq key: https://console.groq.com/keys
   - VAPID keys: the pair you used before. The public one must match `shared/push-config.js`. If you lost the private one, run `npx web-push generate-vapid-keys`, set both here, and send me the new public key to put in `push-config.js`.
4. Connect notifications to push: open `supabase/setup/push_webhook.sql`, set `YOUR-PROJECT-REF` and `YOUR-WEBHOOK-SECRET` (the same text as `WEBHOOK_SECRET`), then paste the file into the staging **SQL Editor** and **Run**.

## Part 7 — First test and your admin account

1. Open the staging site → **Create account** with an email you can read.
2. You land on "Check your email". Open the email, copy the 6-digit code, type it, **Verify and continue**. You should reach the dashboard (the plans popup shows on first login).
3. Make your account the admin. In the staging **SQL Editor** (use your email):
   ```sql
   insert into luma.admin_users (user_id) select id from auth.users where email = 'YOUR-EMAIL' on conflict do nothing;
   update luma.profiles set plan = 'zenith' where email = 'YOUR-EMAIL';
   ```
   Refresh the site. An **Admin** item appears in the sidebar.
4. Quick checks: add a task, ask Lumi a question, upload a small file, turn on notifications in Settings, and run this to get a test push:
   ```sql
   select luma.notify((select id from auth.users where email = 'YOUR-EMAIL'), 'system', 'Test push', 'It works', 'dashboard');
   ```

## If something does not work

| Problem | Check |
|---|---|
| Page loads but login or data fails | `supabase-config.js` URL / key; **luma** is in Exposed schemas; the SQL ran with no errors |
| No code email | Spam folder; SMTP password is the 16-letter app password; Authentication → Logs for the error |
| Email has no code | The template was not saved with `{{ .Token }}` |
| "Wrong or expired code" | Typo, or use the newest email; tap "Send a new code" |
| Lumi says it isn't set up | Run migration 029; deploy `lumi`; set the Gemini / Groq secrets |
| No push | WEBHOOK_SECRET matches the SQL file; function deployed; notifications turned on in Settings; Edge Functions → send-push → Logs |
| Staging site asks for a Vercel login | Part 4 step 4 |
| No yellow STAGING tag | You are on `myluma-os.vercel.app` (production address), or the page is cached: hard refresh |
