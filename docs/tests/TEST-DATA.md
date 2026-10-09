# Test data and accounts

The test cases refer to these personas by name. Create them on **staging** only. Use e-mail addresses you control (a Gmail "plus" address such as `you+dawn@gmail.com` reaches the same inbox).

## 1. Personas

| Persona | Plan | Add-ons | Contacts | Purpose |
|---|---|---|---|---|
| **Dawn Dan** | Dawn (free) | none | accepts Glow Gina | Free-plan limits, locked features, upgrade prompts |
| **Glow Gina** | Glow | none | Dawn Dan, Zenith Zed | Mid-tier limits, Lumi actions |
| **Zenith Zed** | Zenith | none | Glow Gina, Work Wendy | Top-tier features: split expenses, own wallpaper, no limits |
| **Work Wendy** | Dawn or Glow | Work (normal size) | Work Wanda, Zenith Zed, Dawn Dan | Work owner; shows that Work limits do not depend on the plan |
| **Work Wanda** | Dawn | Work | Work Wendy | Work project member |
| **Pro Pat** | Dawn | Work Pro | Work Wendy | Work Pro limits and the downgrade-to-Work case |
| **Guest Gus** | Dawn | none | Work Wendy | Invited to a Work project without the add-on (read-only guest) and to a Study group |
| **Study Sam** | Dawn | Study | Study Sue | Study owner |
| **Study Sue** | Dawn | Study | Study Sam | Study classmate (group project, shared notes) |
| **Trial Tia** | Dawn | none; will start the 7-day trial | — | Free-trial start, expiry, "trial already used" |
| **Expired Eve** | Glow (ended) | Work (ended) | any | Behaviour after a plan / add-on has ended |
| **Admin Ada** | any | any | — | Row in `luma.admin_users`; Admin pages, reports, limits editor |
| **Stranger Stu** | Dawn | none | none | Outsider: must never see another person's data |

### How to create them

1. Register each person through the app (Register page) and confirm the e-mail.
2. Sign in as **Admin Ada** (an administrator row exists in `luma.admin_users`; for a new staging project insert one with the SQL editor: `insert into luma.admin_users (user_id) values ('<user id>');`).
3. Admin → find the person → plan pill: choose the plan (give it a long end date) and, under the add-on pills, switch on Work (choose the Work size) or Study. For **Expired Eve**, give a 1-month plan / add-on and then move its end date to the past in the SQL editor (`update luma.profiles set plan_expires_at = now() - interval '1 day' …`; `update luma.user_addons set expires_at = now() - interval '1 day' …`), or wait for the end.
4. Make the contacts: Contacts → add by e-mail → the other person accepts.

## 2. Data sets for boundary tests

| Feature | Limit | Create |
|---|---|---|
| Reminders (Dawn 5, Glow 25) | 5 / 25 | 5 reminders for Dan; try a 6th. 25 for Gina; try a 26th |
| Habits (Dawn 5, Glow 10) | 5 / 10 | the same way |
| Goals (Dawn 3, Glow 5) | 3 / 5 | |
| Bills (Dawn 5, Glow 12) | 5 / 12 | |
| Contacts (Dawn 3, Glow 12) | 3 / 12 | Dan with 3 accepted contacts, then a 4th request |
| Documents (Dawn 50 MB total, 5 MB a file; Glow 300 / 20; Zenith 1000 / 50) | storage | a 5.1 MB PDF on Dan (refused), a 4.9 MB PDF (accepted); fill to the total |
| Lumi questions a day (3 / 10 / 15) | per day | ask 4 questions as Dan |
| Insights a day (0 / 3 / 10) | | |
| Wallpapers (4 / 8 / 11) | | open Settings as each plan |
| Work companies (Work 5, Work Pro 20) | | Wendy: 5 companies then a 6th; Pat: 20 then 21st |
| Work projects (20 / 60) | | |
| People on a Work project (8 / 15) | | invite 8 people then a 9th (needs 9 accounts or edit `plan_limits` temporarily to 2) |
| Tasks in a project (600 / 1500) | | script an insert of 600 rows, then try one more |
| Work teams (5 / 20) | | |
| Task assignees | 10 | pick 11 people |
| Team size | 50 | |
| Time entry per person per day | 24 h | log 23 h then 2 h on the same day |
| Task checklist | 30 steps | add a 31st |
| Chat messages a day (50) | | send 51 |
| Feedback messages a day | 10 | send 11 |
| Semester grade scale rows | 2–20 | 1 row, 2 rows, 20 rows, 21 rows |

Tip: to test a "limit + 1" case quickly without creating hundreds of rows, an administrator can lower a limit in Admin → Plan limits (remember to put it back).

## 3. Reference data

| Item | Value |
|---|---|
| Time zone | Asia/Kuala_Lumpur (MYT, UTC+8). Reminder cases also use Asia/Tokyo and America/New_York to check that reminders follow each person's own time zone |
| Dates | Cases use "today", "tomorrow", "in 3 days" unless a fixed date matters (month ends, leap day 29 Feb 2028) |
| Files | one PNG, one JPG, one 4.9 MB and one 5.1 MB PDF, one .docx, one .xlsx, one .csv, one .mp4 (small), one .exe (must be refused where types are limited — TBC per feature) |
| Text | a 1-character title, an 80- and 81-character title, a title with emoji and a `<script>` tag (must be shown as text), a long word without spaces |
| Currency | RM (Malaysian ringgit) |

## 4. Resetting

After a run, delete the test accounts through Settings → Account & data → Delete my account (this also exercises the deletion cases), or from the Supabase dashboard (Authentication → Users). Data belongs to staging only and may be wiped at any time.
