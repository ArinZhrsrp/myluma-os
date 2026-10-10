# LUMA changelog

The newest version is on top. The version number lives in `shared/supabase-config.js` (`window.LUMA_VERSION`) and is shown under "Your Personal OS" in the sidebar and on the login and register pages.
Rules: **patch** (0.9.1) = fixes and small tweaks · **minor** (0.10.0) = a new feature or module · **1.0.0** = the first production release.
Versions before 0.9.0 were written down afterwards from the commit history, so their grouping is approximate.

## 0.30.0 — 2026-10-11 (staging)
### Changed — Dashboard layout
- **Today's Schedule, Today's Priorities and Upcoming Reminders are now the same height.** Each list is exactly five rows tall (every row is 52 px, titles on one line with "…"), and scrolls inside after five. Priorities holds up to 15 tasks and Reminders up to 12.
- Below them the smaller cards sit in two tidy rows: **This Month, Today's Overview, Productivity**, then **Habit Streaks** (wide, scrolls after about five habits) beside **Wellness**. (The column-packing of 0.29.5 is gone; no gaps, nothing stretched oddly.) Narrower windows use two columns, phones one.
- **The busy-day notice is slim and moved into the greeting card**: one line (🔥 Today is busy · 2 things · 8 h booked · Also: Mon 12 · Tue 13 · Wed 14 · ✕) instead of a big box in the Schedule card. Tap the text to open that day.
- **Closing the busy notice (✕) or the Suggestion ("Not now") is now remembered for the rest of the day**, also after a refresh or a new tab. (Before, the Suggestion came straight back on refresh and the notice only stayed hidden in that tab.) A different suggestion still shows.
- **The Work tabs stretch across the row like Study's** (the tabs share the width, "New task" stays at the end).
- **"Nothing here yet" messages look the same on every page.** About 105 empty-card, loading and "could not load" messages (Work Overview, Study, Contacts, Documents, Money, Goals, Health, Admin, the Dashboard cards and more) used different sizes, spacing and colours; they now share one style (`.lu-empty`: 0.84 rem, softer white, left-aligned, same padding).
- **Character limits are shown.** Every title, name and note box in Personal, Work and Study that has a limit now shows a counter under it ("12 / 120"; amber near the limit, red at it). Notes, Health notes, Documents names, Settings names and the Support message had no limit; they now have one (Notes 20,000, Health note 1,000, document name 120, first / last name 60, Support message 2,000). The other boxes keep the limits they already had.
- **Done tasks and steps are no longer crossed out** (Tasks board and checklists, Work task steps, the Dashboard list); they are only faded, with the tick showing.
- **Lumi knows who you are, from your profile.** It addresses you by the first name in Settings → Profile (before, it used the sign-in name, which could be old or missing), knows your plan and your Study / Work add-ons, and wishes you a happy birthday once on your birthday. It is not given your e-mail. Needs the `lumi` function to be deployed again.
- **Notifications load 50 at a time.** The app now asks for at most 50 notifications per request (before: 200). The Notifications page loads the next 50 as you scroll to the bottom ("Loading more…", with "Try again" if it fails). The count on the page and the bell badge now come from the server (total and unread), so they are right even with hundreds of notifications.
- **Page buttons stay on the right on a narrower window.** On a laptop the Work tabs and "New task" dropped under the title and sat on the left; the page-header buttons (all pages) now stay right-aligned when they wrap.
- **Habit Streaks fills its wide card**: habits sit side by side in columns (two on a laptop, three on a big screen, one on a phone) instead of one thin list.
- **Wellness shows four tiles: Sleep, Water, Steps, Mood** (it showed three). The tiles share the row and wrap to two rows on a narrow card.

## 0.29.5 — 2026-10-11 (staging)
### Changed
- **Dashboard cards fill the columns evenly.** Each card goes into the shortest of the three columns (in the same order as before), so the columns end at about the same height and the big gaps are gone. Re-done when the window is resized or the data changes.
- **Stylesheets are no longer kept by the browser after an update.** `app/index.html` now adds a changing `?v=` to every stylesheet (always fresh on staging and your computer; at most an hour old on the live site). This was why some fixes (like the habit icons) did not show until a hard refresh.
### Fixed
- Dashboard → Habit Streaks: the icon tile is now centred and round-cornered by its own inline style, so it no longer depends on the stylesheet being up to date.

## 0.29.4 — 2026-10-11 (staging)
### Changed
- Dashboard: **Today's Priorities** (now up to 15 tasks), **Upcoming Reminders** (up to 12) and **Habit Streaks** (all your habits) scroll after about five rows, like Today's Schedule, instead of cutting the list short. A soft fade at the bottom shows there is more.
- The busy-day notice in the Schedule card has smaller day buttons and lists at most 3 "Also" days, so it sits in tidier rows.

## 0.29.3 — 2026-10-10 (staging)
### Fixed
- Dashboard → Habit Streaks: the habit icons sat in the top-left corner of a plain square; they are now centred in a round-cornered tile.

## 0.29.2 — 2026-10-10 (staging)
### Changed
- Dashboard: the cards are in three stacks (Schedule + Habits | Priorities + Reminders + Wellness | Productivity + This Month + Overview), so a tall card like the Schedule (with the busy-day notice) no longer leaves empty space inside the cards beside it, and nothing is cut short. On narrow windows and phones the cards flow as before, in the same order.

## 0.29.1 — 2026-10-10 (staging)
### Changed
- Dashboard: **Upcoming Reminders** and **This Month** (the budget card) swap places, so the long budget card no longer pushes the cards beside it down.

## 0.29.0 — 2026-10-10 (staging)
### Added
- **Pills in the greeting for things that are near their time**, next to the task / events / money ones. They only appear when there is something, the nearest five are kept (today before tomorrow before later), and each opens its page: **reminders** later today ("Pay rent at 3:00 pm" / "3 reminders later today"), **bills** due within 3 days ("Internet (RM129) due tomorrow"), **subscriptions** renewing within 3 days ("Netflix renews in 2 days"), **habits** still to tick (from 5 pm), **water** still to drink (from 4 pm, "1.5 L of water to go"), and **goals** ending within a week.

## 0.28.3 — 2026-10-10 (staging)
### Changed
- Dashboard: the Suggestion is no longer a separate big card. It is one line inside the greeting card, under the chips (✨ "You have 3 overdue tasks. Start with …", with an Open button and "Not now"). Same rules as before; it still only shows when there is something to say.

## 0.28.2 — 2026-10-10 (staging)
### Changed
- Feedback: the "or paste one here (Ctrl / Cmd + V)" option is gone; a picture is added only with the **Add a picture** button.

## 0.28.1 — 2026-10-10 (staging)
### Changed
- Dashboard: the decorative Lumi robot circle in the greeting card is gone (the floating Lumi button and the Lumi menu item already do that job).

## 0.28.0 — 2026-10-10 (staging)
### Added — birthdays in Admin
- **Admin → Birthdays.** A card with a badge ("2 today" / "3 this week") that opens everyone with a birthday today, in the next 7 days and later this month (30 days), in each person's own time zone (29 Feb counts on 28 Feb in non-leap years). Each row shows the date, the age they turn, the e-mail and plan, and buttons: **Plan**, **Work**, **Study** (open the usual gift dialogs: a plan for some months, or a free trial / months of an add-on) and **Wish**.
- **Wish** sends the person "🎂 Happy birthday, <name>!" (with a push) once a day at most, and is written to the admin log.
- **A 9 am alert for administrators** (job `luma-birthday-alerts`): "N birthdays today" and who is coming up in the next 7 days; nothing on days with none.
- **People can add a birthday** (optional): on the Register form and in Settings → Profile → Edit, with a note that only the LUMA team sees it. FAQ entry added.
### Database
- `087_birthdays.sql`: `profiles.birthday`, `birthday_rows`, `admin_birthdays`, `admin_birthday_wish`, `run_birthday_alerts` + cron job, `handle_new_user` (birthday from sign-up). Run after 086.

## 0.27.1 — 2026-10-10 (staging)
### Fixed
- Admin: the descriptions under Plan report, Feedback inbox and Plan limits were too large; they are now small text.
- Settings → Preferences → "How easily a day counts as busy": the dropdown arrow sat against the right edge; it now has its own arrow with space to its right.

## 0.27.0 — 2026-10-10 (staging)
### Added — sign up and sign in with Google and Apple
- The **Google** and **Apple** buttons on Login and Register now work (they were "coming soon" notes). Google asks which account to use; Apple asks for name and e-mail. After the provider the person comes back to `/login/`, which opens the app, and is kept signed in.
- **Apple is shown only on Apple devices** (iPhone, iPad, Mac); everywhere else Google fills the row.
- A first sign-in creates the account (no e-mail code, because the provider has verified the address). The profile takes the name from the provider (`086_oauth_names.sql`: `given_name` / `family_name`, else `full_name` split at the first space; the sign-up form's names win). Country and time zone are filled from the browser once, for accounts made with Google or Apple.
- **Login never creates an account.** If a Google / Apple ID that has no LUMA account is used on Login, the account Supabase just made is deleted again and the person is told to press "Create one" and register with Google / Apple first (no form to fill: only the Terms box). Needs the `account` function deployed.
- On Register the Terms box must be ticked before Google or Apple starts. The Login page shows a provider's error ("sign-in cancelled…") or "Signing you in…" when the person returns.
- **You must switch each provider on in Supabase** (and add the `/login/` address to the redirect list): see `docs/06-OPERATIONS.md`, "Sign in with Google and Apple". Apple's client secret has to be renewed at least every 6 months.
### Fixed
- Calendar month view on a phone: the busy-day icon next to the date was cut off in narrow cells (found by the phone-width audit); on phones the day's tint shows the load and the icon is left out.
### Database
- `086_oauth_names.sql` (`handle_new_user`). Run after 085.

## 0.26.4 — 2026-10-09 (staging)
### Fixed
- Calendar → Upcoming Events: the highlight shown when you open a reminder hugged the text (no space inside the box). Rows now have padding all round.
- Calendar month view: the "fold what does not fit into +N more" step ran before the busy-day notice above the grid appeared, so cells could still overflow a little afterwards. It now runs after the notice.

## 0.26.3 — 2026-10-09 (staging)
### Fixed
- Calendar month view: on today's date the blue circle also wrapped the busy-day icon, so the number sat off-centre. The circle is now only around the date, with the icon beside it.

## 0.26.2 — 2026-10-09 (staging)
### Fixed
- Calendar month view on a short or narrow window (a laptop): items spilled over the line below, and the time pushed the title out of the cell. Each day now folds whatever does not fit into "+N more", and in narrow cells the time is hidden so the title shows.

## 0.26.1 — 2026-10-09 (staging)
### Fixed
- Opening a reminder for an event, task, bill, habit, goal or reminder that was made in another mode did nothing useful: the Calendar (or page) opened in the current mode, where that item is not shown, so nothing was highlighted (or it did not open at all). LUMA now switches to the mode the item belongs to first (Work ↔ Study ↔ Personal) and then opens and highlights it. This also covers push notifications and links opened from outside the app.

## 0.26.0 — 2026-10-09 (staging)
### Added
- **People are told when they are added to a team** ("Aina added you to the team Design"). Opening the notification takes them to Work → Teams. Only people who were just added are told, never the owner or people already in the team. The Teams tab also has a **Teams you are in** list.
- **Gantt: tasks follow earlier too.** Dragging a bar earlier (or shortening it) pulls the tasks that started the very next day after it earlier by the same number of days, and the ones behind them. They never go before the end of their other predecessors, and a task you left a gap before stays put. Later still pushes linked tasks later, as before.
### Fixed
- Opening a reminder notification for a **repeating event** ("Urgent Project Review starts in 15 min") jumped to the first day of the repeat in the month instead of today's one.
### Database
- `085_work_team_notify.sql`: notifications from `work_set_team`; `my_work_teams` also returns the teams you are in. Run after 084.

## 0.25.7 — 2026-10-09 (staging)
### Fixed
- Study: the eight tabs were cut off on a laptop-sized window (the last ones were hidden). On windows up to about 1360px wide only the open tab shows its name; the others show their icon, with the name as a tooltip.

## 0.25.6 — 2026-10-09 (staging)
### Changed
- Work → Time: the list of what to log time on now reads **Project › Task** for a task, **Project · whole project** for the project itself, and **General · Company (not on a project)** for general time. Before, tasks were only indented, which the list ignores, so they looked like projects.

## 0.25.5 — 2026-10-09 (staging)
### Fixed
- Work → Time: the summary boxes, "Where the time went" and the day lists had no space between them; they are spaced out, and entries have more padding.

## 0.25.4 — 2026-10-09 (staging)
### Fixed
- Task window: space between the "Waits for" line and its box, and the two hint lines ("Nothing. This task can start any time.", "Nobody else is on this project yet.") are small text.

## 0.25.3 — 2026-10-09 (staging)
### Fixed
- Task window: the people under "Assigned to" were plain white browser buttons; they are now chips like Priority, with an orange highlight when ticked. The "Nothing. This task can start any time." line is smaller too.

## 0.25.2 — 2026-10-09 (staging)
### Fixed
- Notification panel: rows had no space between them, so two unread ones touched. Rows now have a 6px gap and unread ones a thin outline.

## 0.25.1 — 2026-10-09 (staging)
### Fixed
- Team window: more space between the people list, the Add people / Include me buttons and the note under them.

## 0.25.0 — 2026-10-09 (staging)
### Added — teams in Work
- **Work → Teams.** Create teams for the departments or squads of a company (Design, Finance, Night shift…): a name, a short note, a colour and people picked from your contacts (you can include yourself). A team belongs to one of your companies; Work allows 5 teams, Work Pro 20.
- **Give a task to a team.** The task window has a *Team* box: pick one and its people are ticked as assignees. You can still tick or untick single people, including people who are not in the team. People who are not on the project yet are listed, with a button to add them (they accept the invitation first, then can be given the task).
- **Add a whole team to a project** from the project's Edit window.
- Tasks show a team chip, and the Tasks tab can be filtered by team. Each team card shows its people and how many open tasks it has (tap to see them).
- Only the owner sees who is in a team; people on the project see the team name on a task. Deleting a team never removes anyone from a task or project.
- FAQ entry, plan popups and the Admin limits editor mention teams.
### Changed
- In a project's Edit window the old "Team" heading is now "People on this project", so it isn't confused with teams.
### Database
- `084_work_teams.sql`: `work_teams`, `work_team_members`, `work_tasks.team_id`, `work_set_team`, `work_delete_team`, `my_work_teams`, limit `work_teams`. Run after 083. Until it has run, Work still works and just shows no teams.

## 0.24.12 — 2026-10-09 (staging)
### Fixed
- Settings → plan and add-ons: the two Get / Renew buttons touched each other on wide screens; they are stacked with a gap (set on the box itself so an older cached stylesheet can't undo it).

## 0.24.11 — 2026-10-09 (staging)
### Changed
- **Settings → Your plan and add-ons:** without Work there are now two buttons, *Get Work · RM15 / month* and *Get Work Pro · RM25 / month* (before, only Work); with Work Pro: *Renew Work Pro* and *Renew as Work instead*; with Work: *Renew Work* and *Upgrade to Work Pro*.
- **WhatsApp messages no longer have a Size line.** They say which add-on (Work or Work Pro) and the price; a short Note appears only when someone is changing from one to the other.

## 0.24.10 — 2026-10-09 (staging)
### Changed
- **Renew as the smaller size.** Someone on Work Pro now gets two renew buttons: *Renew Work Pro* and *Renew as Work instead* (with a note that nothing is deleted; they just can't add more than the Work limits until under them).
- **WhatsApp messages always say which size.** Every buy / renew / upgrade message has a *Size:* line (Work or Work Pro, with its limits) and the price, and a *Note:* when the person is changing size ("I have Work Pro now and would like to renew as Work instead" / "…upgrade to Work Pro").

## 0.24.9 — 2026-10-09 (staging)
### Changed
- **Plans popup, Work card:** the two sizes are spelled out ("Work RM15 / month: up to 5 companies, 20 projects, 8 people on a project and 600 tasks in a project"; the same for Work Pro), with "yours" next to the one you have. The bare numbers (20 · 60 · 15 · 1500) were unclear.
- Someone without Work now sees two buttons: **Get Work · RM15 / month** and **Get Work Pro · RM25 / month**.
- **Renew** says which size ("Renew Work Pro"), and the WhatsApp message names the size and its price.

## 0.24.8 — 2026-10-09 (staging)
### Changed
- Boxes keep the normal see-through look (like the Support message box): the darker backgrounds I added to the Feedback comment box, the Admin search box and the Plan limits boxes are gone. Only the hint text colour stays lighter.

## 0.24.7 — 2026-10-09 (staging)
### Fixed
- Hint text in boxes, checked on every page: the Lumi chat box, the search bars (top bar, Study assignments), the Work time form and company set-up, and the login, register, verify-email and reset-password boxes were still faint (30–40% white); they are now 62–68%.

## 0.24.6 — 2026-10-09 (staging)
### Fixed
- Hint text (placeholders) inside boxes is now light and readable everywhere, not grey on the wallpaper; the Feedback comment box is darker.

## 0.24.5 — 2026-10-09 (staging)
### Fixed
- Admin: the search box's hint text and the "Nobody to pick…" note were hard to read on some wallpapers; the box is darker and both are white.

## 0.24.4 — 2026-10-09 (staging)
### Changed
- Admin → Plan limits: nothing saves until you press **Save** (changed boxes turn amber and the button counts them, with Undo). Text is white and the boxes are darker so it is easy to read.

## 0.24.3 — 2026-10-09 (staging)
### Fixed
- Admin: the Plan report, Feedback inbox and Plan limits cards had no space between them.

## 0.24.2 — 2026-10-09 (staging)
### Fixed
- Feedback page: the message-kind chips (Bug / Idea / Question / Praise) are now proper chips; they were plain white browser buttons.
- Work: a request that never answers no longer leaves the page on "Loading…" for ever. Each one gives up after 20 seconds, says which one it was, and there is a "Try again" button.

## 0.24.1 — 2026-10-09 (staging)
### Changed
- Busy-day alerts look 7 days ahead (was 14). The coloured day strip is gone from the Dashboard, Work and Study (the Today's Schedule card is back to how it was); all three only show the notice bar (when a day in the next 7 is busy or packed), with buttons for the busy days.

## 0.24.0 — 2026-10-09 (staging)
### Changed — Work now comes in two sizes, and the add-on (not the plan) sets the limits
- Someone on Dawn who paid for Work used to be capped at 2 companies because the limits followed the plan. Now **Work** allows 5 companies, 20 projects, 8 people on a project and 600 tasks in a project, and **Work Pro** (RM25 / month, placeholder price) allows 20, 60, 15 and 1500. The plan (Dawn / Glow / Zenith) no longer matters for Work. Limits follow whoever owns the company or project. Free trials and gifts are the normal Work size.
- Shown in the **Plans popup** (Add-ons card, with an *Upgrade to Work Pro* button), the **Work add-on popup** (side-by-side sizes), the **Company page** note, the **limit error messages**, **Settings** (the pill says Work Pro) and the **FAQ** (new "difference between Work and Work Pro" entry).
- **Admin:** the Work add-on dialog has a *Work size* choice; the user list shows Work Pro; Plan limits has Work and Work Pro columns (the four Work limits moved out of Dawn / Glow / Zenith).
### Fixed
- The Company page note printed `${wkCoLimit()}` as text.
### Database
- `083_work_tiers.sql`: `user_addons.tier`, `plan_limits` plans `work` / `work_pro`, `work_tier_plan`, `limit_of`, `my_limits`, `admin_set_addon(..., p_tier)`, `admin_list_users` (+ `addon_tier`). Run after 082.

## 0.23.0 — 2026-10-09 (staging)
### Added
- **Gantt: linked tasks follow.** When you drag a bar later (or lengthen it) and it now runs into a task that waits for it, that task — and the ones waiting for *it* — are pushed later by the same number of days. Tasks are never pulled earlier, and done tasks or ones you can't edit are left alone. The toast says how many moved; if saving fails everything snaps back.
- **How easily a day counts as busy.** Settings → Preferences → Sensitive (amber from 4 things / 4 h, red from 6) · Normal (6 / 9, as before) · Relaxed (8 / 12). Used by the Calendar, Dashboard, Work and Study.
- **"Tomorrow is busy / packed" notification.** Every day at 6 pm in your own time zone (hourly job `luma-busy-alerts`), if tomorrow is busy or packed you get a notification (and a push) that opens the Calendar. Counts events (with repeats), tasks and bills due, Work tasks you are on, Study deadlines and classes. Switch "Tell me the evening before" off in Settings.
- **Admin → Plan limits.** An editor for every number in `plan_limits` (Dawn / Glow / Zenith, empty = unlimited), so limits can be changed without SQL.
### Database
- `082_busy_push_limits_admin.sql`: `busy_day_stats`, `run_busy_alerts` + cron job, `admin_plan_limits`, `admin_set_plan_limit`. Run after 081.

## 0.22.0 — 2026-10-09 (staging)
### Added — busy-day alerts (Personal, Work and Study)
- **A day that has too much on is marked.** Busy (amber): 6 or more things, or 6 hours booked, or two things at the same time. Packed (red): 9 or more things, 9 hours booked, or three clashes. Classes count as half a thing, so a normal timetable doesn't make every day look packed. It counts what the Calendar shows for the mode you are in (events, tasks and bills due; classes and study deadlines in Study; Work tasks in Work).
- Where you see it: month cells and week columns in the **Calendar** get an amber or red tint and a small flame / warning icon; the **day view** has a notice saying why; a **notice bar** ("Tomorrow is packed: 7 things · 8.8 h booked · 4 clashes", with buttons for the next busy days) shows on the Calendar, the **Dashboard**, the **Work** overview and the **Study** overview, with a 14-day colour strip (tap a day to open it). The bar can be hidden for the day.
- **Settings → Preferences → Busy-day alerts** switches all of this on or off.
### Added — Feedback to the developer
- A **Feedback** item in the side menu, in every mode. Choose the **module** (and the **part** of it, e.g. Work › Tasks: Gantt chart; it starts on the module you came from), say if it is a bug, idea, question or praise, write your **comments** and add a **picture** if you like (shrunk automatically; you can paste a screenshot). The page keeps a list of your messages with their status and the developer's reply. Up to 10 messages a day. (migration 081)
- **Feedback inbox for administrators** (Admin → Feedback inbox): every message with the person, the module, the picture and a little context; filter by status or module, search, set a status (New / Seen / Planned / Done / Won't do) with a note, delete. Administrators are notified of new messages, and the person is notified when something becomes Planned or Done.
### Added — Work
- **Links between tasks** ("waits for"): choose the tasks a task must wait for; the Gantt chart draws arrows (red and dashed when a task starts before the one it waits for ends) and the task window warns. Loops are refused. (migration 080)
- **Task spans on the Calendar**: a task with a start and end date shows on every day it covers ("starts", "in progress", "due"); very long ones only on their first and last day.
- **Time budget** on a task (hours): the card shows time logged against it, the task window has a bar, and the owner and people on the task are told once when it goes over. (migration 080)
- **@mentions in comments**: type @ to pick someone on the project; they get their own notification, and the name is highlighted. (migration 080)
- **Lumi** can move a task to another project and a project to another company, and set a time budget when it adds tasks.
- **Admin plan report** now has a Work add-on section: how many have Work (trial, paid or given), companies, projects, tasks, people, hours logged, active in 30 days, and a month-by-month table. (migration 080)
- The **Work free trial is on in production** too (Study's is still staging only).
### Fixed
- **Deleting an account** looked for its files in buckets with the wrong names, so it could fail or leave files behind; it now clears the real ones (documents, backgrounds and feedback pictures). Redeploy the `account` function.

## 0.21.0 — 2026-10-09 (staging)
### Added
- **Drag the bars in the Gantt chart.** Drag a bar to move the task (start and end together), or drag its left or right end to change the start or end date. A small label shows the new dates while you drag; the change is saved when you let go, and a plain tap still opens the task. Only tasks you can change can be dragged.
- **Pick any month and year in every date picker.** Tap the month name (the little arrow beside it) to choose a month from a list and **type the year**, or type a whole date such as 25/12/2026 (also 25-12-2026, 25.12.26 or 2026-12-25). The arrows still work. The same jump is on the **Calendar** title, the month names in **Money**, **Bills**, **Habits** (the day and the consistency month), the **Study** timetable week and the Work **Time** tab (and Team time).

## 0.20.0 — 2026-10-09 (staging)
### Added — Work: Gantt chart and Timeline
- **Gantt chart** (Work → Tasks → Gantt): a bar for every task from its start date to its end date on a date axis, with a red line for today. Zoom by **Week / Month / Quarter**, and **Today** scrolls back. Tasks are grouped by project, or by phase / folder when one project is chosen; a task with only an end date is a diamond; bar colour is the status and the filled part is the progress (checklist, or the status); overdue bars have a red outline; project deadlines are flags. Tap a bar or a name to open the task. Tasks without dates are listed underneath. On a phone the chart scrolls sideways inside its own box with the names kept in view.
- **Timeline** (Work → Tasks → Timeline): a vertical list of what happens when: Overdue, This week, Next week, then month by month, with project deadlines as milestones and recently finished tasks dimmed. Each item shows its project and phase, who has it, its status and dates, and a progress bar.
- Both follow the project and "Assigned to me" filters. Links between tasks are not in.

## 0.19.1 — 2026-10-09 (staging)
### Added
- **Name your general time.** When you log time (or start the timer) on "General", you can type a name such as "Client call" or "Team meeting"; it shows in the Time tab and the timesheet instead of "General". Lumi can do it too ("I had a 1 hour client call"). (migration 079)

## 0.19.0 — 2026-10-09 (staging)
### Added — Work: reminders, calendar, limits, editing and moving
- **Due-date reminders.** People given a Work task are reminded the day before and on the day (at the hour chosen in Settings → Reminders → **Work**), and nudged daily for a week once it is overdue. Done tasks and tasks in an archived company are left alone; tapping the notification opens the task. (migration 077)
- **Calendar and Dashboard.** Work task deadlines and project deadlines show in the **Calendar** (Work mode, with a "Work tasks" filter) and open the task when tapped. On the Personal **Dashboard** a **Work card** (overdue, due today, yours, hours logged today, next tasks) appears once you choose to show Work in Personal; its deadlines also appear in Today's Schedule.
- **Free trial.** The Work add-on's 7-day free trial is switched on for staging, like Study (still off in production).
- **Limits per plan.** The Work limits now follow the plan of the owner: Dawn 2 companies / 5 projects / 3 people per project / 200 tasks per project, Glow 5 / 20 / 8 / 600, Zenith 20 / 60 / 15 / 1,500 (edit them in `plan_limits`). Going over after a downgrade keeps what exists and only stops adding more; the messages say what the plan allows. (migration 077)
- **Edit a comment**, with its history: the writer can change the wording, a small "edited" link opens a list of every earlier version with times. (migration 078)
- **Move a task** to another project (even in another company) from its Edit window: comments, files and logged time come along; people who are not on the new project are taken off the task. **Move a project** to another company from its Edit window; its tasks, notes and your logged time follow. (migration 078)
- **Team time.** In Tasks, the owner of a project with a team gets **Team time**: hours per person for a month, with a CSV. People are told on the Time tab and when they log time that the owner of a project can see the hours logged on it; everything else about hours stays private. (migration 078)
### Changed
- Settings → Your plan and add-ons: a **See what each plan includes** link opens the plans popup for every plan. Before, only people on Dawn had a button for it, so Glow and Zenith could no longer see the plan details.
- The Work add-on description no longer mentions a Gantt view (there isn't one).
- Reset password page: the form is locked with a spinner from the click until you are on the sign-in page, so pressing the button again (or Enter) can't send a second request; on an error it unlocks.

## 0.18.0 — 2026-10-09 (staging)
### Added — Work: comments, files, time tracking, timesheet, Lumi, search
- **Comments and files on tasks.** Open a task to see its **Files** (attach from your computer: it is saved in your Documents and shared with everyone on the project, and un-shared again when removed) and its **Discussion**. Owners and members write; viewers read. The people on the task and whoever made it are told about a new comment, and the notification opens the task. (migration 075)
- **Time tracking** (new **Time** tab). Start a **timer** on a task, a project or "general" work, or **log hours by hand**. One timer runs at a time and works across your devices; a forgotten timer counts at most 12 hours; a day can't have more than 24 hours. Your hours are private; the task popup shows the total everyone logged on it, with Start timer / Log time buttons. Nothing can be logged in an archived company or as a viewer. (migration 076)
- **Timesheet.** Pick the month and company and download a **CSV** or a printable **PDF**, named like "SHIRIN ZAHRA OCTOBER TIMESHEET", with totals and by-project hours (and signature lines on the PDF).
- **Lumi for Work:** add a project, add tasks (even into a phase), move a task between To do / Doing / Review / Done, log time ("I worked 2 hours on the quotation"), start / stop the timer, and answer "how many hours this month?".
- **Search** finds Work projects, tasks and phase / folder notes (in Work mode); **Calendar file** in Work → Tasks saves task and project deadlines as an .ics file for Google, Apple or Outlook Calendar.
- Help (Support) has new answers for companies, time tracking and the new project types.

## 0.17.0 — 2026-10-09 (staging)
### Added — Work: companies
- The first time you open Work it asks **what your company is called**. Everything in Work (projects, tasks, notes, people) is kept under a company. Projects you already had go into a company called "My company", which you can rename.
- The company name is shown under the Work title; tap it to go to the new **Company** page (new item in the Work menu). There you can **add, rename, switch between and archive** companies.
- You can work for **several companies at once**: no company locks another. "Switch to this" chooses the one you see in Work; projects other people shared with you always show.
- **Archive** a company to put all its projects, tasks and notes on ice: you can still open and read them ("View" or the Archived list), but nothing in it can be changed until you **Restore** it. An archived company can also be deleted for good, with its projects (asks first).
- A company has a **start date**, an **end date** and your **position** there (all optional). The button is now **Edit** (it was "Rename"): it changes the name, position, start date and end date, for active and archived companies. If you leave the end date empty it is filled in with the day you archive the company (cleared again on restore). The Company page shows the position and the range, e.g. "1 Mar 2024 → 9 Oct 2026".
- Limit: **20 companies per person in total**. Active and archived ones both count, so delete an archived company to free a place. The Company page shows "2 of 20 used" and explains this. (migration 074)
### Fixed
- The Work guest (view-only) menu no longer shows the Company page.

## 0.16.0 — 2026-10-09 (staging)
### Added — Work: phases and folders
- A project is now either a **Project** or **General** (chosen when you create it, can't be changed later).
- **Project:** six fixed phases — Planning, Requirement study, Design, Development, Testing, Deployment. Each phase lists its tasks and has a **notes area** for the documentation of that phase. Existing projects get the six phases automatically.
- **General** (documentation, memo approvals…): no phases; you make your own **folders** (up to 40), rename or delete them, and write notes inside each.
- Opening a project shows the new **Phases / Folders** view first; Board and List are still there. A task can be put in a phase or folder from its popup, or with "Add task" inside one. Viewers can read the notes, members can write them. (migration 073)
### Fixed
- The tabs in Work no longer move when the button next to them changes between "New project" and "New task".

## 0.15.1 — 2026-10-09 (staging)
### Changed — Work tasks
- A task now has a **start date and an end date** (both optional; the start can not be after the end). Cards and rows show the range, e.g. "5 Oct → Tomorrow".
- **Assigned to** is multi-select: tap one or more people from the project (up to 10). Cards show stacked avatars; people added later are the only ones notified, and you are not notified about your own change. Existing single assignees are carried over. (migration 072)
- Project deadline and the task dates now use the themed calendar picker.
### Fixed
- "Project progress" in the Work overview showed black text; it is now light with a proper progress track.

## 0.15.0 — 2026-10-09 (staging)
### Added — Work add-on, first part (projects, tasks, teams)
- **Work page** with Overview, Projects and Tasks. Projects have a name, client, colour, status, deadline and notes. Tasks live in a project and have a status (To do / Doing / Review / Done), priority, assignee, due date, details and a checklist; view them as a **Board** (with move-back / move-forward buttons that work on a phone) or a **List**, filtered by project or "Assigned to me".
- **Team:** the owner adds people from their contacts (they need a LUMA account). Invitations show up in Work with Accept / Decline; the owner can make someone a viewer or remove them (their tasks become unassigned).
- **People without the Work add-on** who were added to a project can open Work but only **look**: they see the projects they were added to, with a note that Work is needed to create or change anything, and the rest of the Work menu stays locked. A member with the add-on can add and change tasks; a viewer can only look.
- Notifications: "added you to a project" / "gave you a task" open the right place in Work.
- Limits: 60 projects per person, 15 people per project, 1,500 tasks per project. (migration 071)
- Not yet in this part: comments and files on tasks, time tracking and the timesheet, Lumi tools for Work, search and calendar export (next steps).

## 0.14.0 — 2026-10-09 (staging)
### Changed — every notification takes you to what it is about
- A reminder, event, bill, subscription, goal or habit notification highlights that item. Event notifications first switch the calendar to the right month (or to the day view when the day is crowded); a bill reminder looks in next month too when it is about a due date there.
- "Tasks due / overdue" highlights the tasks that are due; water, steps, sleep and active reminders highlight that Health ring; budget alerts highlight the "Budget left" card; plan and add-on notices highlight their row in "Your plan and add-ons"; gifts highlight the gift; splits open expanded.
- With migration 070 these also carry what they are about: a file someone shared, a contact request, a calendar invitation and its reply, a shared Study note, and a group project invitation / reply / new task (Study opens on the right tab and highlights it).
- Works the same from the bell, the pop-up toast and push notifications.

## 0.13.1 — 2026-10-09 (staging)
### Fixed
- Tapping a plan or add-on notice ("Your Work add-on has ended", "Your Study add-on ends tomorrow", "Your plan ends in 7 days") only opened Settings. It now scrolls to that plan or add-on's row in "Your plan and add-ons" and highlights it, from the bell and from a push notification.

## 0.13.0 — 2026-10-09 (staging)
### Added — install LUMA on your phone or computer
- LUMA is now an installable app (web app manifest, icons for Android and iPhone including a "maskable" one, theme colour, standalone full-screen mode, shortcuts for Tasks / Calendar / Reminders).
- **Settings → Account & data → Install LUMA**, and a dismissible "Add LUMA to your home screen" chip on the phone dashboard. Android and desktop Chrome / Edge show the browser's own install box; iPhone and iPad (which have none) get the Share → Add to Home Screen steps. Once installed, the row says so.
- The service worker is registered for everyone (it caches nothing), which is what lets browsers offer the install; on iPhone, installing is also what allows push notifications.
- FAQ entry added.

## 0.12.2 — 2026-10-09 (staging)
### Changed
- Admin on phones: "Select all shown" is a full-width button with Clear beside it, the quick pick sits in its own panel, and "Give free access (N)…" is a full-width button under it. It is plain grey while nobody is selected and shows how many people are selected.

## 0.12.1 — 2026-10-09 (staging)
### Changed
- Admin: "Give free access…" now sits at the right end of the pick row (next to Study / Work / Pick them) instead of on the line above.

## 0.12.0 — 2026-10-09 (staging)
### Added — gifts you can use later
- **Admin → Give free access → "They choose when":** sends the free access as a **gift** instead of switching it on at once. The person sees it under Settings → Your plan and add-ons ("A free gift is waiting for you"), with its length, an optional message, the "use by" date (30, 60, 90 days or none) and a **Use now** button. Nothing starts and no time is lost until they press it; it runs for its full length from that day and is added after anything they already have. Each person can hold up to 3 unused gifts. (migration 069)
- A small green dot on the Settings menu item while a gift is waiting; the notification (and its push) opens Settings and highlights that gift; reminders 7 days and 1 day before a gift expires; used and expired gifts stay listed for 60 days.
### Fixed
- The tick in the admin list checkboxes did not show.

## 0.11.5 — 2026-10-09 (staging)
### Changed
- Admin quick pick: when "Pick them" finds nobody (administrators, deactivated accounts and people who already have the add-on are skipped), a clear message stays under the buttons instead of a short pop-up.

## 0.11.4 — 2026-10-09 (staging)
### Changed
- Admin list redesigned: the person (name, badges, email, joined / seen) on the left, three equal tiles for Plan, Work and Study (colour when on, dashed when off, with the end date), and the ⋯ menu on the right. On phones the tiles sit in one row under the name.

## 0.11.3 — 2026-10-09 (staging)
### Fixed
- Admin list: the ⋯ button is its own column at the end of each row and every cell, including the "Joined / Last seen" text, is centred on the row's middle line.

## 0.11.2 — 2026-10-09 (staging)
### Added
- **Delete my account** in Settings → Account & data: says what is removed, offers "Download my data first", and needs the person to type their email. It removes their data, files and sign-in (needs the `account` function deployed), then returns to the sign-in page with a confirmation. Administrator accounts cannot delete themselves here.

## 0.11.1 — 2026-10-09 (staging)
### Added
- Admin: make someone an administrator (or remove it) from the ⋯ menu on their row. Not for your own account, not for a deactivated one; it is written to the admin log. (migration 068)

## 0.11.0 — 2026-10-09 (staging)
### Added — Admin
- **Free trials by hand:** in an add-on's popup the admin can start the 7-day free trial for someone (it counts as their one trial), or reset it so they can try again. Study trials are now switched on for everyone on staging (still off on production).
- **Bulk free access:** tick any number of people (or "Pick N people who do not have Study / Work"), then "Give free access…": choose the add-on, how long (7/14 days, 1/3 months or a date), skip or extend people who already have it, and add a message. It is a gift: it does not use up anyone's own free trial.
- **Deactivate / reactivate** an account (they are signed out and cannot sign in; their data is kept), and **delete** an account forever (type their email; removes data, files and sign-in; administrators cannot be deactivated or deleted).
- **Recent admin actions** log at the bottom of Admin. (migration 065, new `account` function)
### Added — Personal
- **Repeating tasks** (daily, weekdays, weekly, monthly, yearly: finishing one adds the next) and **task checklists** with progress on the card. Lumi can make them too. (migration 066)
- **Export calendar** (.ics) from Calendar: events, open tasks and bills.
- **Undo** after deleting a task, event, reminder or note.
### Added — Study
- **Attendance:** Present / Late / Absent on today's classes, a goal per subject, % attended and how many classes you can still miss, and past classes you can fill in.
- **Flashcards** (new Cards tab): decks per subject, paste many cards at once, review with spaced repetition.
- **"What if?"** grade calculator on each subject (percentage, grade and semester GPA).
- **Export timetable** (.ics): weekly classes with cancelled days and breaks left out, plus deadlines. (migration 067)
### Fixed
- Tasks → Add task / open a task, the dashboard "Add Task" and search results opened the Study assignment popup instead of the Tasks popup (two functions had the same name). Study's is now `sdOpenTaskModal`.
### Notes
- All new screens were checked at 320 to 768px; the FAQ explains each new feature.

## 0.10.6 — 2026-10-09 (staging)
### Fixed
- Support on phones: the FAQ questions no longer spill out of their card over the support-hours card; the card now grows with the list.

## 0.10.5 — 2026-10-09 (staging)
### Changed
- The slide-out menu on phones is frosted glass like the rest of LUMA instead of a solid dark blue panel; its menu text is a little brighter so it reads well on the glass.

## 0.10.4 — 2026-10-09 (staging)
### Changed
- On phones the top bar keeps its original glass look and stays at the top; the page under it scrolls, so items slide away at its lower edge instead of showing behind it. (Replaces the pinned see-through bar of 0.10.3.)
- Inside a page nothing scrolls on its own any more (Tasks, Settings, Money, Habits, Bills, Analytics, Admin, Support, ...): the page scrolls as one.
- Opening a page starts at its top.

## 0.10.3 — 2026-10-09 (staging)
### Changed
- On phones the top bar (menu, search, notifications) stays at the top while you scroll, so you never have to scroll back up to change page.

## 0.10.2 — 2026-10-09 (staging)
### Changed
- Less empty space under the last card on phones: just enough that the floating Lumi button never covers it.

## 0.10.1 — 2026-10-09 (staging)
### Fixed
- On a phone the Dashboard (and other pages) did not scroll with your finger: the page's inner box was marked to keep swipes to itself, but it could not scroll, so the swipe went nowhere. On phones the whole page now scrolls normally.

## 0.10.0 — 2026-10-09 (staging)
### Changed — made for phones (320px and up)
- New `app/core/responsive.css` (loaded last) and `shared/auth-mobile.css` (sign-in, register, verify, reset).
- Room to breathe: 18px gutters at the edge of the screen (16px / 14px on the smallest phones), roomier cards, safe-area padding for notches, and space under the last card so the floating Lumi button never covers anything.
- Bigger and easier to tap: buttons and chips at least 36–40px, field text 16px (so iPhones do not zoom in when you tap a field), slightly larger text on small phones.
- Nothing wider than the screen any more: two-column pages (Contacts, Lumi, Bills, Habits, Money, Health and others) fold into one column properly; bills show the name on one line and the status, amount and buttons on the next; contact actions wrap under the name; Notes header wraps.
- Calendar month shows small dots for events on phones (tap the day to read them).
- Sidebar and pages use the dynamic screen height, so the bottom is not hidden behind the browser bar.
- The top bar shortens long page names instead of pushing the buttons onto a second line.
- Dashboard: the extra robot icon in the greeting card is hidden on phones (the floating Lumi button is enough).
### Checked
- Every page, in Personal and Study mode, and all 49 popups were measured at 320, 360, 414 and 768px: no sideways scrolling (the admin plan-report table scrolls inside its own box on purpose).

## 0.9.3 — 2026-10-09 (staging)
### Fixed
- Changed script files are always fetched fresh on staging and localhost (on production they are cached per version), so a page can no longer keep showing an old copy after an update.

## 0.9.2 — 2026-10-09 (staging)
### Fixed
- Refreshing a page while in Study or Work mode (for example Reminders) no longer shows your Personal items: the page now waits until the mode is known before it loads.

## 0.9.1 — 2026-10-09 (staging)
### Changed
- Empty Reminders page suggests ideas that fit the mode: students get "Revise today's lessons", "Plan the week", "Check the class portal", "Pay hostel or rent"; Work keeps the timesheet and adds the weekly report and expense claims; the explanation text matches too.
- Lumi's example questions fit the mode (Study: study plan, assignments, timetable, grades; Work: tasks, meetings, timesheet).
- The version line under "Your Personal OS" shows "Version 0.9.1 · STAGING" in amber.

## 0.9.0 — 2026-10-09 (staging)
### Added
- **Split expenses** (Zenith): share a bill with your contacts equally, by exact amounts, percent or shares. Malaysian taxes (SST 6% / 8%, service charge 10% + SST 6%, sales tax 5% / 10%, or your own %). Type the total before tax, after tax, or both. The person who paid marks each share as paid back and can send a reminder. Your own share is added to Money as an expense automatically. (migration 064)
- **Purchase history** page (Settings → Purchase history): every plan and add-on change with date and time, filters, "Show older". (migration 063)
- **Notifications open the item**: tapping a reminder, bill, goal, habit, event, subscription, Study task or class, or a split notification takes you to its page, scrolls to the item and highlights it. Push notifications do the same (redeploy the `send-push` function).
- **Lumi works with every module**: habits, goals, bills (add and mark paid), changing tasks, events, reminders and notes, split expenses, and a fuller overview for answers. (redeploy the `lumi` function)
- Version number ("Version 0.9.0 · STAGING") under "Your Personal OS" in the sidebar and on the login and register pages, replacing the yellow STAGING corner tag; this changelog.
### Changed
- Settings shows the plan and add-on pills without end dates (the dates are in "Your plan and add-ons").
- Study tab bar stretches across the page; page-header buttons stay on the right when the header wraps.
- Switching mode (Personal / Work / Study) scrolls the menu back to the top.
- Brighter Log out button.
### Fixed
- Opening a notification no longer shifts the page or scrolls it sideways.

## 0.8.0 — 2026-10-08
- Plans and add-ons run for a period: end dates, automatic return to Dawn, 7-day and 1-day warnings, admin sets a duration or adds time (migration 062). Turning an add-on off really locks it.
- "Your plan and add-ons" card in Settings with last days, days left and Renew / Get buttons.
- Prices on the Plans popup, a Work + Study bundle, WhatsApp purchase requests.
- Support FAQ rewritten for the current system.
- Work mode is orange, Personal blue, Study green.

## 0.7.0 — 2026-10-08 (Study)
- Study v2 and beyond: semesters (one active at a time, archive with a remark, delete archived, start a new one from an old one), GPA / CGPA, grade scales per subject, semester or account, exam countdown, targets.
- Calendar-style weekly timetable, cancelled classes, breaks and public holidays import, class reminders, assignment reminders.
- Subject notes with formatting, sharing (read / edit) and files; group projects with tasks, comments, files and nudges; Study → Archive with search.
- Migrations 049–061.

## 0.6.0 — 2026-10-08 (Work and Study add-ons)
- Add-ons plumbing (migrations 044–047): Work and Study modes with their own menus, trials, per-mode data ("spaces", migration 050).
- Calendar invitations to contacts (all plans).
- Lumi creates, edits and deletes your own data from chat (batch tools, delete with preview and explicit yes).

## 0.5.0 — 2026-10-07 and before (foundation)
- Dashboard, tasks, calendar, notes, documents, contacts and chat, health, habits, goals, bills, subscriptions, money, reminders with push, analytics, Lumi.
- Dawn / Glow / Zenith plans with limits, admin page, staging and production environments.
- Project reorganised into one folder per module.
