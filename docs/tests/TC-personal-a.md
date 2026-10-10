# Test cases — Personal mode (part A)

Covers the requirements in `docs/srs/SRS-personal-a.md`: Dashboard (DASH), Calendar (CAL), Reminders (REM), Tasks (TASK), Notes (NOTE), Documents (DOC), Contacts and chat (CON) and Focus mode (FOC).

**How to read the Automation line.** The automated suites are in `docs/test-automation/`.
- `pg_busy_test` — database: busy-day counts and the 6 pm "tomorrow is busy / packed" notification (migration 082).
- `pg_tasks_test` — database: repeating tasks (next date rules, checklist reset, once only).
- `pg_refs_test` — database: notifications for a contact request, an accepted request, an event invitation and its reply, and a shared file carry the id of what they are about.
- `v49_test` — jsdom: opens every Personal page (dashboard, calendar, tasks, reminders, notes, documents, contacts …) and checks it renders with no script error. `v41_test` — jsdom: records the computed styles of every page (a layout regression check, not a behaviour test).
- `rig/audit.sh` and `rig/audit_modals.sh` at 320 and 360 px — Chrome headless: reports anything wider than the screen on each page and popup (no check at 390 or 1180 px).
- `edge/space_test.js` — prints how the mode filter (`luma-space.js`) rewrites reads and writes for Personal / Work / Study (it prints, it does not pass or fail on its own).
- Nothing automated covers the Reminders job, the event-reminder job, the Documents upload limits, `request_contact`, `nudge_contact`, the chat limit or Focus mode. Those cases say "Manual".

**Test accounts used below.** *Ana* (Dawn plan), *Bo* (Glow), *Cy* (Zenith), all with their own e-mail; *Dee* is a second Dawn account used as someone else. A "phone" means a real device or Chrome DevTools at 320, 360 and 390 px wide; "laptop" means a 1180 px wide window.

---

## 1. Dashboard (DASH)

#### TC-DASH-001 — Greeting by time of day
- **Requirement:** FR-DASH-001
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in as Ana (first name "Ana"), time zone Asia/Kuala_Lumpur.
- **Test data:** Check at 09:00, 14:00, 20:00 (change the device clock or wait).
- **Steps:**
  1. Open Dashboard at about 09:00.
  2. Read the date line and heading.
  3. Repeat at 14:00 and 20:00; then at exactly 12:00 and 18:00.
- **Expected result:** Date line shows weekday, day, month and time. Heading reads "Good morning, Ana" before 12:00, "Good afternoon, Ana" 12:00–17:59, "Good evening, Ana" from 18:00.
- **Automation:** Manual

#### TC-DASH-002 — Tasks chip counts due and overdue
- **Requirement:** FR-DASH-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana has two open tasks due today, one open task due yesterday, one done task due today.
- **Test data:** Tasks as above.
- **Steps:**
  1. Open Dashboard.
  2. Read the first chip under the greeting.
  3. Click the chip.
  4. Delete all three open tasks and return to Dashboard.
- **Expected result:** Chip reads "3 tasks due or overdue" (the done task is not counted); the click opens Tasks. After deleting, it reads "No tasks due today".
- **Automation:** Manual

#### TC-DASH-003 — Events chip
- **Requirement:** FR-DASH-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Ana has one event today, one daily-repeating event started last week, and has switched the Calendar category "Work" off.
- **Test data:** Both events in category Work.
- **Steps:**
  1. Open Dashboard and read the second chip.
  2. Click it.
- **Expected result:** Chip reads "2 events today" even though the Calendar filter hides Work; the click opens the Calendar. With no events it reads "No events today".
- **Automation:** Manual

#### TC-DASH-004 — Money chip with and without a budget
- **Requirement:** FR-DASH-004
- **Type / Priority:** Functional · P2
- **Preconditions:** Money page available.
- **Test data:** Budget RM 1,000; expenses RM 400, then RM 1,200.
- **Steps:**
  1. With no budget set and RM 400 spent, read the third chip.
  2. Set a monthly budget of RM 1,000.
  3. Reload the Dashboard.
  4. Add expenses to reach RM 1,200 and reload.
  5. Click the chip.
- **Expected result:** Step 1 "RM 400.00 spent this month"; step 3 "RM 600.00 left to spend" (green); step 4 "RM 200.00 over budget" (red); the click opens Money.
- **Automation:** Manual

#### TC-DASH-005 — "Work is hidden here" chip: Show
- **Requirement:** FR-DASH-005
- **Type / Priority:** Functional · P2
- **Preconditions:** Cy has the Work add-on; "Show Work in Personal" is off; chip not dismissed.
- **Test data:** None.
- **Steps:**
  1. Open Dashboard in Personal mode.
  2. Find the chip "Work is hidden here" and press **Show**.
  3. Open Settings → Preferences.
- **Expected result:** Toast "Work is now shown in Personal" with "You can change this in Settings → Preferences"; the chip disappears; a Work card appears on the Dashboard (FR-DASH-022); "Show Work in Personal" is on in Settings.
- **Automation:** Manual

#### TC-DASH-006 — Dismiss the add-on chip
- **Requirement:** FR-DASH-005
- **Type / Priority:** Usability · P3
- **Preconditions:** Cy has Study; "Show Study in Personal" off.
- **Test data:** None.
- **Steps:**
  1. Press the x on "Study is hidden here".
  2. Reload the page and sign out and in again.
- **Expected result:** The chip does not come back. Study items stay hidden in Personal.
- **Automation:** Manual

#### TC-DASH-007 — Add to home screen chip (phone only)
- **Requirement:** FR-DASH-006
- **Type / Priority:** Functional · P3
- **Preconditions:** A phone with LUMA open in the browser (not installed).
- **Test data:** None.
- **Steps:**
  1. Open Dashboard on the phone; look for "Add LUMA to your home screen".
  2. Press the x; reload.
  3. Open the Dashboard on a laptop.
- **Expected result:** The chip shows with **Install** (Android Chrome) or **How** (iPhone); after the x it does not return on that device; it never shows on the laptop or in the installed app.
- **Automation:** Device only

#### TC-DASH-008 — Suggestion card order
- **Requirement:** FR-DASH-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana with AI suggestions on.
- **Test data:** Task "Pay rent" overdue 3 days; task "Call bank" overdue 1 day; bill "Internet" overdue; 6 tasks due today; daily habit "Read" not ticked.
- **Steps:**
  1. Open Dashboard: read the Suggestion.
  2. Press **Open**. Delete the overdue tasks; return.
  3. Mark the bill paid; return.
  4. Leave 6 tasks due today; return.
  5. Reduce to 2 due today; return.
  6. Tick the habit; return.
- **Expected result:** 1 "You have 2 overdue tasks. Start with Pay rent." (oldest), Open → Tasks. 2 "1 bill is overdue. Pay Internet (RM x) first." Open → Bills. 3 "6 tasks are due today. Move the less important ones…". 4 "1 habit still to tick today, including Read." Open → Habits. 5 No card.
- **Automation:** Manual

#### TC-DASH-009 — Not now and the AI switch
- **Requirement:** FR-DASH-008
- **Type / Priority:** Functional · P3
- **Preconditions:** A suggestion is showing.
- **Test data:** None.
- **Steps:**
  1. Press **Not now**; go to Tasks and back to Dashboard.
  2. Reload the browser page.
  3. Switch "Proactive AI suggestions" off in Settings → Preferences; open Dashboard.
- **Expected result:** After step 1 the card stays hidden while you navigate inside the app; after the reload it shows again; with the switch off both the Suggestion and the "Tip for today" cards are hidden.
- **Automation:** Manual

#### TC-DASH-010 — Quick Actions
- **Requirement:** FR-DASH-009
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Cy.
- **Test data:** None.
- **Steps:**
  1. Press **Add Task**, **Log Expense**, **New Event**, **Add Note**, **AI Chat** in turn (close each popup before the next).
- **Expected result:** New task popup; Money entry popup (expense); New event popup with today's date; the New note editor (the Notes page does not need to be visited first); the Lumi chat.
- **Automation:** `v49_test` (Dashboard renders without errors only)

#### TC-DASH-011 — Widgets refresh after a popup closes
- **Requirement:** FR-DASH-010
- **Type / Priority:** Integration · P2
- **Preconditions:** Dashboard open; no tasks.
- **Test data:** Task "Buy milk", due today.
- **Steps:**
  1. Press **Add Task**, enter the task and Save.
  2. Without reloading, look at Today's Priorities, the greeting chip and Today's Overview.
- **Expected result:** "Buy milk" is in Today's Priorities; chip "1 task due or overdue"; Open tasks 1, Due Today 1.
- **Automation:** Manual

#### TC-DASH-012 — Today's Schedule content and order
- **Requirement:** FR-DASH-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana has today: all-day event "Holiday", event "Standup" 09:00–09:30 (Meeting), task "Write report" due today, bill "Netflix" due today.
- **Test data:** As above.
- **Steps:**
  1. Open Dashboard; read Today's Schedule.
  2. Click "Standup".
- **Expected result:** Untimed items first (All day / Task / Bill labels, alphabetical), then "09:00 am Standup · 09:00 am – 09:30 am · Meeting"; each row has a coloured bar. The click opens the Calendar with the event's details popup.
- **Automation:** Manual

#### TC-DASH-013 — Schedule empty state and scroll
- **Requirement:** FR-DASH-011
- **Type / Priority:** Functional · P3
- **Preconditions:** Nothing scheduled today; then 15 items today.
- **Test data:** 15 all-day events titled "E1"…"E15".
- **Steps:**
  1. Open Dashboard with nothing today.
  2. Add the 15 events and reopen.
- **Expected result:** "Nothing scheduled today. Add an event on the Calendar."; then the list scrolls inside a card of about 260 px height.
- **Automation:** Manual

#### TC-DASH-014 — Busy-day notice on the Dashboard
- **Requirement:** FR-DASH-012, FR-CAL-026
- **Type / Priority:** Functional · P2
- **Preconditions:** Busy-day alerts on (default); sensitivity Normal; tomorrow has 6 events.
- **Test data:** Six all-day events tomorrow.
- **Steps:**
  1. Open Dashboard.
  2. Press **Open tomorrow**.
  3. Return and press the x on the notice.
- **Expected result:** A notice "Tomorrow is busy" with "6 things" appears above Today's Schedule (no 7-day strip); Open shows the Calendar day view of tomorrow; the x hides the notice for the rest of the day.
- **Automation:** `pg_busy_test` (server counts only)

#### TC-DASH-015 — Today's Priorities ordering and the limit of 8
- **Requirement:** FR-DASH-013
- **Type / Priority:** Boundary · P1
- **Preconditions:** Ana has 10 open tasks.
- **Test data:** T1 overdue 5 days (Low); T2 overdue 2 days (High); T3 due today High; T4 due today Low; T5 due tomorrow High; T6 no date High; T7 Medium due in 3 days; T8 Low due in 9 days; T9 Low due in 20 days; T10 Low no date.
- **Steps:**
  1. Open Dashboard; read Today's Priorities.
- **Expected result:** Exactly 8 rows. Order: T1 (overdue, oldest), T2, then High (T3, T5, T6), then Medium (T7), then Low (T4, T8 …). T9 or T10 is left out. Overdue rows show red "overdue", today's amber "today", others the date.
- **Automation:** Manual

#### TC-DASH-016 — Tick a priority, untick, and failure
- **Requirement:** FR-DASH-014
- **Type / Priority:** Functional · P1
- **Preconditions:** A task "Call bank" with status In progress is in the list.
- **Test data:** None.
- **Steps:**
  1. Tick "Call bank". Open Tasks and look at its column.
  2. Return to Dashboard (do not reload); look at the row, then untick it.
  3. Switch the device offline and tick another task.
  4. With no open tasks left, reload.
- **Expected result:** 1 Task is Done, row crossed out and moved to the bottom. 2 Unticking returns it to In progress (not To do). 3 The tick reverts and the alert "Could not update the task: …" shows. 4 "No open tasks. Enjoy the calm."
- **Automation:** Manual

#### TC-DASH-017 — This Month card
- **Requirement:** FR-DASH-015
- **Type / Priority:** Boundary · P2
- **Preconditions:** Budget RM 1,000, income RM 3,000 this month.
- **Test data:** Expenses RM 0, RM 1,000, RM 1,500.
- **Steps:**
  1. Open Dashboard at each expense total.
- **Expected result:** Spent / "Left in budget" RM 1,000.00 → RM 0.00 → "−RM 500.00" in red; the spend bar is 0 %, 100 %, and stays at 100 % (red) at RM 1,500; income bar is spent ÷ income capped at 100 %. With no budget the label reads "Budget … Not set".
- **Automation:** Manual

#### TC-DASH-018 — Habit, Wellness and Productivity cards
- **Requirement:** FR-DASH-016, FR-DASH-017, FR-DASH-018
- **Type / Priority:** Functional · P3
- **Preconditions:** Four habits with streaks 5, 3, 2, 1; Health log today: sleep 7, water 1,500 ml, mood 4.
- **Test data:** As above.
- **Steps:**
  1. Open Dashboard.
  2. Read Habit Streaks, Wellness and Productivity.
  3. Delete all habits and clear today's Health log; reload.
- **Expected result:** Top three habits (5, 3, 2) each with seven squares; Wellness shows "7h", "1.5L" and the mood name; Productivity shows a score and a +/−% pill. After step 3: "No habits yet — add one on the Habits page." and "—" for sleep, water and mood.
- **Automation:** Manual

#### TC-DASH-019 — Upcoming Reminders and Today's Overview
- **Requirement:** FR-DASH-019, FR-DASH-020
- **Type / Priority:** Boundary · P2
- **Preconditions:** Ana has: bill "Internet" overdue 2 days, bill "Netflix" (Subscription) due in 5 days, custom reminder "Pay rent" tomorrow 09:00, custom reminder in 20 days, 5 more bills.
- **Test data:** For workload: 3, 4, 6, 7 tasks due or overdue.
- **Steps:**
  1. Open Dashboard; read Upcoming Reminders; press "View all".
  2. With 3, 4, 6 and 7 overdue + due-today tasks, read the Workload Level.
- **Expected result:** At most 4 rows ordered by date ("Overdue 2d" red first, "Tomorrow", "Renews in 5d"…); the reminder 20 days away is not shown; View all opens Reminders. Workload: 3 Low, 4 Medium, 6 Medium, 7 High.
- **Automation:** Manual

#### TC-DASH-020 — Tip of the day rotates
- **Requirement:** FR-DASH-021
- **Type / Priority:** Functional · P3
- **Preconditions:** AI suggestions on; one overdue task and no habits.
- **Test data:** None.
- **Steps:**
  1. Open Dashboard, note the tip.
  2. Wait 25 seconds on the page; note again; repeat twice.
  3. Switch to another browser tab for 60 seconds and return.
- **Expected result:** Tip starts "Tip for today:" and changes about every 20 seconds with a fade, never the same one twice in a row, drawn from tips that fit (for example the overdue-task tip, "No habits yet…") and general ones. It does not rotate while the tab is hidden.
- **Automation:** Manual

#### TC-DASH-021 — Work card in Personal
- **Requirement:** FR-DASH-022
- **Type / Priority:** Integration · P2
- **Preconditions:** Cy with the Work add-on, one project with 3 tasks assigned to Cy (1 overdue, 1 today, 1 next week).
- **Test data:** None.
- **Steps:**
  1. With "Show Work in Personal" off open Dashboard.
  2. Switch it on (Settings → Preferences); open Dashboard.
  3. Click a task row, then the time box, then "Open Work".
- **Expected result:** Off: no Work card. On: card with Overdue 1, Due today 1, Yours open 3, time logged today, and up to four task rows; row opens the task in Work, the time box opens Work → Time, "Open Work" opens Work. A person without the add-on never sees the card.
- **Automation:** Manual

#### TC-DASH-022 — Widget header links
- **Requirement:** FR-DASH-023
- **Type / Priority:** Functional · P3
- **Preconditions:** None.
- **Test data:** None.
- **Steps:**
  1. Press "View calendar", "All tasks", "Money", "Habits", "Health" and "View all" (Upcoming Reminders) in turn.
- **Expected result:** Each opens Calendar, Tasks, Money, Habits, Health and Reminders.
- **Automation:** `v49_test` (renders only)

#### TC-DASH-023 — Loading state and parallel load
- **Requirement:** FR-DASH-024
- **Type / Priority:** Performance · P3
- **Preconditions:** Browser throttled to "Slow 3G".
- **Test data:** None.
- **Steps:**
  1. Open Dashboard.
  2. Watch each card.
- **Expected result:** Every card shows "Loading…" and then fills; the cards fill together (one load), not one after another; no card stays on "Loading…" when a request fails (it shows its empty text).
- **Automation:** Manual

#### TC-DASH-024 — Dashboard on phones and laptop
- **Requirement:** NFR-DASH-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** Ana with data in every widget.
- **Test data:** Widths 320, 360, 390 and 1180 px.
- **Steps:**
  1. Open Dashboard at each width.
  2. Scroll with a finger / wheel; look for a horizontal scrollbar; look for the robot icon in the greeting card.
- **Expected result:** At 320/360/390 px the page scrolls as one, nothing is wider than the screen, chips wrap, the robot icon is hidden; at 1180 px the cards sit in a grid.
- **Automation:** `rig/audit.sh` 320 and 360 (dashboard page) · otherwise manual

#### TC-DASH-025 — Dashboard shows only my data
- **Requirement:** NFR-DASH-002, FR-DASH-011
- **Type / Priority:** Security · P1
- **Preconditions:** Ana and Dee each have tasks and events today with different titles.
- **Test data:** Ana "A-task"; Dee "D-task".
- **Steps:**
  1. Sign in as Ana; read every widget.
  2. Sign out, sign in as Dee; read every widget.
- **Expected result:** Each person sees only their own titles; a Work or Study item appears in Personal only when its "Show … in Personal" switch is on.
- **Automation:** Manual

---

#### TC-DASH-026 — Pills for things that are near their time
- **Requirement:** FR-DASH-025
- **Type / Priority:** Functional · P2
- **Preconditions:** A Glow person with, on the same day: a daily reminder at a time later today; a bill (category Internet) due tomorrow; a subscription renewing in 2 days; a goal ending in 4 days; one daily habit not ticked; a water goal of 2 L with 0.5 L logged. Test in the evening (after 5 pm) to see habits and water.
- **Steps:** Open the Dashboard and look at the pills in the greeting card.
- **Expected result:** In addition to the task / event / money pills there are pills such as "Pay rent at 11:59 PM", "1 habit left to tick today", "1.5 L of water to go", "Internet (RM129) due tomorrow", "Netflix renews in 2 days (RM55)", and (if there is room) "Goal “…” ends in 4 days". Tapping each opens its page. Before 4 pm the water pill and before 5 pm the habits pill are not shown.
- **Automation:** `ui/v49_test.js` (reminder, bill, subscription, habits, water) · times of day: manual.

#### TC-DASH-027 — The near-time pills are limited and quiet
- **Requirement:** FR-DASH-026
- **Type / Priority:** Boundary · P3
- **Preconditions:** Six or more things are near (see TC-DASH-026); then a day with nothing near.
- **Steps:** Look at the greeting; then remove the reminders, bills, subscriptions and goals and reload.
- **Expected result:** At most five of these pills appear, the nearest first (today's before tomorrow's). With nothing near, none appear and only the usual pills remain. An overdue bill or task is not repeated as one of these pills. On a 360 px phone the pills wrap onto their own lines without cutting off.
- **Automation:** `ui/v49_test.js` (nothing near → only the usual pills) · layout: manual (phone-width audit covers overflow).

#### TC-DASH-028 — Long lists scroll inside their cards
- **Requirement:** FR-DASH-027
- **Type / Priority:** Functional · P2
- **Preconditions:** A person with 9 open tasks, 9 reminders (or bills) due in the next days and 7 habits.
- **Steps:** Open the Dashboard; scroll inside Today's Priorities, Upcoming Reminders and Habit Streaks.
- **Expected result:** Each card shows about five rows and scrolls inside itself, like Today's Schedule (the page does not scroll). A soft fade appears at the bottom while there is more and disappears at the end. With five or fewer rows there is no scrollbar and no fade. Habit Streaks lists all habits, the longest streak first.
- **Automation:** Manual (layout).

#### TC-DASH-029 — Equal-height first row with five visible rows
- **Requirement:** FR-DASH-028
- **Type / Priority:** Responsive · P2
- **Preconditions:** A person with 7 events today, 9 open tasks and 7 reminders / bills coming up (and a second account with only 1 of each).
- **Steps:** Open the Dashboard at 1180 px, 900 px and 390 px wide.
- **Expected result:** At 1180 px the three cards in the first row have exactly the same height; each shows five rows and scrolls inside after that (the page does not scroll); long titles stay on one line with "…". With only one item the cards are still the same height (empty space below the item). The smaller cards sit below in two tidy rows. At 900 px two columns (Reminders spans the second row); at 390 px one column.
- **Automation:** Manual (layout; the phone-width audit checks for overflow).

## 2. Calendar (CAL)

#### TC-CAL-001 — Four views, default Month
- **Requirement:** FR-CAL-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in as Ana.
- **Test data:** None.
- **Steps:**
  1. Open Calendar.
  2. Press Week; go forward two weeks; press Day; press Month, then Year.
- **Expected result:** Month is selected first. Each tab opens on today (not on the date you had moved to) and the tab is highlighted.
- **Automation:** `v49_test` (renders only)

#### TC-CAL-002 — Previous, next and Today
- **Requirement:** FR-CAL-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Calendar open.
- **Test data:** Today is 9 Oct 2026.
- **Steps:**
  1. In Month press next; then Today.
  2. In Week, Day and Year press next and previous once each.
- **Expected result:** Month moves by a month (title "November 2026"); Week by 7 days; Day by 1 day; Year by 1 year. The **Today** button is hidden when today is on screen and shows otherwise.
- **Automation:** Manual

#### TC-CAL-003 — Title opens the date picker
- **Requirement:** FR-CAL-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Calendar in Month view.
- **Test data:** Pick 25 Dec 2026.
- **Steps:**
  1. Click the title ("October 2026").
  2. Choose 25 in the next month grid after pressing the next-month arrow twice.
- **Expected result:** The picker closes and the Calendar shows December 2026 (in Day view: 25 Dec).
- **Automation:** Manual

#### TC-CAL-004 — Month grid and "+N more"
- **Requirement:** FR-CAL-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Laptop window 1180 px wide; 8 all-day events on one day.
- **Test data:** Events "E1"…"E8" on 15 Oct.
- **Steps:**
  1. Open Month view on October.
  2. Click "+N more" on 15 Oct.
  3. Click one event in the popup; reopen and press **Open day view**.
- **Expected result:** The cell shows some events and a last line "+N more"; nothing spills onto the next row. The popup lists all 8 with the date heading; an event opens its details; **Open day view** shows the Day view of 15 Oct. Sunday is the first column.
- **Automation:** Manual

#### TC-CAL-005 — Month view on phones
- **Requirement:** FR-CAL-005, NFR-CAL-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** Events on several days.
- **Test data:** Widths 320, 360, 390 px.
- **Steps:**
  1. Open Calendar in Month view at each width.
  2. Tap a day with events.
- **Expected result:** Cells show small dots, no horizontal scrolling; tapping a day opens its items (the "+N more" / day popup or the day view).
- **Automation:** `rig/audit.sh` 320 and 360 (calendar page) · otherwise manual

#### TC-CAL-006 — Week view grid
- **Requirement:** FR-CAL-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Today has events 09:00–10:00, 09:30–10:30 (overlap) and 14:00 (no end); one all-day event on Wednesday.
- **Test data:** As above.
- **Steps:**
  1. Open Week view.
  2. Look at the overlap, the 14:00 event, the all-day row and today's column.
- **Expected result:** Overlapping events sit side by side, each half width; the 14:00 event is one hour tall; the all-day event is in the "all-day" row; a red line marks the current time on today's column; the corner shows "GMT" and the offset; the grid opens at the top because an all-day item exists (with none it opens at about 7 am).
- **Automation:** Manual

#### TC-CAL-007 — Day view agenda
- **Requirement:** FR-CAL-007
- **Type / Priority:** Functional · P2
- **Preconditions:** Today with one all-day event and one event at 11:00.
- **Test data:** None.
- **Steps:**
  1. Open Day view.
  2. Read the rows; click the card at 11:00; click an empty 15:00 row.
- **Expected result:** "All day" row first, then hour rows 00:00–23:00; the current hour row is highlighted and in view; the card opens details; the empty row opens New event with the date and start time 15:00.
- **Automation:** Manual

#### TC-CAL-008 — Year view
- **Requirement:** FR-CAL-008
- **Type / Priority:** Functional · P3
- **Preconditions:** Events on 3 Mar and 12 Jul this year.
- **Test data:** None.
- **Steps:**
  1. Open Year view.
  2. Click "March" (the month name); return to Year; click the day 12 in July.
- **Expected result:** Days with items are marked; the month name opens that month in Month view; the day opens the Day view of 12 Jul.
- **Automation:** Manual

#### TC-CAL-009 — Click empty space to create
- **Requirement:** FR-CAL-009
- **Type / Priority:** Functional · P2
- **Preconditions:** Calendar open.
- **Test data:** None.
- **Steps:**
  1. In Month click an empty part of 20 Oct.
  2. In Week click the Thursday column at the 10:00 line.
  3. Press **Create** in Month view, and again in Day view on another date.
- **Expected result:** 1 New event with date 20 Oct. 2 New event on that Thursday with start 10:00. 3 In Month, date = today; in Day, date = the day shown.
- **Automation:** Manual

#### TC-CAL-010 — Create an event
- **Requirement:** FR-CAL-010, FR-CAL-034
- **Type / Priority:** Functional · P1
- **Preconditions:** Calendar open.
- **Test data:** Name "Dentist", category Health, date 20 Oct, Starts 15:00, Ends 16:00, repeat Never, note "Bring the form".
- **Steps:**
  1. Press **Create**, fill the form, press **Save event**.
  2. Click the event.
- **Expected result:** The event shows on 20 Oct (amber/Health colour, "03:00 pm Dentist"); details show Date, "03:00 pm – 04:00 pm", "Does not repeat", the note and the Health tag. Default category when untouched is Work.
- **Automation:** Manual

#### TC-CAL-011 — Event form validation messages
- **Requirement:** FR-CAL-011
- **Type / Priority:** Negative · P1
- **Preconditions:** New event form open.
- **Test data:** See steps.
- **Steps:**
  1. Press Save with everything empty.
  2. Type a name; clear the date; press Save.
  3. Restore the date, leave Starts empty ("At a time" selected); press Save.
  4. Choose All day; press Save.
- **Expected result:** 1 "Give the event a name." 2 "Pick the date." 3 "Pick a start time, or choose All day." 4 Saves (no time needed). Nothing is saved while a message shows.
- **Automation:** Manual

#### TC-CAL-012 — Length limits of name and note
- **Requirement:** FR-CAL-010
- **Type / Priority:** Boundary · P2
- **Preconditions:** New event form open.
- **Test data:** Name of 120 characters, then try 121; note of 1,000 characters, then try 1,001.
- **Steps:**
  1. Type 120 characters in the name, then try to type one more.
  2. Paste 1,001 characters into the note.
  3. Save.
- **Expected result:** The name box stops at 120 and the note box at 1,000 characters; the event saves with the text intact.
- **Automation:** Manual

#### TC-CAL-013 — End time must be after start
- **Requirement:** FR-CAL-011
- **Type / Priority:** Boundary · P2
- **Preconditions:** New event form, "At a time".
- **Test data:** Start 10:00; End 09:59, 10:00, 10:01.
- **Steps:**
  1. Enter each End time in turn and press Save.
- **Expected result:** 09:59 and 10:00 give "The end time must be after the start time."; 10:01 saves. An empty End is allowed (the grid shows a one-hour block).
- **Automation:** Manual

#### TC-CAL-014 — Repeats daily, weekly, monthly, yearly
- **Requirement:** FR-CAL-012
- **Type / Priority:** Functional · P1
- **Preconditions:** None.
- **Test data:** Four events starting Mon 5 Oct 2026: "D" daily, "W" weekly, "M" monthly, "Y" yearly.
- **Steps:**
  1. Create the four events.
  2. Look at Month view for October and November 2026, and Year view for 2027.
- **Expected result:** D on every day from 5 Oct; W every Monday (5, 12, 19, 26 Oct; 2 Nov…); M on 5 Oct and 5 Nov; Y on 5 Oct 2027. Nothing before 5 Oct.
- **Automation:** Manual

#### TC-CAL-015 — Monthly and yearly repeats on short months
- **Requirement:** FR-CAL-012
- **Type / Priority:** Boundary · P2
- **Preconditions:** None.
- **Test data:** Monthly event starting 31 Jan 2026; yearly event starting 29 Feb 2028.
- **Steps:**
  1. Look at February, April and June 2026 for the monthly event.
  2. Look at Feb 2029 for the yearly event.
- **Expected result:** The monthly event is on 28 Feb, 30 Apr and 30 Jun (the last day of the month); the yearly event is on 28 Feb 2029 (the last day of February).
- **Automation:** Manual

#### TC-CAL-016 — Edit a repeating event
- **Requirement:** FR-CAL-012, FR-CAL-013
- **Type / Priority:** Functional · P2
- **Preconditions:** A weekly event "Gym" exists.
- **Test data:** New name "Gym class", start 07:00.
- **Steps:**
  1. Open an occurrence, press **Edit event**; read the hint under Repeats.
  2. Change the name and start; Save.
  3. Check another week.
- **Expected result:** The hint says editing a repeating event changes all occurrences; every occurrence shows the new name and time.
- **Automation:** Manual

#### TC-CAL-017 — Delete and Undo
- **Requirement:** FR-CAL-013
- **Type / Priority:** Functional · P1
- **Preconditions:** A one-off event and a repeating event.
- **Test data:** None.
- **Steps:**
  1. Open the one-off event, press the bin; read the confirmation; Delete.
  2. Press **Undo** in the toast.
  3. Delete the repeating event and read the confirmation; Cancel.
- **Expected result:** Confirmation "Delete “<name>”? This event is removed. This can't be undone."; after delete the event is gone and a toast "Event deleted" has Undo, which restores it. The repeating event's message adds "Every occurrence of this repeating event is removed."; Cancel keeps it. Invitations are not restored by Undo.
- **Automation:** Manual

#### TC-CAL-018 — Details of a task and a bill
- **Requirement:** FR-CAL-014, FR-CAL-015
- **Type / Priority:** Functional · P2
- **Preconditions:** Task "Write report" (High, tag Work, notes "draft") due yesterday; bill "Internet" RM 129 monthly due today.
- **Test data:** As above.
- **Steps:**
  1. Click the task on yesterday's date; press **Open in Tasks**.
  2. Click the bill on today's date; press **Open in Bills**.
- **Expected result:** Task popup shows "Due … — overdue", Status, Priority High, Tag, Notes and the buttons Close / Open in Tasks. Bill popup shows Amount RM 129.00, Due, Status "Not paid yet", Repeats Monthly, Category, buttons Mark as paid / Open in Bills. Each Open button goes to that page.
- **Automation:** Manual

#### TC-CAL-019 — Mark a bill paid from the Calendar
- **Requirement:** FR-CAL-014, FR-CAL-015
- **Type / Priority:** Integration · P3
- **Preconditions:** The bill above, unpaid.
- **Test data:** None.
- **Steps:**
  1. Open the bill; press **Mark as paid**.
  2. Look at the cell; press **Undo paid**.
- **Expected result:** The popup refreshes to "Paid" with Undo paid; the chip in the grid shows a tick; Undo paid returns it to unpaid; the Bills page agrees.
- **Automation:** Manual

#### TC-CAL-020 — Done and undated tasks are not shown
- **Requirement:** FR-CAL-015
- **Type / Priority:** Negative · P2
- **Preconditions:** Task A open due 20 Oct; task B Done due 20 Oct.
- **Test data:** None.
- **Steps:**
  1. Look at 20 Oct in Month view.
  2. Mark A Done in Tasks and return.
- **Expected result:** Only A shows (label "Task due") at first; after A is Done neither shows. Tasks cannot be changed from the Calendar.
- **Automation:** Manual

#### TC-CAL-021 — Category filter and counts
- **Requirement:** FR-CAL-016
- **Type / Priority:** Functional · P2
- **Preconditions:** October with 2 Work events, 1 Health event, 3 open tasks due, 1 bill.
- **Test data:** None.
- **Steps:**
  1. Read the category panel counts.
  2. Click "Work" and "Tasks" to switch them off.
  3. Look at Month, Week, Upcoming and the busy-day colour of a crowded day.
- **Expected result:** Counts Work 2, Health 1, Tasks 3, Bills 1 (Classes / Study / Work tasks only appear with the add-ons). Switched-off categories are dimmed, keep their count and disappear from every view and from Upcoming; the busy-day colour of a day does not change.
- **Automation:** Manual

#### TC-CAL-022 — Upcoming Events and View all
- **Requirement:** FR-CAL-017
- **Type / Priority:** Boundary · P2
- **Preconditions:** Events today, tomorrow, in 13 days and in 15 days; 7 events in the next 14 days.
- **Test data:** As above.
- **Steps:**
  1. Read Upcoming Events and the remark under it.
  2. Press **View all**; click an entry.
  3. Remove all events and look again.
- **Expected result:** First 5 items with Today / Tomorrow / date labels; the remark "Only the next 2 weeks are listed (until <date>)."; View all lists every item of the 14 days grouped by day (the event on day 15 is absent); a click shows its details; with none: "Nothing in the next 2 weeks." and View all is hidden.
- **Automation:** Manual

#### TC-CAL-023 — Invite a contact to an event
- **Requirement:** FR-CAL-018, FR-CAL-020
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana and Dee are accepted contacts.
- **Test data:** Event "Lunch" tomorrow 12:30.
- **Steps:**
  1. As Ana create "Lunch"; press **Add from contacts**; tick Dee; **Done**.
  2. Save the event.
  3. Open the event again.
  4. As Dee open the notifications.
- **Expected result:** A chip with Dee's name and a paper-plane icon appears before saving; toast "Invitations sent — Dee"; the reopened event shows Dee with an amber dot ("Invited, no reply yet"). Dee has the notification "📅 Ana invited you to Lunch" ("<Day, DD Mon> · 12:30 pm. Open your calendar to accept or decline."); opening it shows the Calendar on that event.
- **Automation:** `pg_refs_test` (the notification carries the event id)

#### TC-CAL-024 — Invite picker with no contacts and already-invited people
- **Requirement:** FR-CAL-018
- **Type / Priority:** Negative · P3
- **Preconditions:** A person with no contacts; Ana with Dee already invited.
- **Test data:** None.
- **Steps:**
  1. As the person with no contacts open New event → Add from contacts.
  2. As Ana open the event with Dee invited and open the picker.
- **Expected result:** 1 "You have no contacts yet. Add people on the Contacts page first, then invite them here." 2 Dee is ticked, disabled and marked "Already invited"; pending contacts (not accepted) are not listed.
- **Automation:** Manual

#### TC-CAL-025 — Cannot invite a non-contact or on someone else's event
- **Requirement:** FR-CAL-019, FR-CAL-024
- **Type / Priority:** Security · P1
- **Preconditions:** Ana's event E; Dee is not Ana's contact; Cy is Dee's contact.
- **Test data:** Event id of E.
- **Steps:**
  1. As Ana call the database function `invite_to_event` for E with Dee's id (developer console / SQL).
  2. As Dee call `invite_to_event` for E with Cy's id.
- **Expected result:** 1 Error "You can only invite people who are in your contacts". 2 Error "You can only invite people to your own events". No invitation rows are created.
- **Automation:** Manual

#### TC-CAL-026 — Guest limit of 30
- **Requirement:** FR-CAL-019
- **Type / Priority:** Boundary · P2
- **Preconditions:** Cy (Zenith) has 31 accepted contacts.
- **Test data:** One event.
- **Steps:**
  1. Invite 30 contacts and Save.
  2. Open the event, invite the 31st contact and Save.
  3. Have one guest decline, then invite the 31st again.
- **Expected result:** 30 guests work. The 31st: the event is saved and the alert "The event was saved, but the invitations could not be updated: An event can have up to 30 guests" appears. After one decline the 31st can be invited (declined people do not count).
- **Automation:** Manual

#### TC-CAL-027 — Reply notifications and toast
- **Requirement:** FR-CAL-020
- **Type / Priority:** Integration · P2
- **Preconditions:** Dee has a pending invitation from Ana.
- **Test data:** None.
- **Steps:**
  1. As Dee accept the invitation.
  2. As Ana open the notifications and open the new one.
  3. Repeat with another event and press Decline.
- **Expected result:** Dee sees the toast "You are going". Ana gets "✅ Dee is coming to <event>", then "❌ Dee can't make <event>" for the decline; both open the Calendar on the event.
- **Automation:** `pg_refs_test` (the reply carries the event id)

#### TC-CAL-028 — Guest accepts, declines and leaves
- **Requirement:** FR-CAL-021
- **Type / Priority:** Functional · P1
- **Preconditions:** Dee has two pending invitations (E1, E2).
- **Test data:** None.
- **Steps:**
  1. Look at E1 in Dee's Calendar; open it.
  2. Press **Accept**. Open it again.
  3. Press **Leave event** and read the confirmation; confirm.
  4. Open E2 and press **Decline**.
- **Expected result:** Pending event has a dashed style, the group icon and the "Invitation" tag; details show Organiser and "Waiting for you". After Accept: "Going" and the button **Leave event**; confirmation "Leave “<name>”? It is removed from your calendar. The organiser is told." After leaving or declining the event is gone from Dee's calendar, toast "Invitation declined". Dee has no Edit or Delete button.
- **Automation:** Manual

#### TC-CAL-029 — Who can see the guest list
- **Requirement:** FR-CAL-022
- **Type / Priority:** Security · P1
- **Preconditions:** Event by Ana; guests Dee (accepted), Bo (declined), Cy (pending); Eli is not on the event.
- **Test data:** None.
- **Steps:**
  1. Open the event as Ana and read Guests.
  2. As Dee read Guests.
  3. As Bo (declined) try to open the guest list through `event_attendees`.
  4. As Eli call `event_attendees` for the event.
- **Expected result:** Ana sees herself ("organiser"), Dee (going), Bo (declined), Cy (invited). Dee sees organiser, Dee "(you)", Cy, but not Bo. Bo and Eli get the error "Not allowed".
- **Automation:** Manual

#### TC-CAL-030 — Organiser removes a guest; re-invite a decliner
- **Requirement:** FR-CAL-023
- **Type / Priority:** Functional · P2
- **Preconditions:** Event with Dee (accepted) and Bo (declined).
- **Test data:** None.
- **Steps:**
  1. As Ana edit the event; press the x on Dee's chip; Save.
  2. Edit again; invite Bo; Save.
  3. Check notifications of Dee and Bo.
- **Expected result:** Dee disappears from the list and from Dee's calendar; Dee gets no notification. Bo becomes pending again and gets a new "invited you" notification.
- **Automation:** Manual

#### TC-CAL-031 — Invitation data is private
- **Requirement:** FR-CAL-024
- **Type / Priority:** Security · P1
- **Preconditions:** Event E by Ana with Dee invited; Eli unrelated.
- **Test data:** None.
- **Steps:**
  1. As Dee try to read `luma.events` for Ana's other event (REST: select all events).
  2. As Dee try to update and delete E.
  3. As Eli read `luma.event_invites` directly.
  4. As Ana delete E; check Dee's calendar.
- **Expected result:** 1 Dee sees only her own events (E arrives only via `my_invited_events`). 2 Update and delete change nothing (0 rows). 3 Permission denied (no table access). 4 E disappears for Dee as well.
- **Automation:** Manual

#### TC-CAL-032 — Busy and packed thresholds (Normal)
- **Requirement:** FR-CAL-025
- **Type / Priority:** Boundary · P1
- **Preconditions:** Sensitivity Normal, alerts on.
- **Test data:** Day A: 5 all-day events; day B: 6; day C: 8; day D: 9; day E: events 09:00–10:00 and 09:30–10:30; day F: four timed events all 10:00–11:00 (3 clashes).
- **Steps:**
  1. Create the days; look at the Month view and the hover text.
  2. Open day B in Day view.
- **Expected result:** A none; B amber with warning icon "Busy: 6 things"; C amber; D red with flame "Packed: 9 things"; E amber ("1 clash"); F red (3 clashes = packed). Day view of B shows "This day is busy" with the reason.
- **Automation:** `pg_busy_test` (server counts: events, tasks, hours, clashes)

#### TC-CAL-033 — Sensitivity levels and 6-hour rule
- **Requirement:** FR-CAL-025, FR-CAL-027
- **Type / Priority:** Boundary · P2
- **Preconditions:** A day with 4 all-day events; a day with timed events totalling 6 hours.
- **Test data:** Timed events 08:00–11:00 and 13:00–16:00; sensitivity Sensitive / Normal / Relaxed.
- **Steps:**
  1. In Settings → Preferences set "How easily a day counts as busy" to Sensitive; look at both days.
  2. Set Normal, then Relaxed.
- **Expected result:** Sensitive: 4 events = amber; Normal: not coloured; the 6-hour day is amber in Sensitive and Normal and uncoloured in Relaxed (needs 8 hours). Sensitive reaches red at 6 things / 6 hours.
- **Automation:** `pg_busy_test` (levels sensitive / relaxed on the server)

#### TC-CAL-034 — Notice bar and dismissal
- **Requirement:** FR-CAL-026
- **Type / Priority:** Functional · P2
- **Preconditions:** Today normal; tomorrow 9 things (packed); in 4 days 6 things (busy).
- **Test data:** None.
- **Steps:**
  1. Open Calendar.
  2. Read the notice; press the day button for the busy day.
  3. Press the x on the notice; reload the page; sign out and in.
- **Expected result:** "Tomorrow is packed" (red, flame) with "9 things. Think about moving something." and an "Also:" list with the busy day; the day button opens that day in Day view. The x hides the notice for the rest of today in that browser session; after a new session it shows again.
- **Automation:** Manual

#### TC-CAL-035 — "Tomorrow is busy / packed" notification at 6 pm
- **Requirement:** FR-CAL-028
- **Type / Priority:** Integration · P1
- **Preconditions:** Ana's time zone has 18:xx now; tomorrow has 11 things.
- **Test data:** Variations: switch "Tell me the evening before" off; alerts off; relaxed.
- **Steps:**
  1. Run the job (`select luma.run_busy_alerts()`) or wait for minute 5 of the hour.
  2. Run it again within the hour.
  3. Switch each preference and run again on another day.
- **Expected result:** One notification "🔥 Tomorrow is packed" with "11 things…" linking to the Calendar; not sent twice; nothing when the push or alert switch is off; Relaxed gives "⚠️ Tomorrow is busy"; nothing at other hours.
- **Automation:** `pg_busy_test`

#### TC-CAL-036 — Event reminders (15 minutes before, all-day at 08:00)
- **Requirement:** FR-CAL-029
- **Type / Priority:** Integration · P1
- **Preconditions:** Ana with event reminders on (default).
- **Test data:** Event at now + 14 minutes; all-day event today; lead time set to 30 in Settings → Reminders.
- **Steps:**
  1. Wait for the minute job (or run `run_event_reminders()`).
  2. Wait until 08:00 for the all-day event.
  3. Check that a second run does not repeat it.
  4. Invite Dee to the event and check Dee's notifications.
- **Expected result:** "📅 <title> starts in 14 min" ("At 3:14 pm · Health") linking to the Calendar; "📅 <title> is today" at 08:00 ("All day · <category>"); no repeat within 12 hours; Dee (a guest) gets no event reminder (only the owner does).
- **Automation:** Manual

#### TC-CAL-037 — Mode scoping and Work / Study items
- **Requirement:** FR-CAL-030
- **Type / Priority:** Integration · P1
- **Preconditions:** Cy has Work and Study; a Work-mode event "W-event", a Study class and deadline, a Work task due today, a Personal event "P-event".
- **Test data:** Switches "Show Work in Personal", "Show Study in Personal".
- **Steps:**
  1. In Personal open the Calendar with both switches off.
  2. Switch Work on; switch Study on; look at the category panel.
  3. Switch to Work mode, then Study mode.
  4. Create an event while in Work mode; switch to Personal with Work switch off.
- **Expected result:** Off: only P-event (no "Classes", "Study" or "Work tasks" filters). Work on: W-event and the Work task (filter "Work tasks"); Study on: classes and deadlines (filters "Classes", "Study"). Work mode shows Work items only. The event made in Work mode is not visible in Personal when the switch is off. A person without the add-on never gets those filters.
- **Automation:** `edge/space_test.js` (filter rules, printed)

#### TC-CAL-038 — Export to .ics
- **Requirement:** FR-CAL-031
- **Type / Priority:** Functional · P2
- **Preconditions:** Ana has: weekly event "Gym" 07:00–08:00, all-day event "Holiday", open task "Write report" due 20 Oct, bill "Internet" RM 129 monthly; accepted invitation "Lunch".
- **Test data:** None.
- **Steps:**
  1. Press **Export**; read the confirmation.
  2. Press **Download**.
  3. Open the file in a text editor and in Google / Apple / Outlook Calendar.
- **Expected result:** Confirmation lists the counts ("3 events, 1 open task and 1 bill …"); a toast "Calendar saved" and the file `LUMA-calendar.ics`. In the file: Gym has `RRULE:FREQ=WEEKLY` and a 15-minute alarm; Holiday is all-day with no alarm; "Task: Write report" and "Bill: Internet (RM 129.00)" are all-day, the bill with `FREQ=MONTHLY`; the accepted invitation is included. Lines are folded at 75 characters; commas, semicolons and line breaks are escaped.
- **Automation:** Manual

#### TC-CAL-039 — Export with nothing to export
- **Requirement:** FR-CAL-031
- **Type / Priority:** Negative · P3
- **Preconditions:** A new account with no events, tasks or bills.
- **Test data:** None.
- **Steps:**
  1. Press **Export**.
  2. Add one task with a due date and press Export; choose Cancel on the confirmation.
- **Expected result:** 1 The message "There is nothing to export yet." 2 After Cancel nothing is downloaded.
- **Automation:** Manual

#### TC-CAL-040 — Date picker: typed dates and month/year
- **Requirement:** FR-CAL-032
- **Type / Priority:** Functional · P2
- **Preconditions:** Open the picker from the New event "Date" box.
- **Test data:** Typed values: 25/12/2026, 25-12-2026, 25.12.26, 2026-12-25, 31/04/2026, abc; year 1899 and 2101.
- **Steps:**
  1. Open the picker; check that the week starts on Monday and today is marked.
  2. Press the month name; choose "Mar" and change the year to 2028.
  3. Type each value in "Or type the date" and press **Go**.
  4. Press **Today**, then **Close**.
- **Expected result:** Valid formats select 25 Dec 2026; 31/04/2026 and "abc" show an error in the picker and keep the old date; years outside 1900–2100 are not accepted; Today picks today; Close dismisses without change; Esc also closes.
- **Automation:** Manual

#### TC-CAL-041 — Open an event from a notification
- **Requirement:** FR-CAL-033
- **Type / Priority:** Integration · P2
- **Preconditions:** Event notifications for (a) a one-off event next month, (b) a weekly event started last month, (c) an event on a day with 9 events.
- **Test data:** None.
- **Steps:**
  1. Open each notification from the bell.
- **Expected result:** (a) Month view of that month; (b) today's occurrence (month of today), not the first date; (c) the Day view of that day because it is crowded.
- **Automation:** Manual

#### TC-CAL-042 — Events are private
- **Requirement:** FR-CAL-034
- **Type / Priority:** Security · P1
- **Preconditions:** Ana and Dee each have events.
- **Test data:** Ana's event id.
- **Steps:**
  1. As Dee select Ana's event by id through the API; try update and delete.
  2. As an unauthenticated client select events.
  3. As Ana insert an event with `title` of 121 characters, a category "Fun", a start "25:00" and repeats "hourly".
- **Expected result:** 1 and 2 no rows / 0 rows changed. 3 Each insert is refused by the table's checks (title length, category, time pattern, repeats).
- **Automation:** Manual

#### TC-CAL-043 — Calendar load and save error messages
- **Requirement:** FR-CAL-035
- **Type / Priority:** Negative · P3
- **Preconditions:** A test project where migration 027 is not run (or the events request blocked).
- **Test data:** None.
- **Steps:**
  1. Open the Calendar.
  2. Try to save an event.
- **Expected result:** The grid shows "Could not load events — has supabase/migrations/027_events.sql been run in the Supabase SQL Editor?"; the form shows "The calendar isn't set up yet — run supabase/migrations/027_events.sql in the SQL Editor." (messages are developer-facing).
- **Automation:** Manual

#### TC-CAL-044 — Calendar layout on a laptop and on phones
- **Requirement:** NFR-CAL-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** Month with a busy-day notice and many events.
- **Test data:** Widths 320, 360, 390 and 1180 px (also a short laptop window 1180 × 650).
- **Steps:**
  1. Open Month, Week, Day and Year at each width.
  2. Open New event, the details popup, the invite picker and View all.
- **Expected result:** No horizontal scrollbar at 320 / 360 / 390; Month fits its card with "+N more" instead of overflowing, also on the short window (the notice bar does not cause overflow); Export shows an icon only below 560 px; every popup fits the screen.
- **Automation:** `rig/audit.sh` and `rig/audit_modals.sh` 320 / 360 · 390 and 1180 manual

#### TC-CAL-045 — Busy-day alerts switched off
- **Requirement:** FR-CAL-027
- **Type / Priority:** Functional · P2
- **Preconditions:** A packed day exists.
- **Test data:** None.
- **Steps:**
  1. Switch "Busy-day alerts" off in Settings → Preferences.
  2. Open the Calendar, the Dashboard and the Day view of the packed day.
- **Expected result:** No colouring, no icons, no notice bar anywhere; switching it on brings them back. (The 6 pm notification also stops, see TC-CAL-035.)
- **Automation:** `pg_busy_test` (server side switch)

#### TC-CAL-046 — Calendar draws at once and refreshes
- **Requirement:** NFR-CAL-002
- **Type / Priority:** Performance · P3
- **Preconditions:** Browser throttled to Slow 3G; Calendar visited before.
- **Test data:** An event added on another device meanwhile.
- **Steps:**
  1. Open another page, then the Calendar.
  2. Watch the grid and the Upcoming list; reopen within 60 seconds from the Dashboard.
- **Expected result:** The grid shows at once from data in memory and updates when events, tasks, bills and invitations arrive; the busy-day data is not reloaded within 60 seconds.
- **Automation:** Manual

---

## 3. Reminders (REM)

#### TC-REM-001 — Groups and subtitle
- **Requirement:** FR-REM-001, FR-REM-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana (Dawn) has: daily reminder "Stretch" 09:00, one-time reminder that already fired, a paused reminder "Old".
- **Test data:** As above.
- **Steps:**
  1. Open Reminders.
  2. Read the subtitle and the three groups.
  3. Click the row "Stretch".
- **Expected result:** Groups Upcoming, Done, Paused in that order; subtitle "N upcoming · next: Stretch today/<date>". Each row shows title, "Every day · 9:00 am", "Next: …", switch, pencil and bin; "Old" shows "Paused"; the fired one-time reminder shows "Done". The click opens Edit reminder.
- **Automation:** `v49_test` (renders only)

#### TC-REM-002 — Empty state and ideas
- **Requirement:** FR-REM-003
- **Type / Priority:** Usability · P2
- **Preconditions:** A new account in Personal mode; repeat in Study and Work mode.
- **Test data:** None.
- **Steps:**
  1. Open Reminders; read the text.
  2. Press "Pay rent".
  3. Switch to Study mode and look again.
- **Expected result:** "Add your first reminder" with four ideas (Fill in the timesheet, Pay rent, Weekly review, Back up your files); "Pay rent" opens New reminder filled (monthly, 09:00, day 1). Study shows different text and ideas (Revise today's lessons …).
- **Automation:** Manual

#### TC-REM-003 — Create a reminder
- **Requirement:** FR-REM-004, FR-REM-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Reminders open.
- **Test data:** "Call mum", Every week, Sat, 10:00, note "Sunday plans".
- **Steps:**
  1. Press New reminder; type the data; pick Every week and tick Sat.
  2. Press **Add reminder**.
- **Expected result:** It appears under Upcoming with "Every Sat · 10:00 am" and the note; the hint under Repeat explains each kind as it is chosen.
- **Automation:** Manual

#### TC-REM-004 — Form validation
- **Requirement:** FR-REM-004
- **Type / Priority:** Negative · P1
- **Preconditions:** New reminder form.
- **Test data:** Empty name; time cleared; "Does not repeat" with date cleared.
- **Steps:**
  1. Press Add reminder with empty name.
  2. Type a name, clear the time, press Add.
  3. Restore time, choose Does not repeat, clear the date, press Add.
- **Expected result:** "Give the reminder a name." / "Choose the time." / "Pick the date." Nothing is saved.
- **Automation:** Manual

#### TC-REM-005 — Field length limits
- **Requirement:** FR-REM-004
- **Type / Priority:** Boundary · P3
- **Preconditions:** New reminder form.
- **Test data:** Name 120 characters; note 300 characters; try one more of each.
- **Steps:**
  1. Fill both boxes to the maximum and try one more character; Save.
- **Expected result:** Boxes stop at 120 and 300; reminder saves.
- **Automation:** Manual

#### TC-REM-006 — Weekly with no day picked
- **Requirement:** FR-REM-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Today is Friday.
- **Test data:** Every week, no day ticked.
- **Steps:**
  1. Create the reminder, read the hint and the description.
- **Expected result:** Hint "Pick the days. If you pick none, it uses the weekday of today." The row reads "Every Fri · <time>" and next date is the next Friday.
- **Automation:** Manual

#### TC-REM-007 — Monthly, yearly and last-day rules
- **Requirement:** FR-REM-007
- **Type / Priority:** Boundary · P1
- **Preconditions:** None.
- **Test data:** Monthly starting 31 Jan; "Last weekday of every month"; "Last day of every month"; yearly 29 Feb 2028.
- **Steps:**
  1. Create each and read "Next:" in different months (move the device date or check descriptions).
  2. Check "Every weekend" and "Every weekday".
- **Expected result:** Monthly fires on the 28th/29th/30th in short months; last weekday never lands on Sat/Sun (for example 30 Oct 2026 Friday, 31 Jul 2026 Friday, 28 Feb 2026 is a Saturday so 27 Feb); last day on the calendar's last day; yearly on 28 Feb in non-leap years; weekdays Mon–Fri only; weekends Sat–Sun only. Kinds without a date field use today as the start.
- **Automation:** Manual

#### TC-REM-008 — Past time refused for new one-time reminder
- **Requirement:** FR-REM-008
- **Type / Priority:** Boundary · P1
- **Preconditions:** Now is 14:30.
- **Test data:** One-time, today, times 14:15, 14:20, 14:21, 14:30 and yesterday.
- **Steps:**
  1. Try to add each.
  2. Edit an existing one-time reminder to yesterday's date and save.
- **Expected result:** Yesterday and 14:15–14:19 give "That time has already passed. Pick a later time or date." (more than 10 minutes ago); 14:20 and later are accepted per the 10-minute grace (exact edge: 14:20 accepted). Editing is not blocked.
- **Automation:** Manual

#### TC-REM-009 — Pause and resume
- **Requirement:** FR-REM-009
- **Type / Priority:** Functional · P2
- **Preconditions:** An active reminder.
- **Test data:** None.
- **Steps:**
  1. Press the switch; look at the groups.
  2. Press again.
  3. Let a paused reminder's time pass (see TC-REM-016).
- **Expected result:** It moves to Paused ("Paused"), then back to Upcoming; a paused reminder sends no notification.
- **Automation:** Manual

#### TC-REM-010 — Editing lets it fire again
- **Requirement:** FR-REM-010
- **Type / Priority:** Functional · P3
- **Preconditions:** A reminder due at 09:00 that fired at 09:01 today.
- **Test data:** Change the note at 09:05.
- **Steps:**
  1. Edit and save at 09:05.
  2. Wait one minute.
- **Expected result:** It fires a second time because `last_fired_on` was cleared and 09:05 is within 10 minutes of its time (known behaviour, see Findings).
- **Automation:** Manual

#### TC-REM-011 — Delete and Undo
- **Requirement:** FR-REM-011
- **Type / Priority:** Functional · P2
- **Preconditions:** A reminder "Pay rent".
- **Test data:** None.
- **Steps:**
  1. Press the bin; read the dialog; Delete.
  2. Press Undo in the toast.
- **Expected result:** Dialog "Delete this reminder? "Pay rent" will stop reminding you."; after Delete the toast "Reminder deleted" offers Undo which re-adds it with the same fields.
- **Automation:** Manual

#### TC-REM-012 — Dawn limit of 5
- **Requirement:** FR-REM-012
- **Type / Priority:** Boundary · P1
- **Preconditions:** Ana (Dawn) with 4 reminders (2 of them paused).
- **Test data:** Reminders 5 and 6.
- **Steps:**
  1. Add the 5th.
  2. Press New reminder again.
  3. Press **See plans**.
  4. Edit an existing reminder and save.
  5. Via the API insert a 6th reminder.
- **Expected result:** 5th is accepted. A dialog "Plan limit reached — Your Dawn plan includes up to 5 custom reminders. Upgrade to add more." with See plans (opens Plans). Editing still works. The API insert fails with "Plan limit: the Dawn plan allows up to 5 custom reminders. Upgrade your plan in Settings to add more."
- **Automation:** Manual

#### TC-REM-013 — Glow 25 and Zenith unlimited
- **Requirement:** FR-REM-012
- **Type / Priority:** Boundary · P2
- **Preconditions:** Bo (Glow) with 25 reminders; Cy (Zenith) with 26.
- **Test data:** None.
- **Steps:**
  1. As Bo press New reminder.
  2. As Cy add a 27th.
- **Expected result:** Bo is blocked at 25 ("up to 25 custom reminders"); Cy can add without limit.
- **Automation:** Manual

#### TC-REM-014 — Server delivers a reminder
- **Requirement:** FR-REM-013
- **Type / Priority:** Integration · P1
- **Preconditions:** Ana with push on; time zone Asia/Kuala_Lumpur.
- **Test data:** One-time reminder "Take medicine" at now+2 minutes, note "With water".
- **Steps:**
  1. Wait until the time (or run `select luma.run_custom_reminders()`).
  2. Open the notification bell; click it.
- **Expected result:** Notification "⏰ Take medicine" with body "With water" within 10 minutes of the time, a push on the phone, and the click opens Reminders; the reminder moves to Done.
- **Automation:** Manual

#### TC-REM-015 — Fires once a day and respects the window
- **Requirement:** FR-REM-014, FR-REM-013
- **Type / Priority:** Boundary · P2
- **Preconditions:** Daily reminder at 09:00.
- **Test data:** Run the job at 08:59, 09:00, 09:10, 09:11 and again at 09:30.
- **Steps:**
  1. Call `run_custom_reminders()` at each time.
- **Expected result:** Nothing at 08:59 and 09:11; one notification the first time at 09:00–09:10 only; no second one on the same day; fires again the next day.
- **Automation:** Manual

#### TC-REM-016 — Next occurrence on the page
- **Requirement:** FR-REM-015
- **Type / Priority:** Functional · P3
- **Preconditions:** Now is 10:00; daily reminders at 09:00 (already passed more than 10 minutes) and 09:55.
- **Test data:** As above.
- **Steps:**
  1. Open Reminders and read "Next:".
- **Expected result:** The 09:00 one shows "Next: Tomorrow, 9:00 am"; the 09:55 one shows "Today" (within 10 minutes). A one-time reminder in the past with active state shows "Done".
- **Automation:** Manual

#### TC-REM-017 — Reminders per mode
- **Requirement:** FR-REM-016
- **Type / Priority:** Integration · P2
- **Preconditions:** Cy with Work; reminder created in Work mode; one in Personal.
- **Test data:** None.
- **Steps:**
  1. In Personal with "Show Work in Personal" off open Reminders.
  2. Switch the preference on.
- **Expected result:** Only the Personal reminder first; both after the switch. The Work reminder still sends its notification at its time while off.
- **Automation:** `edge/space_test.js` (filter rule only)

#### TC-REM-018 — Reminders are private
- **Requirement:** FR-REM-017
- **Type / Priority:** Security · P1
- **Preconditions:** Ana and Dee have reminders.
- **Test data:** Ana's reminder id.
- **Steps:**
  1. As Dee select, update and delete Ana's reminder by id via the API.
  2. Insert a reminder with kind "hourly" or remind_time "9am".
- **Expected result:** 0 rows returned / changed; the invalid kind and time are refused by table checks.
- **Automation:** Manual

#### TC-REM-019 — Load and save errors
- **Requirement:** FR-REM-018
- **Type / Priority:** Negative · P3
- **Preconditions:** Reminders request blocked (test project without migration 032).
- **Test data:** None.
- **Steps:**
  1. Open Reminders and try to save.
- **Expected result:** "Could not load reminders" with the hint about migration 032; the form shows "Reminders aren't set up yet — run supabase/migrations/032_reminders.sql in the Supabase SQL Editor."
- **Automation:** Manual

#### TC-REM-020 — Form on phones
- **Requirement:** NFR-REM-002
- **Type / Priority:** Responsive · P2
- **Preconditions:** None.
- **Test data:** 320, 360, 390 px; 1180 px.
- **Steps:**
  1. Open the page and the New reminder form (Every week with days).
- **Expected result:** No horizontal scroll; day buttons and repeat chips wrap; Add reminder reachable.
- **Automation:** `rig/audit_modals.sh` 320 / 360 · otherwise manual

#### TC-REM-021 — Delivery latency
- **Requirement:** NFR-REM-001
- **Type / Priority:** Performance · P3
- **Preconditions:** Active reminders at 5 different times.
- **Test data:** None.
- **Steps:**
  1. Record the time each notification arrives against its set time over a day.
- **Expected result:** Each arrives within the minute after its time (maximum 10 minutes if a run is late), in the person's own time zone.
- **Automation:** Manual

---

## 4. Tasks (TASK)

#### TC-TASK-001 — Board layout and subtitle
- **Requirement:** FR-TASK-001, FR-TASK-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana with: To do "B" due in 3 days, To do "A" due today, To do "C" no date, In progress "D" overdue, Done "E".
- **Test data:** As above.
- **Steps:**
  1. Open Tasks.
- **Expected result:** Columns To do (A, B, C order), In progress (D), Done (E crossed out, dimmed) with counts; subtitle "4 open · 1 due today · 1 overdue" (open = not done: A, B, C, D). Cards show priority pill, tag, due label and arrow / bin.
- **Automation:** `v49_test` (renders only)

#### TC-TASK-002 — Create from header and from a column
- **Requirement:** FR-TASK-003
- **Type / Priority:** Functional · P1
- **Preconditions:** Tasks open.
- **Test data:** "Book flights", due 30 Oct, High, tag "Errand", notes "Compare prices".
- **Steps:**
  1. Press **Add task** (header); fill; Save.
  2. Press "+ Add task" at the bottom of the In progress column.
- **Expected result:** First task in To do with High pill and "Errand"; the column button opens the form with Status In progress already chosen. Default priority Medium, default tag Personal.
- **Automation:** Manual

#### TC-TASK-003 — Validation
- **Requirement:** FR-TASK-004
- **Type / Priority:** Negative · P1
- **Preconditions:** New task form.
- **Test data:** Empty name; name without due date.
- **Steps:**
  1. Press Save empty.
  2. Type a name only; press Save.
  3. Press Enter in the name box.
- **Expected result:** "Give the task a name." then "Pick a due date."; Enter in the name box behaves like Save; nothing is saved while a message shows.
- **Automation:** Manual

#### TC-TASK-004 — Length limits
- **Requirement:** FR-TASK-004, FR-TASK-005
- **Type / Priority:** Boundary · P2
- **Preconditions:** New task form.
- **Test data:** Title 200 chars; tag 30 chars; notes 2,000 chars; one more each; via API notes of 2,001 chars.
- **Steps:**
  1. Fill each to the maximum, try one more, Save.
  2. Send the 2,001-character note through the API.
- **Expected result:** Boxes stop at the maximum and the task saves; the API insert is refused by the notes check (2,000).
- **Automation:** Manual

#### TC-TASK-005 — Tags and priority
- **Requirement:** FR-TASK-005
- **Type / Priority:** Functional · P3
- **Preconditions:** New task form.
- **Test data:** Chips Personal, Work, Study, Errand; free tag "Garden".
- **Steps:**
  1. Press each chip; type a free tag; clear the tag; Save.
  2. Check the task's mode.
- **Expected result:** The chip highlights when the typed tag matches; an empty tag saves as "Personal"; choosing "Work" or "Study" only labels the task; it stays in the current mode and is not shown in Work or Study.
- **Automation:** Manual

#### TC-TASK-006 — Move between statuses
- **Requirement:** FR-TASK-006
- **Type / Priority:** Functional · P1
- **Preconditions:** A task in To do.
- **Test data:** None.
- **Steps:**
  1. Press the arrow on the card three times.
  2. Press the status chip and choose To do.
  3. Open the task and press the Done button, Save.
  4. Press the arrow on a Done task.
- **Expected result:** To do → In progress → Done; the chip menu jumps straight to any status; the form button sets the status; arrow on Done ("Reopen") moves it to To do.
- **Automation:** Manual

#### TC-TASK-007 — Completion time
- **Requirement:** FR-TASK-007
- **Type / Priority:** Data · P2
- **Preconditions:** A To do task.
- **Test data:** None.
- **Steps:**
  1. Set it Done; read `completed_at` (API or Analytics).
  2. Set it back to In progress.
- **Expected result:** `completed_at` is set at the time of completion and cleared again when it leaves Done.
- **Automation:** Manual

#### TC-TASK-008 — Repeating task creates the next one
- **Requirement:** FR-TASK-008
- **Type / Priority:** Functional · P1
- **Preconditions:** A weekly task "Water plants" due last Monday, with a checklist of 2 ticked steps.
- **Test data:** Repeat Weekly; today is Friday.
- **Steps:**
  1. Set it Done.
  2. Look at the board.
  3. Reopen it and set Done again.
- **Expected result:** Toast "Next one added"; a new To do task "Water plants" due next Monday (first date after both the old date and today) with steps unticked, same priority/tag/notes; the second Done creates no further copy.
- **Automation:** `pg_tasks_test`

#### TC-TASK-009 — Repeat date rules
- **Requirement:** FR-TASK-008
- **Type / Priority:** Boundary · P2
- **Preconditions:** None.
- **Test data:** Daily due today; weekdays finished on Friday; monthly due 31 Jan; yearly; overdue a week.
- **Steps:**
  1. Finish each and read the new due date.
- **Expected result:** Daily → tomorrow; weekdays Fri → Monday; monthly 31 Jan → 28 Feb; yearly → next year; an overdue daily task → tomorrow (after today, not the next day after its old date).
- **Automation:** `pg_tasks_test`

#### TC-TASK-010 — Checklist limits
- **Requirement:** FR-TASK-009
- **Type / Priority:** Boundary · P2
- **Preconditions:** Task form.
- **Test data:** 30 steps, then a 31st; a step of 120 chars.
- **Steps:**
  1. Add steps with Enter and the plus button.
  2. Add the 31st step.
  3. Tick one step, edit another, remove another; leave an empty step; Save.
- **Expected result:** 30 accepted; the 31st shows "A checklist can have up to 30 steps."; step box stops at 120; the card badge shows "done/total" (green when all ticked); empty steps are dropped. Via API a checklist of 31 items is refused.
- **Automation:** `pg_tasks_test` (checklist must be a list only)

#### TC-TASK-011 — Edit a task
- **Requirement:** FR-TASK-010
- **Type / Priority:** Functional · P2
- **Preconditions:** A task.
- **Test data:** New title and due date.
- **Steps:**
  1. Click the card body; change fields; **Save changes**.
- **Expected result:** Popup titled "Edit task" with button "Save changes"; the card updates and re-sorts.
- **Automation:** Manual

#### TC-TASK-012 — Delete and Undo
- **Requirement:** FR-TASK-011
- **Type / Priority:** Functional · P1
- **Preconditions:** A task with checklist and notes.
- **Test data:** None.
- **Steps:**
  1. Press the bin; read the dialog; Delete.
  2. Press Undo.
  3. Delete from the edit popup and Cancel.
- **Expected result:** Dialog "Delete “<title>”? This task is removed. This can't be undone."; toast "Task deleted" with Undo restores title, status, priority, tag, due date, notes, repeat and checklist; Cancel keeps it.
- **Automation:** Manual

#### TC-TASK-013 — Due labels
- **Requirement:** FR-TASK-012
- **Type / Priority:** Functional · P2
- **Preconditions:** Open tasks due yesterday, today, tomorrow, in 10 days, and a Done task due yesterday.
- **Test data:** None.
- **Steps:**
  1. Read each card's due label.
- **Expected result:** "Overdue · <date>" (red), "Today", "Tomorrow", "<d Mon>"; the Done task shows its date without "Overdue".
- **Automation:** Manual

#### TC-TASK-014 — Tasks in Calendar, Dashboard and busy days
- **Requirement:** FR-TASK-013
- **Type / Priority:** Integration · P1
- **Preconditions:** Open task due today.
- **Test data:** None.
- **Steps:**
  1. Check Calendar today, Dashboard chips, priorities and overview.
  2. Mark the task Done; recheck.
- **Expected result:** It appears everywhere (and counts toward the busy-day total) while open; it disappears from all after Done.
- **Automation:** `pg_busy_test` (tasks count toward the server day load)

#### TC-TASK-015 — Daily digest notification
- **Requirement:** FR-TASK-014
- **Type / Priority:** Integration · P2
- **Preconditions:** Task reminders on, hour 09:00; 2 tasks due today and 3 overdue.
- **Test data:** Run `run_morning_reminders()` at 09:xx local; again at 10:xx; with only overdue tasks; with task reminders off.
- **Steps:**
  1. Run the job at each moment.
- **Expected result:** One notification "✅ 2 tasks due today" with "3 more overdue. Open Tasks to tick them off." linking to Tasks; none at other hours or within 12 hours; with only overdue: "✅ 3 overdue tasks"; nothing when switched off.
- **Automation:** Manual

#### TC-TASK-016 — Tasks per mode
- **Requirement:** FR-TASK-015
- **Type / Priority:** Integration · P2
- **Preconditions:** Cy with Work.
- **Test data:** A task made in Work mode.
- **Steps:**
  1. Check Tasks in Personal with the Work switch off, then on.
- **Expected result:** Hidden, then shown.
- **Automation:** `edge/space_test.js` (filter rule only)

#### TC-TASK-017 — Tasks are private and constrained
- **Requirement:** FR-TASK-016
- **Type / Priority:** Security · P1
- **Preconditions:** Ana and Dee with tasks.
- **Test data:** status "blocked", priority "urgent", repeat "hourly".
- **Steps:**
  1. As Dee read, update, delete Ana's task by id.
  2. Insert tasks with the invalid values.
- **Expected result:** 0 rows visible or changed; invalid values refused by checks.
- **Automation:** `pg_tasks_test` (unknown repeat refused)

#### TC-TASK-018 — No plan limit on tasks
- **Requirement:** FR-TASK-017
- **Type / Priority:** Boundary · P3
- **Preconditions:** Ana (Dawn).
- **Test data:** 250 tasks (script).
- **Steps:**
  1. Insert 250 tasks; open Tasks.
- **Expected result:** All saved; no "Plan limit" message.
- **Automation:** Manual

#### TC-TASK-019 — Empty state and load error
- **Requirement:** FR-TASK-018
- **Type / Priority:** Usability · P2
- **Preconditions:** New account; then tasks request blocked.
- **Test data:** None.
- **Steps:**
  1. Open Tasks.
  2. Block the request and reopen.
- **Expected result:** Subtitle "0 open · 0 due today", each column only shows "+ Add task"; blocked: "Could not load tasks — has supabase/migrations/002_tasks.sql been run?"
- **Automation:** Manual

#### TC-TASK-020 — Failed update and delete
- **Requirement:** FR-TASK-019
- **Type / Priority:** Negative · P3
- **Preconditions:** Device offline.
- **Test data:** None.
- **Steps:**
  1. Press the arrow on a task; then the bin and confirm.
- **Expected result:** Alerts "Could not update task: …" and "Could not delete task: …"; the card stays unchanged.
- **Automation:** Manual

#### TC-TASK-021 — Board on phones and laptop
- **Requirement:** NFR-TASK-001, NFR-TASK-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** 12 tasks in To do.
- **Test data:** 320, 360, 390, 1024 and 1180 px.
- **Steps:**
  1. Open Tasks at each width; scroll; open the task popup.
- **Expected result:** At ≤1024 px one column; no horizontal scroll at 320/360/390; at 1180 px three columns, each scrolls inside with a fade at the bottom; popup fits.
- **Automation:** `rig/audit.sh` / `audit_modals.sh` 320 and 360 · otherwise manual

---

## 5. Notes (NOTE)

#### TC-NOTE-001 — Notes grid
- **Requirement:** FR-NOTE-001, FR-NOTE-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana has 3 notes, one with a 400-character body and 2 attached documents.
- **Test data:** As above.
- **Steps:**
  1. Open Notes; read cards and subtitle.
  2. Click the long note.
- **Expected result:** Newest update first; subtitle "3 notes · your personal knowledge base"; the card body ends with "…" after 220 characters and shows "2 documents"; the view popup shows full text with line breaks, documents, "Created … · Updated … (GMT+8)".
- **Automation:** `v49_test` (renders only)

#### TC-NOTE-002 — Create a note; Save enabled only with title and body
- **Requirement:** FR-NOTE-002
- **Type / Priority:** Negative · P1
- **Preconditions:** None.
- **Test data:** Title "Ideas" (120 chars max), body "First idea".
- **Steps:**
  1. Press New note; look at Save note.
  2. Type only a title; then only a body; then both.
  3. Try 121 characters in the title.
- **Expected result:** Save is disabled until both have non-blank text; title stops at 120; note appears at the top after saving.
- **Automation:** Manual

#### TC-NOTE-003 — Tags: pick, add, clear
- **Requirement:** FR-NOTE-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Notes tagged Work exist.
- **Test data:** New tag "Garden" (and a 31-character tag).
- **Steps:**
  1. In the editor press "+ Add", type Garden, press Enter.
  2. Click the selected tag again.
  3. Type "work" (lower case) as a new tag.
  4. With filter "Work" on, press New note.
- **Expected result:** The tag is selected; clicking again clears it (a note can have no tag, card shows "No tag"); "work" reuses "Work"; tag box stops at 30; the new note starts with the filtered tag.
- **Automation:** Manual

#### TC-NOTE-004 — Tag colours
- **Requirement:** FR-NOTE-004
- **Type / Priority:** Functional · P3
- **Preconditions:** A new tag.
- **Test data:** Change Garden to green.
- **Steps:**
  1. Create the tag; note its colour.
  2. Press its dot and choose another colour (or use the colour row).
  3. Reload.
- **Expected result:** A random unused colour is assigned; the new one shows on cards, filters and picker and persists after reload; names differing only in case share one colour.
- **Automation:** Manual

#### TC-NOTE-005 — Filter chips
- **Requirement:** FR-NOTE-005
- **Type / Priority:** Functional · P2
- **Preconditions:** Notes with tags Work, Home and none.
- **Test data:** None.
- **Steps:**
  1. Press the chip "Home", then "All".
  2. Delete the last Home note while the Home chip is on.
- **Expected result:** Only Home notes show, then all; after deleting the last note of a tag, its chip disappears and the view returns to All.
- **Automation:** Manual

#### TC-NOTE-006 — Search and date filter
- **Requirement:** FR-NOTE-006, FR-NOTE-014
- **Type / Priority:** Functional · P2
- **Preconditions:** Notes "Ideas" (body "budget"), "Trip" (tag Home).
- **Test data:** Searches "BUDGET", "home", "zzz".
- **Steps:**
  1. Type each search.
  2. Use "Any time" → a range that excludes every note.
  3. Delete all notes.
- **Expected result:** Matches ignore case and cover title, body and tag; "zzz" gives "No notes match."; with no notes "No notes yet — hit New note."
- **Automation:** Manual

#### TC-NOTE-007 — Edit a note
- **Requirement:** FR-NOTE-008
- **Type / Priority:** Functional · P2
- **Preconditions:** A note.
- **Test data:** New body text.
- **Steps:**
  1. Press the pencil, change the body and Save.
- **Expected result:** Changes saved, the note moves to the top and its Updated time changes.
- **Automation:** Manual

#### TC-NOTE-008 — Delete a note and Undo
- **Requirement:** FR-NOTE-009
- **Type / Priority:** Functional · P2
- **Preconditions:** A note with one attached document.
- **Test data:** None.
- **Steps:**
  1. Press the bin; read the dialog; confirm.
  2. Press Undo.
  3. Open Documents.
- **Expected result:** Dialog "Delete this note? “<title>” will be deleted. Attached documents are kept."; Undo restores title, body and tag but not the attachment; the document is still in Documents.
- **Automation:** Manual

#### TC-NOTE-009 — Attach documents
- **Requirement:** FR-NOTE-010, FR-NOTE-012
- **Type / Priority:** Functional · P2
- **Preconditions:** Ana has 3 documents and 1 shared by Dee.
- **Test data:** None.
- **Steps:**
  1. Open a note → **Attach from Documents**.
  2. Search for part of a name; press select all; untick one.
  3. Done, then Save note.
  4. Click an attachment chip; press its x; Save.
- **Expected result:** Own and shared documents are listed with date and size; counts show "(n)"; empty states "No documents yet — use Upload." / "No documents match."; the chip opens the preview; the x removes the link only.
- **Automation:** Manual

#### TC-NOTE-010 — Upload from the note
- **Requirement:** FR-NOTE-011
- **Type / Priority:** Boundary · P2
- **Preconditions:** Ana (Dawn: 5 MB per file, 50 MB total).
- **Test data:** 2 MB PDF; 6 MB PDF.
- **Steps:**
  1. Press **Upload new** with each file.
  2. Check Documents.
- **Expected result:** 2 MB is attached and appears in Documents as Uncategorised; the 6 MB file shows an error above the form "Plan limit: the Dawn plan allows files up to 5 MB. Upgrade your plan in Settings for bigger files."
- **Automation:** Manual

#### TC-NOTE-011 — A withdrawn share disappears from the note
- **Requirement:** FR-NOTE-012
- **Type / Priority:** Integration · P3
- **Preconditions:** Dee shared a document with Ana; Ana attached it to a note.
- **Test data:** None.
- **Steps:**
  1. Dee un-shares the document.
  2. Ana reopens the note.
- **Expected result:** The attachment is no longer listed and the count drops.
- **Automation:** Manual

#### TC-NOTE-012 — No note sharing in Personal
- **Requirement:** FR-NOTE-013
- **Type / Priority:** Usability · P3
- **Preconditions:** A note.
- **Test data:** None.
- **Steps:**
  1. Look for a Share control on the card, view and editor.
- **Expected result:** There is none; only documents can be shared (Documents page).
- **Automation:** Manual

#### TC-NOTE-013 — Notes are private
- **Requirement:** FR-NOTE-015
- **Type / Priority:** Security · P1
- **Preconditions:** Ana's note N with document D; Dee's account.
- **Test data:** ids of N and D.
- **Steps:**
  1. As Dee read, update, delete N and read its tag colours.
  2. As Dee link her note to a document she cannot see (Ana's unshared D).
- **Expected result:** No rows / no change; the link insert is refused by row-level security.
- **Automation:** Manual

#### TC-NOTE-014 — Notes per mode
- **Requirement:** FR-NOTE-016
- **Type / Priority:** Integration · P2
- **Preconditions:** Cy; note made in Work mode.
- **Test data:** None.
- **Steps:**
  1. Open Notes in Personal with the Work switch off, then on.
- **Expected result:** Hidden, then shown.
- **Automation:** `edge/space_test.js` (filter rule only)

#### TC-NOTE-015 — Save failure keeps the editor
- **Requirement:** FR-NOTE-017
- **Type / Priority:** Negative · P3
- **Preconditions:** Device offline.
- **Test data:** None.
- **Steps:**
  1. Write a note and press Save note.
- **Expected result:** The editor stays open and a red message with the error shows above the form; the Save button is usable again.
- **Automation:** Manual

#### TC-NOTE-016 — Notes on phones
- **Requirement:** NFR-NOTE-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Several notes with tags and attachments.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Notes, the editor, the picker and the view.
- **Expected result:** One column on phones, no horizontal scroll, popups fit.
- **Automation:** `rig/audit.sh` / `audit_modals.sh` 320 and 360 · otherwise manual

---
## 6. Documents (DOC)

#### TC-DOC-001 — Documents grid and subtitle
- **Requirement:** FR-DOC-001, FR-DOC-025
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana with 2 documents, 1 shared with her.
- **Test data:** "Passport.pdf" in category ID, shared with 1 contact.
- **Steps:**
  1. Open Documents.
  2. Delete all documents and look again.
- **Expected result:** Cards show icon, name, category path, share count, date, size; subtitle "2 files (+1 shared with you) · 7 categories". With none: "No documents here yet — hit Upload."
- **Automation:** `v49_test` (renders only)

#### TC-DOC-002 — Category filter chips and breadcrumb
- **Requirement:** FR-DOC-002
- **Type / Priority:** Functional · P2
- **Preconditions:** Category Finance with sub-category Receipts; documents in each and one with no category.
- **Test data:** None.
- **Steps:**
  1. Press the chips All, Finance, Receipts, Uncategorised, Shared with me.
  2. Delete the uncategorised document.
- **Expected result:** Finance shows a count/chevron and a second row with Receipts; Finance lists its own and Receipts documents; the Uncategorised chip only exists while such a document exists; Shared with me shows its count.
- **Automation:** Manual

#### TC-DOC-003 — Date filter
- **Requirement:** FR-DOC-003
- **Type / Priority:** Functional · P3
- **Preconditions:** Documents uploaded on different days.
- **Test data:** A range that excludes all.
- **Steps:**
  1. Use "Any time" to choose a range with no documents.
- **Expected result:** "No documents in this date range."; in Shared with me the shared date is used.
- **Automation:** Manual

#### TC-DOC-004 — Upload several files
- **Requirement:** FR-DOC-004, FR-DOC-005, FR-DOC-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Cy (Zenith).
- **Test data:** Files a.pdf (1 MB), b.png (1 MB), c.docx (1 MB); a.pdf picked twice.
- **Steps:**
  1. Press Upload; drop all four (a.pdf twice).
  2. Choose category Receipts; remove c.docx with its x; press **Upload 2 files**.
- **Expected result:** The duplicate is ignored; the Name box is hidden for several files; both files show Uploading… then Uploaded; popup closes; both appear at the top with category Receipts.
- **Automation:** Manual

#### TC-DOC-005 — Single file with custom name
- **Requirement:** FR-DOC-005
- **Type / Priority:** Functional · P2
- **Preconditions:** None.
- **Test data:** File scan001.pdf, name "Rental agreement".
- **Steps:**
  1. Choose the file; the Name box shows scan001.pdf; change it; press Upload.
  2. With a category chip on, open Upload.
- **Expected result:** Document saved as "Rental agreement"; the category is pre-selected when a category chip is on, none under All.
- **Automation:** Manual

#### TC-DOC-006 — Partial failure and retry
- **Requirement:** FR-DOC-006
- **Type / Priority:** Negative · P2
- **Preconditions:** Ana (Dawn).
- **Test data:** ok.pdf (1 MB) and big.pdf (6 MB).
- **Steps:**
  1. Drop both; press Upload.
  2. Remove big.pdf and press the button again.
  3. Press Upload with an empty queue.
- **Expected result:** big.pdf is marked "Over 5 MB (your plan limit)" and ok.pdf uploads; the message "1 file couldn't be uploaded: …" shows and the button reads Retry; an empty queue says "Choose or drop at least one file."
- **Automation:** Manual

#### TC-DOC-007 — Hard 50 MB ceiling
- **Requirement:** FR-DOC-007
- **Type / Priority:** Boundary · P2
- **Preconditions:** Cy (Zenith, 50 MB per file).
- **Test data:** 50 MB file and 50 MB + 1 byte file.
- **Steps:**
  1. Upload each.
- **Expected result:** 50 MB is accepted (if storage allows); 50 MB + 1 byte is refused with "File is larger than 50 MB."
- **Automation:** Manual

#### TC-DOC-008 — Per-file limit by plan
- **Requirement:** FR-DOC-008
- **Type / Priority:** Boundary · P1
- **Preconditions:** Ana (Dawn 5 MB), Bo (Glow 20 MB), Cy (Zenith 50 MB).
- **Test data:** Files of exactly the limit and the limit + 1 KB for each plan.
- **Steps:**
  1. Upload each file as each person.
  2. Send the oversized file through the API directly (bypassing the page).
- **Expected result:** Exactly-limit files are accepted; larger ones are marked "Over N MB (your plan limit)" and the server refuses with "Plan limit: the <Plan> plan allows files up to N MB. Upgrade your plan in Settings for bigger files."
- **Automation:** Manual

#### TC-DOC-009 — Total storage limit
- **Requirement:** FR-DOC-009
- **Type / Priority:** Boundary · P1
- **Preconditions:** Ana (Dawn, 50 MB) already stores 48 MB.
- **Test data:** 1.9 MB file (fits), 2.1 MB file (does not).
- **Steps:**
  1. Upload the 1.9 MB file, then delete it.
  2. Upload the 2.1 MB file.
  3. Delete a large file and retry.
- **Expected result:** First accepted; second refused with "Plan limit: the Dawn plan includes 50 MB of file storage and it is full. Delete files or upgrade your plan in Settings."; after deleting it succeeds. Documents in Work / Study mode count too.
- **Automation:** Manual

#### TC-DOC-010 — Upload rollback and storage path
- **Requirement:** FR-DOC-010
- **Type / Priority:** Data · P3
- **Preconditions:** Access to Storage.
- **Test data:** File "my résumé (1).pdf"; a file the server refuses on insert (over plan limit via API).
- **Steps:**
  1. Upload the file and look at the object path.
  2. Force a failure after the file is stored (limit refusal) and look at Storage.
- **Expected result:** Path `<user id>/<random id>-my_r_sum_1_.pdf`-style (unsafe characters replaced); after a failed record the stored file is removed.
- **Automation:** Manual

#### TC-DOC-011 — Rename and change category
- **Requirement:** FR-DOC-011
- **Type / Priority:** Functional · P2
- **Preconditions:** A document and a shared-with-me document.
- **Test data:** New name "Passport copy".
- **Steps:**
  1. Press the pencil on an own document; clear the name and Save; then enter the new name and a category.
  2. Press the folder icon on the shared document.
- **Expected result:** Empty name: "Enter a name."; saved name and category shown. The shared one opens "Add to category" without a name box and only files it in Ana's own category.
- **Automation:** Manual

#### TC-DOC-012 — Delete a document
- **Requirement:** FR-DOC-012
- **Type / Priority:** Functional · P1
- **Preconditions:** A document shared with Dee and attached to a note.
- **Test data:** None.
- **Steps:**
  1. Press the bin; read the dialog; Delete.
  2. Check Dee's Shared with me, the note and Storage.
- **Expected result:** Dialog "Delete this document? “<name>” will be permanently deleted. This can't be undone."; the record and file are gone; Dee no longer sees it; the note lost the attachment.
- **Automation:** Manual

#### TC-DOC-013 — Preview types
- **Requirement:** FR-DOC-013, FR-DOC-015
- **Type / Priority:** Functional · P1
- **Preconditions:** One file of each type.
- **Test data:** .png, .pdf, .mp4, .mp3, .txt, .md, .json, .docx, .xlsx with 1,500 rows, .csv, .zip.
- **Steps:**
  1. Click each document.
  2. Press Download; press Esc.
- **Expected result:** Images, PDF, video, audio, text previews work; the spreadsheet shows the first 1,000 rows with the note "Showing the first 1000 rows — download for the full sheet." and sheet tabs for several sheets; the zip shows "No preview for this file type — use Download."; Download saves under the document's name; Esc closes. Header reads "Uploaded <date time> (GMT+8)".
- **Automation:** Manual

#### TC-DOC-014 — Preview errors and offline
- **Requirement:** FR-DOC-014
- **Type / Priority:** Negative · P3
- **Preconditions:** A .docx and a .xlsx never opened in this session.
- **Test data:** Block cdn.jsdelivr.net or go offline.
- **Steps:**
  1. Open each; then open a document whose file was removed from Storage.
- **Expected result:** "Couldn't preview this file (Could not load preview library (offline?)) — use Download."; the missing file shows "Could not load file: …".
- **Automation:** Manual

#### TC-DOC-015 — Manage categories
- **Requirement:** FR-DOC-016, FR-DOC-017
- **Type / Priority:** Functional · P1
- **Preconditions:** Default categories.
- **Test data:** New "Taxes"; sub-category "2026" under Finance.
- **Steps:**
  1. Press Categories; add Taxes with a colour.
  2. Press + on Finance; enter 2026.
  3. Rename Taxes to "Tax"; move it inside Finance with the list; change its colour.
  4. Close.
- **Expected result:** Each change appears at once, with indentation for depth and the colour on cards and chips.
- **Automation:** Manual

#### TC-DOC-016 — Category rules
- **Requirement:** FR-DOC-017
- **Type / Priority:** Negative · P1
- **Preconditions:** Categories Finance / Receipts.
- **Test data:** Duplicate "finance" at top level; sub "receipts" twice under Finance; a chain of 6 levels; move Finance inside Receipts.
- **Steps:**
  1. Try each.
- **Expected result:** "You already have a category with that name." / "That category already has a subcategory with this name." / "Categories can be nested at most 5 levels deep." (error shown, nothing created); moving a category into itself or its descendants is refused (the list does not offer it; the API says "A category cannot be placed inside itself or its own subcategory."). Names are compared ignoring case; the same name under different parents is allowed.
- **Automation:** Manual

#### TC-DOC-017 — Default categories
- **Requirement:** FR-DOC-018
- **Type / Priority:** Data · P3
- **Preconditions:** Register a new account.
- **Test data:** None.
- **Steps:**
  1. Open Documents → Categories.
- **Expected result:** Seven categories: Contracts, Receipts, Finance, ID, Health, Warranty, Other.
- **Automation:** Manual

#### TC-DOC-018 — Delete a category
- **Requirement:** FR-DOC-019
- **Type / Priority:** Functional · P2
- **Preconditions:** Finance with 2 documents and 1 sub-category.
- **Test data:** None.
- **Steps:**
  1. Press the bin on Finance; read the dialog; confirm.
  2. Look at Uncategorised and the sub-category.
- **Expected result:** Dialog mentions "Its 2 documents will become uncategorised. Its 1 subcategory will move to top level."; the documents stay under Uncategorised; the sub-category is top level.
- **Automation:** Manual

#### TC-DOC-019 — Share with contacts
- **Requirement:** FR-DOC-020, FR-DOC-021
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana and Dee are accepted contacts; Ana has "Lease.pdf".
- **Test data:** None.
- **Steps:**
  1. Press the share icon; tick Dee; press **Share**.
  2. As Dee open the bell and Contacts chat; open Documents → Shared with me.
  3. Dee tries to rename, delete the file, and download it.
- **Expected result:** Ana sees "Shared with 1 contact" and the popup closes; the card shows the share count; Dee gets "Ana shared a document with you" (opens the file) and the chat message "📎 I shared a document with you: “Lease.pdf”. Find it under Documents → Shared with me."; Dee can view and download but has no rename or delete.
- **Automation:** `pg_refs_test` (shared-file notification carries the document id)

#### TC-DOC-020 — Withdraw access and sharing rules
- **Requirement:** FR-DOC-020
- **Type / Priority:** Security · P1
- **Preconditions:** Lease.pdf shared with Dee; Eli is not Ana's contact.
- **Test data:** Eli's id.
- **Steps:**
  1. Untick Dee and press Share.
  2. Insert a share for Eli through the API; a share to oneself; Dee tries to share Ana's document.
- **Expected result:** "Removed access for 1" and Dee loses access at once; the API refuses Eli (not an accepted contact), self-sharing, and a non-owner. With no contacts the dialog says "No contacts yet — add one on the Contacts page and wait for them to accept."
- **Automation:** Manual

#### TC-DOC-021 — Shared with me actions
- **Requirement:** FR-DOC-022
- **Type / Priority:** Functional · P2
- **Preconditions:** Dee has a shared document.
- **Test data:** Category Receipts.
- **Steps:**
  1. Open Shared with me; read a card.
  2. Press the folder icon, choose Receipts, Save; open Receipts and All.
  3. Press the x on the card.
- **Expected result:** Card shows "From <Ana>", the shared date and size; after filing it also appears under Receipts and All; the x removes it from Dee's list only (Ana still has it, share row removed).
- **Automation:** Manual

#### TC-DOC-022 — Files are private
- **Requirement:** FR-DOC-023
- **Type / Priority:** Security · P1
- **Preconditions:** Ana's document D (not shared) and its storage path.
- **Test data:** Path of D.
- **Steps:**
  1. As Dee read D's row and download its storage path; try to upload into Ana's folder.
  2. Ana shares D with Dee; Dee downloads it; Ana unshares; Dee retries.
  3. Dee tries to delete D's file.
- **Expected result:** Denied before sharing; allowed only while shared; upload into another person's folder and deletes are denied; the bucket is not public.
- **Automation:** Manual

#### TC-DOC-023 — Documents per mode
- **Requirement:** FR-DOC-024
- **Type / Priority:** Integration · P2
- **Preconditions:** Cy with Study; a document uploaded in Study mode.
- **Test data:** None.
- **Steps:**
  1. Open Documents in Personal with the Study switch off, then on.
- **Expected result:** Hidden, then shown.
- **Automation:** `edge/space_test.js` (filter rule only)

#### TC-DOC-024 — Shared-with-me empty state and load error
- **Requirement:** FR-DOC-025, FR-DOC-026
- **Type / Priority:** Usability · P3
- **Preconditions:** No shares; then blocked request.
- **Test data:** None.
- **Steps:**
  1. Open Shared with me.
  2. Block the documents request and reopen.
- **Expected result:** "Nothing shared with you yet — files your contacts share will appear here automatically."; blocked: "Could not load documents — has supabase/migrations/003_documents.sql been run?"
- **Automation:** Manual

#### TC-DOC-025 — Large-file preview libraries load lazily
- **Requirement:** NFR-DOC-001
- **Type / Priority:** Performance · P3
- **Preconditions:** Browser network panel open.
- **Test data:** A .docx.
- **Steps:**
  1. Open Documents; then open an image; then open the .docx.
- **Expected result:** jszip, docx-preview and xlsx are requested only when a matching file is opened, once per session.
- **Automation:** Manual

#### TC-DOC-026 — Documents on phones and laptop
- **Requirement:** NFR-DOC-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** 12 documents, three nested categories.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Documents, Upload, Share, Categories and the preview at each width.
- **Expected result:** No horizontal scroll, long names are cut with "…", chips wrap, popups fit; the preview is usable at 320 px.
- **Automation:** `rig/audit.sh` / `audit_modals.sh` 320 and 360 · otherwise manual

#### TC-DOC-027 — Three uploads at once
- **Requirement:** NFR-DOC-002, FR-DOC-005
- **Type / Priority:** Performance · P3
- **Preconditions:** Cy.
- **Test data:** Six 5 MB files.
- **Steps:**
  1. Upload all six and watch the queue.
- **Expected result:** No more than three show "Uploading…" at the same time; all six finish.
- **Automation:** Manual

---

## 7. Contacts and chat (CON)

#### TC-CON-001 — Page layout
- **Requirement:** FR-CON-001, FR-CON-010
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana has 2 accepted contacts, 1 incoming and 1 outgoing request.
- **Test data:** None.
- **Steps:**
  1. Open Contacts.
- **Expected result:** Blocks All contacts, Requests and Follow-ups; subtitle "2 people · N follow-ups due"; each contact row shows a coloured initial, name, email, "No chats yet" or time since last message, Nudge and Message buttons and a "New message" or "Follow up" pill when due.
- **Automation:** `v49_test` (renders only)

#### TC-CON-002 — Send a contact request
- **Requirement:** FR-CON-002, FR-CON-003, FR-CON-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Dee has a LUMA account.
- **Test data:** "  DEE@Example.com " (different case, spaces).
- **Steps:**
  1. Ana presses **Add contact**, types the email, presses **Send request**.
  2. As Dee open the bell.
- **Expected result:** "Request sent — waiting for them to accept." and the popup closes; Ana's Requests show "Request sent / Pending / Cancel"; Dee gets "Ana sent you a contact request" (opens Contacts and highlights the request).
- **Automation:** `pg_refs_test` (notification carries the contact id)

#### TC-CON-003 — Request error messages
- **Requirement:** FR-CON-002, FR-CON-003
- **Type / Priority:** Negative · P1
- **Preconditions:** Ana has a pending request to Dee and an accepted contact Bo.
- **Test data:** Empty; nobody@nowhere.test; Ana's own email; Dee's; Bo's.
- **Steps:**
  1. Send each in turn.
- **Expected result:** "Enter an email address." / "No LUMA account found with that email." / "That's your own email — pick someone else." / "There's already a pending request between you two — check Requests below." / "You're already connected with this person."
- **Automation:** Manual

#### TC-CON-004 — Accept, decline and cancel
- **Requirement:** FR-CON-008, FR-CON-009, FR-CON-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Pending requests Dee→Ana and Ana→Bo.
- **Test data:** None.
- **Steps:**
  1. Ana presses Accept on Dee's request.
  2. Ana presses Cancel on her request to Bo.
  3. Another person's request: press Decline.
  4. As the requester, try to accept your own request through the API.
- **Expected result:** Dee appears in All contacts and Dee gets "Ana accepted your contact request" ("You can now chat and share documents with each other."); the cancelled request disappears; declining sends no notification; the requester cannot accept (update only allowed for the addressee).
- **Automation:** `pg_refs_test` (accepted notification carries the contact id)

#### TC-CON-005 — Re-request after decline
- **Requirement:** FR-CON-004
- **Type / Priority:** Functional · P3
- **Preconditions:** Dee declined Ana's request.
- **Test data:** Dee's email.
- **Steps:**
  1. Ana sends a request to Dee again.
- **Expected result:** It succeeds as a new pending request (same contact record) and Dee is notified again.
- **Automation:** Manual

#### TC-CON-006 — Contact limit on sending
- **Requirement:** FR-CON-005
- **Type / Priority:** Boundary · P1
- **Preconditions:** Ana (Dawn, limit 3) has 1 accepted contact and 1 pending outgoing request.
- **Test data:** Requests to a 3rd and a 4th person.
- **Steps:**
  1. Send the 3rd request.
  2. Send the 4th.
  3. Cancel one pending request and resend.
  4. Repeat with Bo (Glow, 12) and Cy (Zenith).
- **Expected result:** 3rd allowed; the 4th is refused with "Plan limit: the Dawn plan allows up to 3 contacts. Upgrade your plan in Settings to add more." shown in the popup; after cancelling it works; Glow stops at 12; Zenith has no limit. Incoming requests do not count for the receiver until accepted.
- **Automation:** Manual

#### TC-CON-007 — Contact limit on accepting
- **Requirement:** FR-CON-006
- **Type / Priority:** Boundary · P2
- **Preconditions:** Dee (Dawn) already has 3 accepted contacts; Cy (Zenith) sends Dee a request.
- **Test data:** None.
- **Steps:**
  1. Dee presses Accept.
- **Expected result:** The accept fails with the plan-limit message for Dee's plan; the request stays pending.
- **Automation:** Manual

#### TC-CON-008 — Re-opening a declined request ignores the limit
- **Requirement:** FR-CON-005, FR-CON-004
- **Type / Priority:** Negative · P2
- **Preconditions:** Ana (Dawn) has 3 pending/accepted; two earlier requests were declined by X and Y.
- **Test data:** X's and Y's emails.
- **Steps:**
  1. Send a request to X and then to Y.
- **Expected result:** Specified result is "Plan limit" refusal; the code re-opens a declined row by an update and the limit trigger only checks inserts and accepts, so the request may succeed (see Findings). Record the actual behaviour.
- **Automation:** Manual

#### TC-CON-009 — Follow-ups block
- **Requirement:** FR-CON-011
- **Type / Priority:** Boundary · P2
- **Preconditions:** Contacts: P (unread message), Q (last message 6 days ago), R (last message 7 days ago), S (never messaged).
- **Test data:** None.
- **Steps:**
  1. Open Contacts and read Follow-ups.
  2. Click P's card.
- **Expected result:** Cards for P (first, "New", "P sent a new message you haven't read yet."), R ("It's been 1 week — you usually check in around now."), S ("You haven't messaged yet — say hi to break the ice."); not Q. The click opens the chat. With none: "Nothing needs a follow-up right now."
- **Automation:** Manual

#### TC-CON-010 — Open chat and history paging
- **Requirement:** FR-CON-012
- **Type / Priority:** Boundary · P1
- **Preconditions:** A chat with 45 messages.
- **Test data:** None.
- **Steps:**
  1. Press Message; look at the scroll position.
  2. Scroll to the top twice.
- **Expected result:** The latest 20 messages show, scrolled to the bottom with "Scroll up for earlier messages"; each scroll loads 20 more (the last load 5) while keeping the reading place; the note disappears when all are loaded.
- **Automation:** Manual

#### TC-CON-011 — Send a message
- **Requirement:** FR-CON-013
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana and Dee accepted.
- **Test data:** "  Hello <b>Dee</b>  ", empty, spaces only.
- **Steps:**
  1. Type each into the box and press Enter / the arrow.
- **Expected result:** The first is sent trimmed and shown as plain text (the tags are visible, not bold); empty and spaces-only do nothing.
- **Automation:** Manual

#### TC-CON-012 — Realtime delivery and read marker
- **Requirement:** FR-CON-014, FR-CON-015, NFR-CON-002
- **Type / Priority:** Integration · P1
- **Preconditions:** Ana and Dee both signed in on different devices; Ana has the chat with Dee open.
- **Test data:** "ping".
- **Steps:**
  1. Dee sends "ping".
  2. Ana closes the chat; Dee sends "pong"; Ana opens Contacts.
  3. Ana opens the chat.
- **Expected result:** "ping" appears in Ana's open chat within a few seconds and counts as read; "pong" shows the "New message" pill and a follow-up card; opening the chat clears them and the notification.
- **Automation:** Device only

#### TC-CON-013 — Daily limit of 50 messages
- **Requirement:** FR-CON-016
- **Type / Priority:** Boundary · P1
- **Preconditions:** Ana has sent 48 messages today.
- **Test data:** Messages 49, 50, 51.
- **Steps:**
  1. Send two messages; read the counter after each.
  2. Send the 51st.
  3. Next day after midnight (Ana's time zone) send again.
- **Expected result:** Counter "2 messages left today" (amber) → "0": "You've used all of today's messages. It resets at midnight." (red); the 51st shows a message bubble "Daily limit reached: you can send up to 50 chat messages a day. It resets at midnight."; works again after midnight. The same limit applies on Glow and Zenith.
- **Automation:** Manual

#### TC-CON-014 — Chat privacy
- **Requirement:** FR-CON-017
- **Type / Priority:** Security · P1
- **Preconditions:** Chat Ana–Dee; Eli unrelated; a pending contact Ana–Bo.
- **Test data:** contact ids.
- **Steps:**
  1. As Eli read messages and insert a message into Ana–Dee.
  2. As Ana insert a message with sender = Dee; with empty body.
  3. As Ana insert a message into the pending contact with Bo.
  4. Remove the contact Ana–Dee and count messages.
- **Expected result:** Everything is refused (row-level security / checks); after removal the messages are deleted.
- **Automation:** Manual

#### TC-CON-015 — Message notification
- **Requirement:** FR-CON-018
- **Type / Priority:** Functional · P2
- **Preconditions:** Dee has the app closed.
- **Test data:** Ana sends a 200-character message, then another.
- **Steps:**
  1. Ana sends the messages; look at Dee's notifications.
  2. Dee taps the notification.
- **Expected result:** One notification "Ana sent you a message" with the first 120 characters (the earlier unread one is replaced); tapping opens Contacts with that chat.
- **Automation:** Manual

#### TC-CON-016 — Nudge
- **Requirement:** FR-CON-019, FR-CON-020
- **Type / Priority:** Functional · P1
- **Preconditions:** Ana and Dee accepted.
- **Test data:** Two nudges within 3 minutes; the second after 3 minutes.
- **Steps:**
  1. Ana presses **Nudge** (list and chat).
  2. Press again immediately; reload the page and look at the button.
  3. After 3 minutes press again.
  4. Dee opens the notification.
- **Expected result:** Toast "Nudge sent — Dee will get a notification to read your message."; the button reads "Nudged · m:ss" with a countdown and is disabled (also after reload); the server refuses early repeats ("Already nudged … you can nudge again in m:ss."); after 3 minutes it works; Dee sees "Ana nudged you 👋 — You have a message waiting — open the chat to read it." which opens the chat.
- **Automation:** Manual

#### TC-CON-017 — Nudge a removed contact
- **Requirement:** FR-CON-019, FR-CON-020
- **Type / Priority:** Negative · P3
- **Preconditions:** Ana has the Contacts page open; Dee removes the contact meanwhile.
- **Test data:** None.
- **Steps:**
  1. Ana presses Nudge.
- **Expected result:** Alert "Couldn't send the nudge — is this contact still connected?"; no notification.
- **Automation:** Manual

#### TC-CON-018 — Contacts feed invitations and sharing
- **Requirement:** FR-CON-021
- **Type / Priority:** Integration · P2
- **Preconditions:** Ana: accepted Dee; pending Bo.
- **Test data:** None.
- **Steps:**
  1. Open the event invite picker and the document share dialog.
- **Expected result:** Only Dee is offered in both.
- **Automation:** Manual

#### TC-CON-019 — Contact rows are private
- **Requirement:** FR-CON-022
- **Type / Priority:** Security · P1
- **Preconditions:** Ana–Dee contact; Eli unrelated.
- **Test data:** contact id.
- **Steps:**
  1. As Eli select, update to accepted, and delete the Ana–Dee contact.
  2. As Ana insert a contact row with requester = Dee.
  3. As Ana (requester) set a pending row to accepted.
- **Expected result:** Eli sees nothing and changes nothing; Ana cannot create rows as Dee nor accept her own request.
- **Automation:** Manual

#### TC-CON-020 — Contact list data
- **Requirement:** FR-CON-023
- **Type / Priority:** Data · P3
- **Preconditions:** Contacts with and without names.
- **Test data:** A contact without first/last name.
- **Steps:**
  1. Open Contacts.
- **Expected result:** A person without a name is shown by email; the newest chat is first; unread flag is right.
- **Automation:** Manual

#### TC-CON-021 — Contact error messages
- **Requirement:** FR-CON-024
- **Type / Priority:** Negative · P3
- **Preconditions:** Offline or blocked request.
- **Test data:** None.
- **Steps:**
  1. Open Contacts; open a chat; send a message.
- **Expected result:** "Couldn't load contacts: …", "Couldn't load message history: …", "Couldn't send that — …". The unsent message stays shown as a sent bubble (see Findings).
- **Automation:** Manual

#### TC-CON-022 — Arriving from a notification
- **Requirement:** FR-CON-025
- **Type / Priority:** Integration · P2
- **Preconditions:** Dee has a nudge and a message notification from Ana.
- **Test data:** None.
- **Steps:**
  1. Dee taps each notification from another page.
- **Expected result:** The Contacts page opens with Ana's chat already open.
- **Automation:** Manual

#### TC-CON-023 — Contacts on phones and laptop
- **Requirement:** NFR-CON-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** 3 contacts, requests, follow-ups.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Contacts, Add contact and a chat at each width.
- **Expected result:** One column on phones; buttons wrap under the name; chat fits; at 1180 px two columns (list and 320 px follow-ups).
- **Automation:** `rig/audit.sh` / `audit_modals.sh` 320 and 360 · otherwise manual

---

## 8. Focus mode (FOC)

#### TC-FOC-001 — Open and close
- **Requirement:** FR-FOC-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in.
- **Test data:** None.
- **Steps:**
  1. Press the Focus Mode card (play button) in the side menu.
  2. Start the timer; close with the x; reopen.
  3. Click outside the window.
- **Expected result:** The window opens; closing does not stop a running timer (it continues and shows the remaining time when reopened); a click outside closes it.
- **Automation:** Manual

#### TC-FOC-002 — Modes and default lengths
- **Requirement:** FR-FOC-002
- **Type / Priority:** Functional · P1
- **Preconditions:** New account.
- **Test data:** None.
- **Steps:**
  1. Read the three tabs; press Short Break, Long Break, Focus; start and switch tab while running.
- **Expected result:** 25 / 5 / 15 minutes; phase text "Deep work session" / "Short break" / "Long break"; switching stops the timer and resets to the full length.
- **Automation:** Manual

#### TC-FOC-003 — Start, pause, reset, skip
- **Requirement:** FR-FOC-003
- **Type / Priority:** Functional · P1
- **Preconditions:** Focus tab, 25:00.
- **Test data:** None.
- **Steps:**
  1. Press play for 10 s, press pause, press play, press reset.
  2. Press skip in Focus and skip in a break.
  3. Check "Today" line after skip.
- **Expected result:** Countdown and progress bar run and pause; reset restores 25:00 stopped; skip switches Focus ↔ Short Break without recording a session.
- **Automation:** Manual

#### TC-FOC-004 — Duration steppers
- **Requirement:** FR-FOC-004
- **Type / Priority:** Boundary · P1
- **Preconditions:** None.
- **Test data:** Focus 1 and 90; try 0 and 91.
- **Steps:**
  1. Press − until 1, then once more; press + until 90, then once more.
  2. Change Focus while the Focus mode is running.
- **Expected result:** Stops at 1 and 90; tabs and the side-menu card ("Deep work · N mins") update; changing the current mode's length stops and resets the timer.
- **Automation:** Manual

#### TC-FOC-005 — Session completes
- **Requirement:** FR-FOC-005, FR-FOC-006, FR-FOC-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Focus length 1 minute; sound Rain; then None with the "sounds" preference off.
- **Test data:** None.
- **Steps:**
  1. Run a focus session to the end.
  2. Run the following Short Break to the end.
  3. Open the window and read the "Today" line; check `luma.focus_sessions`.
  4. Repeat with sound None and sounds off.
- **Expected result:** Chime (only when a sound is chosen or sounds are on), toast "Focus session done 🎉 — 1 minutes. Time for a break.", the tab changes to Short Break stopped; after the break "Break over — Ready for the next focus session?" and back to Focus. One session row (1 minute, sound "rain"); the line reads "Today: 1 session · 1 min of focus" (minutes of 60 or more show as "1h" plus the remaining minutes only when not zero); no chime in the last run.
- **Automation:** Manual

#### TC-FOC-006 — Ambience and volume
- **Requirement:** FR-FOC-008
- **Type / Priority:** Functional · P2
- **Preconditions:** Speakers on.
- **Test data:** Each of the 8 sounds; volume 0, 50, 100.
- **Steps:**
  1. With the timer stopped press each sound; listen for about 5 seconds.
  2. Start the timer; change sound and volume.
  3. Pause.
- **Expected result:** A short preview that stops after 5 seconds; during a running timer the sound switches at once; pausing or finishing stops it; volume changes the loudness and the % label; no audio files are downloaded.
- **Automation:** Device only

#### TC-FOC-007 — Saved setup follows the person
- **Requirement:** FR-FOC-009
- **Type / Priority:** Integration · P2
- **Preconditions:** Two devices signed in as Ana.
- **Test data:** Focus 30, short 7, long 20, Waves, 70 %.
- **Steps:**
  1. On device 1 change all settings; wait a second.
  2. Sign in on device 2 (fresh browser).
  3. Edit the stored `focus_setup` to focus 200 and volume 150 and reload.
- **Expected result:** Device 2 shows the saved setup; out-of-range values are ignored (focus stays at its previous value, volume at 50 %).
- **Automation:** Manual

#### TC-FOC-008 — Study subject tag
- **Requirement:** FR-FOC-010
- **Type / Priority:** Integration · P3
- **Preconditions:** Study mode, a class running now for subject "Physics".
- **Test data:** 1-minute session.
- **Steps:**
  1. Complete a session in Study mode.
- **Expected result:** The session row has `course_id` of Physics; outside class time it has none.
- **Automation:** Manual

#### TC-FOC-009 — Sessions are private
- **Requirement:** FR-FOC-011
- **Type / Priority:** Security · P2
- **Preconditions:** Ana has sessions.
- **Test data:** minutes 0, 241; sound of 21 characters.
- **Steps:**
  1. As Dee read and delete Ana's sessions.
  2. Insert invalid sessions as Dee.
- **Expected result:** No rows / no change; invalid values refused (1–240 minutes, sound ≤ 20 characters).
- **Automation:** Manual

#### TC-FOC-010 — Save failure is silent
- **Requirement:** FR-FOC-012
- **Type / Priority:** Negative · P3
- **Preconditions:** Device offline.
- **Test data:** 1-minute session.
- **Steps:**
  1. Finish a session offline.
- **Expected result:** The completion toast and move to the break happen; no error is shown; the session is not recorded.
- **Automation:** Manual

#### TC-FOC-011 — Window on short screens and phones
- **Requirement:** NFR-FOC-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** None.
- **Test data:** 320, 360, 390 px wide; heights 700 and 860 px; 1180 px laptop.
- **Steps:**
  1. Open the window at each size; scroll the lower part (durations, sounds, volume).
- **Expected result:** No horizontal scroll; timer and controls always visible; the lower settings scroll inside the window.
- **Automation:** `rig/audit_modals.sh` 320 / 360 (if the Focus popup is covered — TBC) · otherwise manual

#### TC-FOC-012 — Timer in a background tab
- **Requirement:** NFR-FOC-002, FR-FOC-005
- **Type / Priority:** Performance · P3
- **Preconditions:** 5-minute focus.
- **Test data:** Switch to another tab / lock the phone for the whole time.
- **Steps:**
  1. Start the timer; leave the tab hidden for 5 minutes; return.
- **Expected result:** Record the elapsed time shown versus real time (the timer subtracts a second per tick, so a throttled tab may run late); TBC.
- **Automation:** Device only

---

## Findings

1. **Reopening a declined contact request skips the plan limit.** `request_contact` re-opens a declined row with an UPDATE (migration 001) and `enforce_contact_limit` (migration 033) only checks INSERTs and the move to "accepted", so a Dawn person at 3 contacts can send more requests to people who once declined. See TC-CON-008.
2. **Dropzone text says "max 25 MB each"** (`documents.html`) but the real limits are 5 / 20 / 50 MB by plan and a hard 50 MB.
3. **Client storage check over-counts.** `documents.data.js` sums `documents.size_bytes` with no owner filter; because recipients may read shared documents, files shared with the person are added to their used storage in the page's check (the server trigger counts only the owner's own files, so the page can refuse an upload the server would allow).
4. **Failed chat message stays as a sent bubble.** `sendContactChatMessage` shows the own bubble before the server answers; on error an extra "Couldn't send that" bubble is added but the unsent text is not removed (contacts.js). A document share also sends a chat message that counts toward the 50 a day and can fail silently.
5. **Guests get no event reminders and no change notices.** `run_event_reminders` loops over `luma.events` (owner only), so invited people are never reminded; editing an event, removing a guest or deleting the event notifies nobody. Invited events are not filtered by mode (`CINV` is not scoped by `luma-space.js`), so they show in Work and Study calendars too (TBC).
6. **Busy-day numbers differ between the page and the server.** The server `busy_day_stats` (migration 082) counts monthly repeats by exact day number (a 31st event is not counted in a 30-day month; the page and the reminder job clamp to the last day), counts all modes, ignores invited events and the "bill active" flag and counts bills only on their first due date; the page counts what the current mode shows. Hours booked add up overlapping events twice (`pg_busy_test` comment "union is not computed"), so two overlapping 2-hour events show 4 hours.
7. **Calendar weeks start on Sunday but the date picker starts on Monday** (calendar.html weekday row and `cDow` versus `luDatePopup`).
8. **Editing or pausing a reminder clears `last_fired_on`**, so a reminder edited within 10 minutes after it fired can fire again the same day (FR-REM-010).
9. **No way to remove an accepted contact in the page.** `LumaContacts.removeContact` exists (and cascades messages) but the Contacts page only offers Cancel on outgoing requests; there is also no message length limit in the database or the chat box (only "not empty"), and `request_contact` tells a caller whether an e-mail has an account (account enumeration).
10. **Undo is lossy:** undoing a deleted note drops its attachments, undoing a deleted event drops its guests (stated in the UI), undoing a task resets its completion time and "next repeat made" mark.
11. **Task rules differ between the page and the database:** the page requires a due date and limits the title to 200 characters, the table allows a null due date and any title length; "Work"/"Study" are only free-text tags and do not move a task between modes (may confuse people).
12. **Focus timer** keeps running after the window is closed and counts one second per browser tick, so its accuracy in a background tab is unverified; the Settings preference called "Focus mode" (urgent reminders only) has the same name as this timer.
13. **Test coverage gap:** none of the automated suites exercise Reminders delivery, event-reminder delivery, Documents limits, `request_contact`, `nudge_contact`, chat limits or Focus; `v49_test` only checks that the pages render.
14. Migration 027's header says event times are "Malaysia time" but the app and the jobs use each person's own time zone setting.
