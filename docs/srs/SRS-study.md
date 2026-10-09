# SRS — Study mode

Part of the LUMA formal documentation set. Follows `docs/CONVENTIONS.md`. The truth is the code and the migrations; where the code and an older document disagree, the code wins and the difference is listed in the "Findings" section of `docs/tests/TC-study.md`.

## 1. Scope

This document covers the **Study add-on** (Study mode): the Study page with its eight tabs (Overview, Timetable, Assignments, Subjects, Semesters, Notes, Cards, Groups), the **Study → Archive** page, the Study parts of the Calendar, Reminders, Settings, Search, Focus Mode and "Export my data", and the plan / add-on rules that switch Study on and off (trial, expiry, spaces, bundle, busy-day alerts).

Study is an add-on (RM7 / month; Work + Study bundle RM19 / month) that works on every plan (Dawn, Glow, Zenith). It is granted by an administrator after a WhatsApp request, or started as a one-time 7-day free trial (the trial button is shown on staging only: `window.LUMA_ENV !== 'production'`, `app/core/modes.js`).

Out of scope: Work mode and Work Pro (see the Work SRS), the generic Calendar, Tasks, Reminders and Notes pages of Personal mode, and the Lumi assistant itself (only the Study tools are mentioned).

Main code: `app/modules/study/study.js`, `study.data.js`, `study.html`, `study.css`, `study.groups.js`, `study.notes.js`, `study.archive.js`, `study.cards.js`, `study.extras.js`; `app/core/modes.js`, `app/core/plans.js`, `app/core/busy.js`; `shared/luma-plan.js`, `shared/luma-space.js`; migrations 044–047, 049–061, 062, 067, 069, 070, 082 (busy-day push).

## 2. Area codes

| Code | Area | Section |
|---|---|---|
| STT | Timetable and classes: weekly classes, start / end dates, cancelled sessions, break weeks and holidays, class reminders, attendance marking, timetable export | 4 |
| STA | Assignments, tests and exams: kinds, weights, scores, status, due dates and times, reminders | 5 |
| STS | Subjects and semesters: create, active-semester rule, archive / restore / delete, remarks, the Study archive page, grade scales, target %, GPA | 6 |
| STG | Group projects: invite classmates, accept / decline, tasks, assignees, comments, files, nudge, leave, guests without the add-on | 7 |
| STN | Study notes: per subject, formatting, sharing with contacts, edit rights, attached files | 8 |
| STC | Flashcards: decks, cards, spaced-repetition review, due counts | 9 |
| STK | Grades and extras: marks, grade calculation, attendance goals, "What if?", study time from Focus sessions, Overview widgets, Calendar items, search, export | 10 |
| STM | Plan and add-on rules: trial, expiry behaviour, data after the add-on ends, "Show Study in Personal", spaces, busy-day alerts, bundle, guest access | 11 |

Identifier format: `FR-STT-001`, `NFR-STT-001` (see `docs/CONVENTIONS.md`). Test cases are in `docs/tests/TC-study.md`.

## 3. Common rules (apply to every area)

- **Active semester rule.** Everything new in Study goes into the one **active semester**. With no active semester the app asks the person to create or activate one (popup "No active semester", button "Open Semesters") and the database refuses new Study rows (`Activate a semester first: Study items are added to your active semester.`). Described in FR-STS-011 to FR-STS-013.
- **Add-on rule.** Adding or changing Study rows needs the Study add-on (row level security, `luma.has_my_addon('study')`). Reading and deleting your own rows always works at database level (migration 045).
- **Time zone.** "Today", due labels and the timetable use the person's app time zone (`MYT` variable in `app/core/time.js`); server reminders use the person's stored time zone (`luma.user_tz`).
- **Limits** (database triggers `luma.study_cap`, migrations 045, 049, 052, 053, 067): 40 subjects, 200 classes, 1500 assignments, 30 semesters, 1000 cancelled dates, 100 breaks, 300 notes, 200 decks, 20000 cards in total, 6000 attendance records. The raw message shown is `You have reached the limit of <n> <things>`.

## 4. Timetable and classes (STT)

### 4.1 Timetable views

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STT-001 | The Timetable tab shall show the person's classes either as a week grid ("Week") or as seven day columns ("List"). On windows narrower than 900 px only the list is shown and the Week / List switch is hidden; on wider windows the choice is remembered in the browser (`luma_tt_view`, default Week). | Must | study.js `sdTtView`, `sdTimetable` |
| FR-STT-002 | The week grid shall show seven real dates (Monday to Sunday) with a full 24-hour scrolling day (52 px per hour), class blocks sized by length (shortest block drawn as 25 minutes), overlapping classes side by side, today's column highlighted with a "now" line, and the view opened near the first class of the week (otherwise around 7 am). | Must | study.js `sdGrid` |
| FR-STT-003 | The week grid shall have buttons Previous week, Today and Next week and a label "<d Mon> to <d Mon yyyy>" that opens a date picker; when the shown week falls inside the active semester the label also says "<Semester name>, week n of N". | Should | study.js `sdTimetable`, `WIRE.study` |
| FR-STT-004 | The grid shall show only what really happens on each date: classes outside their start / end dates, inside a break, or in an archived subject are left out; a cancelled session is drawn marked "cancelled"; a break day shows a "Break" tag and a shaded column. | Must | study.js `sdGrid`, `sdClassOn` |
| FR-STT-005 | The list view shall show Mon to Sun columns with each day's classes sorted by start time and "Free" on empty days; ended classes (end date in the past) are hidden behind a "Show ended classes (n)" / "Hide ended classes (n)" button. | Should | study.js `sdTimetable`, `sdClassCard` |
| FR-STT-006 | A class card shall show start – end time, the subject name, room and type, and a note "Ended <date>", "From <date> to <date>" or "Until <date>" when dates apply. | Could | study.js `sdClassCard` |
| FR-STT-007 | When there are no classes the Timetable tab shall show an empty state "Build your weekly timetable" with a button "Add a class" (or "Add a subject" when there is no subject yet). | Should | study.js `sdTimetable` |
| FR-STT-008 | Clicking an empty hour in a grid column shall open "New class" on that weekday with that hour as start time and one hour later as end time (23:00 at most); the "+" in a list day header opens "New class" on that day. | Could | study.js `WIRE.study`, `openClassModal` |

### 4.2 Creating and editing classes

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STT-009 | The system shall let the person create a class with: Subject (required), Days (one or more weekdays), Starts / Ends times (required), Type (Lecture, Tutorial, Lab, Other), Starts on (date), an end rule, and Room (optional, at most 60 characters). Choosing several days creates one class per day; editing a class changes one weekday only. | Must | study.html, study.js `sdClassSave` |
| FR-STT-010 | The end rule shall offer "Weeks" (1 to 60, default 14), "Months" (1 to 24, default 4), "On a date" and "No end"; the end date is start + n weeks − 1 day, or start + n months − 1 day, and a line under the field says "Runs <d Mon> to <d Mon> (n weeks)" or "Every week from <date>, with no end date." | Must | study.js `sdClassRange` |
| FR-STT-011 | The class form shall refuse invalid input with these messages: "Pick a subject.", "Set the start and end time.", "The class must end after it starts.", "Pick the date the class starts.", "Enter 1 to 60 weeks.", "Enter 1 to 24 months.", "Pick the date the class ends.", "The end date must be after the start date." (an end date equal to the start date is accepted). | Must | study.js `sdClassSave` |
| FR-STT-012 | For a new class whose subject belongs to a semester that has not ended, the form shall start on the later of today and the semester's first day and end on the semester's last day ("On a date"). | Should | study.js `sdApplySemToClass` |
| FR-STT-013 | A new class shall need an active semester (FR-STS-011) and at least one subject; with no subject the app opens "New subject" and shows the toast "Add a subject first". | Must | study.js `openClassModal` |
| FR-STT-014 | The person shall be able to delete a class after confirming "Delete this class?" ("It is removed from your timetable every week. This can't be undone."); its cancelled dates and attendance records are deleted with it. | Must | study.js, migrations 052, 067 |
| FR-STT-015 | A class shall happen on a date only when the weekday matches, the date is inside its start / end dates (empty = no limit), the date is not a cancelled session, the date is not inside a break, and its subject is not archived. This one rule shall be used by the timetable, Today's classes, Calendar, class reminders, attendance sessions and the .ics export. | Must | study.js `sdClassOn` |

### 4.3 Cancelled sessions, breaks and holidays

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STT-016 | When editing a class the person shall be able to cancel one session by date ("Cancelled dates"); the date must fall on the class's weekday ("That date is a <day>; this class is on <Day>."), must not already be cancelled ("That date is already cancelled."), and must be chosen ("Pick the date to cancel."). A cancelled date is shown as a chip with a remove button ("Bring this class back"). The pair (class, date) is unique. | Must | study.js `sdClassSkipAdd`, migration 052 |
| FR-STT-017 | Semesters → "Breaks & holidays" shall let the person add a break with a name (1 to 60 characters), a "From" and a "To" date ("The last day must not be before the first day."), list the breaks with their day count, and delete a break. A single-day break is allowed. | Must | study.js `sdBreakAdd`, migration 052 |
| FR-STT-018 | Breaks apply to the whole account (not to one semester): no class is drawn, reminded, counted in attendance, or exported on a break day. | Must | study.js `sdInBreak`, migration 052 |
| FR-STT-019 | "Import public holidays" shall offer three sources: "By country" (list from date.nager.at, a fixed fallback list of 14 countries when offline; years this and next), "Malaysia: national days" (New Year's Day, Labour Day, Agong's Birthday as the first Monday of June, Merdeka Day, Malaysia Day, Christmas Day) and "From a file" (.ics all-day events, at most 300 events, names cut at 60 characters). Found holidays can be unticked; ones already present (same name and dates) are shown "already added" and cannot be ticked; the button says "Add n holiday(s)". | Should | study.js `openHolidays`, `sdParseIcs` |
| FR-STT-020 | The holiday import shall show these errors: "No automatic list exists for that country. Try “Malaysia: national days” or import a calendar file.", "Could not reach the holiday list (are you online?). You can still import a calendar file.", "No events were found in that file.", "Could not read that file." | Should | study.js |

### 4.4 Class reminders

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STT-021 | A database job (`luma-class-reminders`, every minute) shall send each person with the Study add-on a notification "🎓 <Subject> starts in <n> min" (or "starts now") with body "<h:mm am> · <room>" when a class starts within the person's lead time (Settings → Reminders → Classes: 5, 10, 15, 30 or 60 minutes; database 5 to 60, default 15; can be switched off, `class_on`). | Must | migration 052 `run_class_reminders`, settings.js |
| FR-STT-022 | The class reminder shall be skipped on the wrong weekday, outside the start / end dates, on a cancelled date, inside a break, for an archived subject, and when the same class was reminded in the last 6 hours. | Must | migration 052 |
| FR-STT-023 | On the Dawn plan the class reminder lead time is fixed at 15 minutes (changing it is refused with "Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off."). | Should | migration 052 `enforce_reminder_timing`, settings.js |

### 4.5 Attendance marking

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STT-024 | On Overview → Today's classes, each class that has already started shall show buttons Present, Late and Absent; tapping the button of the current status again clears it. | Must | study.extras.js `sdXDecorate`, `sdAttSet` |
| FR-STT-025 | Subjects → "Attendance" on a subject shall open a list of past sessions (newest first, at most 120 shown) with four buttons per session: Present, Late, Absent, Excused; cancelled dates and break days are not listed; a session of today is listed once its end time has passed. | Must | study.extras.js `sdSessions`, `sdAttPaint` |
| FR-STT-026 | The database shall keep one attendance record per class and date (a new status replaces the old one), accept only the statuses present, late, absent, excused, require the class to belong to the person and to the given subject, and file the record in the active semester. | Must | migration 067 |
| FR-STT-027 | When the attendance tables are missing the app shall hide the attendance controls and, on saving, show "Attendance needs one more database step: run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor." | Could | study.extras.js |

### 4.6 Timetable export

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STT-028 | The Timetable tab shall have an "Export" button that, after the confirmation "Export your timetable", downloads `LUMA-study.ics` with each live class as a weekly repeating event (until its end date, with cancelled days and break days as exceptions, room as location, 15-minute alarm) and each open assignment with a due date as an event (all-day with a 1-day alarm, or one hour long with a 60-minute alarm). | Should | study.extras.js `sdExportIcs` |
| FR-STT-029 | When there is nothing to export the app shall say "There is nothing to export yet. Add your classes and assignments first." The file is a copy: later changes are not sent to it. | Should | study.extras.js |

**Notes.** The database allows a class to be added with no active semester (classes have no `semester_id` and are not covered by the semester trigger); only the app asks for a semester first.

## 5. Assignments, tests and exams (STA)

### 5.1 Assignment list

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STA-001 | The Assignments tab shall list the person's live assignments with a status filter ("To do", "Done", "All") and subject chips ("All subjects" plus one chip per subject). | Must | study.js `sdAssignments` |
| FR-STA-002 | With the "To do" filter the list shall be grouped into "Overdue", "Next 7 days", "Later" and "No due date" (each with a count, sorted by due date and time); "Done" and "All" are one list, newest due date first. | Must | study.js `sdAssignments` |
| FR-STA-003 | An empty list shall say "No assignments yet. Tap Add assignment to track your first one." or "Nothing here with these filters." | Should | study.js |
| FR-STA-004 | Each row shall show a tick button, the title, type, subject chip, due text, and a pill with "score/out of" when scored, otherwise the weight "n%". | Should | study.js `sdRow` |
| FR-STA-005 | Assignments of an archived subject or archived semester shall not appear in live views (Overview, Assignments, Calendar, reminders, search); they appear in Study → Archive. | Must | study.js `sdLiveTask`, migration 060 `live_item` |

### 5.2 Creating and editing

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STA-006 | The system shall let the person add an assignment with: Title (required, at most 140 characters), Type, Subject (optional; archived subjects are not offered), Due date (optional), Due time (optional), Extra reminder, Status, Weight %, Score, Out of, Notes (at most 1000 characters). Adding needs an active semester (FR-STS-011). | Must | study.html, study.js `sdOpenTaskModal`, migration 045 |
| FR-STA-007 | The Type shall be one of Assignment, Quiz, Test, Exam, Project, Other (default Assignment); the Status shall be To do, In progress or Done (default To do). | Must | study.js `SD_KINDS`, `SD_STATUS` |
| FR-STA-008 | A due time shall be saved only together with a due date (without a due date the time is discarded). | Must | study.js `sdTaskSave` |
| FR-STA-009 | The form shall refuse: an empty title ("Give it a title."); a weight outside 0 to 100 or not a number ("Weight is a percentage between 0 and 100."); a negative score or "Out of" of 0 or less ("Score must be 0 or more, and "Out of" above 0."); a score without "Out of" ("Add what the score is out of, e.g. 50."). Decimal commas are accepted. A score above "Out of" is not refused (TBC whether intended). | Must | study.js `sdTaskSave` |
| FR-STA-010 | The database shall enforce: title 1 to 140 characters, weight 0 to 100 (2 decimals), score 0 or more, max score above 0, notes up to 1000 characters, kind in the six kinds, status in the three statuses, and that a linked subject belongs to the same person. | Must | migration 045 |
| FR-STA-011 | Setting the status to Done shall set `completed_at` to now; any other status clears it. The tick button on a row toggles Done / To do immediately and shows the toast "Done"; if saving fails the row is reverted and "Could not update: <reason>" is shown. | Must | migration 045 `study_task_done`, study.js `sdToggleDone` |
| FR-STA-012 | The due text shall read "<n> day(s) overdue" for an open item in the past, "Today", "Tomorrow", a weekday name within the next 6 days, otherwise "<d Mon>", each followed by " · <time>" when a time is set; "No due date" when none. | Should | study.js `sdDue` |
| FR-STA-013 | Deleting an assignment shall ask "Delete “<title>”?" ("This can't be undone."). | Must | study.js |
| FR-STA-014 | Each new assignment shall be filed in the active semester by the database (a value sent by the client is overwritten). | Must | migration 056 `assign_semester` |
| FR-STA-015 | When the subject is deleted its assignments stay but have no subject. | Must | migration 045 (`on delete set null`), study.js |

### 5.3 Reminders

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STA-016 | A database job (`luma-study-reminders`, hourly) shall send "🎓 <title> is due in <n> day(s)" at the person's reminder hour (default 9) on the first-reminder day (Settings → Reminders → Study: 1, 2, 3, 5 or 7 days before; database 1 to 14, default 3), on the day before ("tomorrow") and on the due day ("is due today"). | Must | migration 060 `run_study_reminders`, settings.js |
| FR-STA-017 | An item with a due time shall, on its due day, be reminded when the time left is within the "Items with a time" setting (15, 30, 60, 90, 120, 180 or 240 minutes before; default 60) with "🎓 <title> is due in <n> min" (or "is due now"); an item whose time has passed gets no such reminder. | Must | migration 060 |
| FR-STA-018 | An open item that is overdue by 1 to 7 days shall get a daily "⚠️ <title> is overdue by <n> day(s)" at the reminder hour; after 7 days nothing more is sent. | Should | migration 060 |
| FR-STA-019 | An assignment can have an "Extra reminder" (date and time, default 09:00): the date is needed when a time is set ("Pick the date of the extra reminder too."), a new or changed time must be in the future ("Pick a reminder time in the future."), and the job sends "🎓 Reminder: <title>" once (`reminded_at` is set; changing the time clears it). | Must | study.js `sdTaskSave`, migration 060 |
| FR-STA-020 | No reminder shall be sent for a Done item, an item in an archived semester or archived subject, a person without the Study add-on, or a person who switched the Study reminder off (`study_on`). The same notification is not repeated within 12 hours (3 hours for timed items). | Must | migration 060 |
| FR-STA-021 | On the Dawn plan the reminder hour, days and timed lead are fixed (9, 3, 60); on Glow and Zenith they can be chosen. | Should | migration 038 / 045 / 060 `enforce_reminder_timing` |
| FR-STA-022 | Opening a Study reminder notification shall open Study and highlight the assignment or class it is about. | Could | migration 070, CHANGELOG ("Notifications open the item") |

### 5.4 Other

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STA-023 | The Lumi assistant shall have Study tools to add assignments, subjects and classes (up to 20 per call), and to update existing assignments, subjects and classes; the Study tools respect the same row level security as the page. | Could | supabase/functions/lumi/index.ts |

## 6. Subjects and semesters (STS)

### 6.1 Subjects

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STS-001 | The Subjects tab shall show subject cards grouped by semester (the active one first and tagged "Current", then by start date, then "No semester"), each group with its GPA when at least one subject has a mark; without any semester the cards are one list. An empty tab shows "No subjects yet" with an "Add a subject" button. | Must | study.js `sdSubjects`, `sdSubjectsList` |
| FR-STS-002 | The system shall let the person add a subject with: Subject name (required, 1 to 80 characters), Code (at most 20), Credit hours (whole number 0 to 30), Lecturer (at most 80), Colour (one of 8 swatches; the default rotates through them), Target mark %, Final mark %, and Status (Active / Archived). | Must | study.html, study.js `sdCourseSave`, migration 045 |
| FR-STS-003 | The subject form shall refuse: no name ("Give the subject a name."), credit hours above 30 ("Credit hours should be between 0 and 30."), and a target or final mark that is not a number from 0 to 100 ("Marks are percentages between 0 and 100."). | Must | study.js |
| FR-STS-004 | A new subject shall be filed in the active semester (the form shows the semester name and "New subjects go into your active semester."); without an active semester the popup "No active semester" is shown instead. The semester of an existing subject cannot be changed in the form. | Must | study.js `openCourseModal`, migration 056 |
| FR-STS-005 | Deleting a subject shall ask "Delete “<name>”?" ("Its classes are removed from your timetable. Its assignments stay, but without a subject. This can't be undone."); its classes, cancelled dates and attendance records are deleted; its assignments, notes, decks and tagged Focus sessions stay without a subject. | Must | study.js, migrations 045, 053, 067 |
| FR-STS-006 | A subject can be archived (Status → Archived) or restored singly, or several at once with Select → tick subjects → "Archive (n)" / "Restore (n)" after the confirmation "Archive n subject(s)?" ("They leave your timetable, Calendar and reminders. Their marks still count in your GPA."). Archived subjects are hidden behind "Show archived subjects (n)". | Must | study.js `sdArchiveSelected` |
| FR-STS-007 | A subject card shall show name, code · lecturer · credit hours, the grade so far (or "Final mark") with its letter, the number of open assignments, the number of classes per week that have not ended, and the study time this week. | Should | study.js `sdCourseCard` |

### 6.2 Semesters and the active-semester rule

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STS-008 | The system shall let the person add a semester with Name (required, 1 to 60 characters), First day and Last day (defaults: today and today + 97 days, 14 weeks) and show a hint "<n> weeks · <d Mon> to <d Mon>". It shall refuse an empty name ("Give the semester a name."), a missing date ("Pick the first and last day."), and a last day that is not after the first ("The last day must be after the first day."). The database also requires end date after start date. Semesters may overlap (no check). | Must | study.js `sdSemSave`, migration 049 |
| FR-STS-009 | Semesters → each semester card shall show its name with an "Active" or "Inactive" tag, dates, number of weeks, state ("Week n of N", "Starts in n days" or "Ended"), its GPA, and its subjects with their letters. The top tiles show CGPA (all semesters), number of subjects, and credit hours graded. | Should | study.js `sdSemestersBody` |
| FR-STS-010 | A person may have many semesters but at most one is active (unique index on active semesters per person). The active and archived flags can only be changed by the functions `activate_study_semester`, `archive_study_semester` and `restore_study_semester`; a direct update of the flags is ignored. | Must | migration 056 |
| FR-STS-011 | With no active semester the app shall refuse to start adding Study items (subject, class, assignment, note, deck, group project when the person has the add-on) by showing the popup "No active semester" ("Everything you add in Study goes into your active semester. Create one, or activate an existing one, first.", button "Open Semesters"), and the database shall refuse new Study rows with "Activate a semester first: Study items are added to your active semester." Group projects of a person without the add-on are the exception (FR-STG-021). | Must | study.js `sdNeedSem`, migration 056 / 058 |
| FR-STS-012 | A semester can be made active when it is created ("Make it the active semester?", default Yes when none is active, disabled when another is active) or later with "Make this the active semester". Activating while another is active is refused: "Archive "<name>" first: only one semester can be active at a time"; the button is disabled with "Activate (archive <name> first)". An archived semester cannot be activated ("That semester is not available"). The toast is "Semester activated". | Must | study.js, migration 056 |
| FR-STS-013 | The Semesters tab shall explain "Only one semester is active at a time. New subjects, notes, group projects, classes and reminders go into the active one." and every other Study tab shall show a banner "No active semester" with an "Open Semesters" button when there is none. | Should | study.js |
| FR-STS-014 | Overview shall show a slim bar for the active semester: "Week n of N · m week(s) left", "Starts <date> (in n days)" or "Ended <date>", with a progress bar. | Should | study.js `sdSemStrip` |
| FR-STS-015 | A semester that is not archived can be edited (name and dates) and deleted ("Delete “<name>”?": "Its subjects stay, but they are no longer in a semester. This can't be undone."). Deleting does not need typing DELETE and may delete the active semester. | Must | study.js `sdSemDelete` |

### 6.3 Archive, restore, delete

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STS-016 | "Done with this semester" (only on the active semester) shall open "Archive “<name>”" with a summary (subjects, classes, assignments, how many are still open) and an optional Remark (at most 1000 characters). Archiving sets the semester's archive time, clears its active flag, stores the remark, archives its subjects, and switches off the Personal reminders made in it; the toast is "Semester archived". It needs the Study add-on and an unarchived semester of the person. | Must | study.js `sdFinishSemester`, migration 056 |
| FR-STS-017 | After archiving, the semester's subjects, classes, assignments, notes, decks, group projects, events, tasks and reminders leave the live views, the Calendar and the server reminders and summaries, while the GPA keeps counting them. | Must | study.js `sdLiveTask`, shared/luma-space.js, migration 060 |
| FR-STS-018 | Restoring a semester (Study → Archive → open it → "Restore") shall confirm "Restore “<name>”?", clear the archive time, un-archive all its subjects, switch its reminders back on, and make it the active semester if none is active (toast "… is the active semester again") otherwise leave it inactive (toast "… is back, inactive: another semester is active"). It needs the Study add-on; a semester that is not archived is refused ("That semester is not archived"). | Must | study.js `sdRestoreSemester`, migration 056 |
| FR-STS-019 | The Study archive page (menu "Study archive", needs the Study add-on) shall list archived semesters (newest end date first) as cards with dates, archive date, remark, GPA, number of subjects, classes and "n of m assignments done", plus one card "Archived subjects" for subjects archived on their own. With nothing archived it shows "Nothing archived yet". | Must | study.archive.js `saPaint`, router.js |
| FR-STS-020 | Opening an archived semester shall show a remark box ("Add remark" / "Edit remark", at most 1000 characters), tiles (GPA, Subjects, Assignments done, Credit hours) and tabs Subjects, Timetable, Assignments, Notes, Groups, Other (events, reminders, tasks, notes and documents made in that semester), with buttons "Restore" and "Delete permanently". | Must | study.archive.js |
| FR-STS-021 | The archive search box shall search archived semesters (name, remark), subjects, assignments, notes and group projects, grouped by semester, and say "Nothing in the archive matches “<text>”." when there is no hit. | Should | study.archive.js `saResults` |
| FR-STS-022 | "Delete permanently" shall work only on an archived semester (or the "Archived subjects" card), list what will be removed, ask for confirmation, then ask the person to type DELETE (any letter case; anything else shows "Nothing was deleted: you did not type DELETE."). It deletes the semester's assignments, notes, group projects owned by the person, subjects (with their classes, cancelled dates, attendance), decks and cards, the events, reminders, tasks, notes, habits, goals, bills and money entries made in it, and the uploaded documents (files included); the toast is "Deleted permanently". An active or un-archived semester is refused ("Only an archived semester can be deleted"). | Must | study.archive.js `saDeleteForever`, migration 057 / 067 |
| FR-STS-023 | "Start from a previous semester" (on the active semester) shall copy from another semester: "Subjects and timetable" (subject name, code, colour, lecturer, credit hours, target; classes with start = later of today and the new semester's first day, end = its last day) and/or "Unfinished assignments" (past due dates are dropped, weights kept). A subject already in the active semester with the same name and code is reused, not copied twice. Marks, scores and study notes are not copied. Messages: "You have no other semester to copy from yet.", "Pick what to copy."; toast "Copied into <name>". | Should | study.js `openCopySemester`, `sdCopyGo` |

### 6.4 Grade scales, GPA and target

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STS-024 | Letters and GPA points shall come from a grade scale: a subject's own scale, else its semester's, else the person's account scale (stored in the profile preference `grade_scale`), else the standard Malaysian 4.0 scale (80 A 4.0, 75 A- 3.67, 70 B+ 3.33, 65 B 3.0, 60 B- 2.67, 55 C+ 2.33, 50 C 2.0, 47 C- 1.67, 44 D+ 1.33, 40 D 1.0, 0 F 0). A mark gets the first row whose minimum it reaches. | Must | study.js `sdScale`, `sdLetter` |
| FR-STS-025 | Semesters → "Grade scale" shall let the person edit a scale "for" Everything (my default), one semester, or one active subject, with rows "From %", "Letter", "GPA points". The save shall refuse: a row without "From %" between 0 and 100 ("Every row needs a "From %" between 0 and 100."), a letter that is empty or longer than 12 characters, GPA points outside 0 to 10 or empty, two rows with the same minimum ("Two rows start at the same percentage."), no row starting at 0 ("One row must start at 0 so every mark gets a grade."). Rows are saved sorted high to low. | Must | study.js grade scale section |
| FR-STS-026 | A scale shall have 2 to 20 rows: "Remove this row" is refused below two ("Keep at least two rows."), the add-row button does nothing at 20 rows, and the database check for semester and subject scales requires an array of 2 to 20 rows. | Must | study.js, migration 061 |
| FR-STS-027 | "Reset" shall, for the account scale, put the standard rows in the editor (saved only with "Save scale"; saving rows equal to the standard scale stores nothing); for a semester or subject it removes its own scale at once (toast "Back to the scale above it"). Saving shows "Grade scale saved". | Should | study.js |
| FR-STS-028 | A subject's mark shall be its final mark when one is entered, otherwise its grade so far (FR-STK-001). The GPA of a list of subjects shall be the credit-hour-weighted average of the grade points of subjects that have a mark and credit hours above 0 (if no subject has credit hours, the plain average of points). The CGPA on the Semesters tab uses all subjects of all semesters, including archived ones. | Must | study.js `sdMark`, `sdGpa` |
| FR-STS-029 | A subject's "Target mark %" (default 50 when empty) shall drive the line on the subject card: "<n>% is already secured", "To reach <n>% you need <x>% on the remaining <y>%" (warning style above 85%), or "<n>% is out of reach: you would need <x>% on the remaining <y>%"; "All marked: <x>% overall" when the weights are used up. The line is hidden for archived subjects and when a final mark exists. | Should | study.js `sdNeeded` |

**Notes.** Removing a semester with the Delete button on its edit form (FR-STS-015) deletes its flashcard decks as well (decks are linked with `on delete cascade`, migration 067), although the confirmation says the subjects stay; other items lose only their semester link.

## 7. Group projects (STG)

### 7.1 Projects and invitations

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STG-001 | The Groups tab shall show invitations waiting for the person ("<Name> invited you to “<title>”", with "Decline" and "Join") above the person's accepted projects as cards (title, subject, number of members, organiser, due state "Due <date>" / "Due today" / "<n> days overdue", and "<done> of <total> tasks done" with a progress bar). An empty tab shows "Group projects" with a "New project" button. | Must | study.groups.js `sdGroupsView` |
| FR-STG-002 | A project shall be created with Project name (required, 1 to 120 characters; "Give the project a name."), Subject (free text, optional, at most 80), Due date (optional) and optional invited classmates; the creator becomes the organiser and first accepted member. | Must | study.groups.js, migration 054 |
| FR-STG-003 | A person can own up to 20 group projects (3 without the Study add-on): "You can own up to 20 group projects" / "Without the Study add-on you can own up to 3 group projects". | Must | migration 058 `create_study_project` |
| FR-STG-004 | Only the organiser can invite, and only accepted contacts ("You can only invite people in your contacts", "Only the project owner can invite people"); a project holds at most 12 members counting accepted and pending ("A group project can have up to 12 members"); people already invited are skipped and a person who declined can be invited again. The invited person gets "🤝 <Name> invited you to a group project". If sending invitations fails the project is still created and the person sees "The project was created, but the invitations could not be sent: <reason>". | Must | migration 054, study.groups.js |
| FR-STG-005 | An invited person can "Join" or "Decline" (from the tab or the project popup); the organiser is told "✅ <Name> joined <title>" or "❌ <Name> declined <title>". Replying when there is no pending invitation fails with "No invitation found". | Must | migration 054 / 058 `respond_study_project` |
| FR-STG-006 | Until a person joins, the project detail shows only the title, subject, due date and member names ("Join to see the tasks and notes."); tasks, notes, comments and files are hidden. A person who is not a member, or who declined, cannot open the project ("Not allowed"). | Must | migration 054 `study_project_detail`, study.groups.js |
| FR-STG-007 | Every group project function shall check who is asking; the project tables are not readable or writable directly by signed-in users (privileges revoked, row level security on). | Must | migration 054 |

### 7.2 Working in a project

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STG-008 | Only the organiser can change the project's name, subject and due date ("Only the owner can change the title, subject and due date"); every accepted member can edit the shared notes (at most 5000 characters). The popup's save button reads "All changes saved" (disabled) until something is edited, then "Save changes"; the toast is "Project saved". | Must | migration 054 `update_study_project`, study.groups.js |
| FR-STG-009 | Any member can add a task (title 1 to 140 characters, optional assignee and due date; "Type what the task is first, then press +."), at most 200 tasks per project ("A project can have up to 200 tasks"). The assignee must be an accepted member ("That person is not on this project"). The assignee gets "📌 <Name> gave you a task" unless they assigned it to themselves. | Must | migration 054, study.groups.js |
| FR-STG-010 | Any member can tick a task done / not done, change its assignee ("Anyone" = none) and due date, and clear the due date; only the person who added the task or the organiser can delete it ("Only the person who added a task, or the organiser, can delete it"). | Must | migration 054 |
| FR-STG-011 | A discussion thread per project: members write comments of 1 to 1000 characters ("Write your comment first, then press send."; Ctrl or Cmd + Enter sends), at most 500 comments per project (the newest 200 are shown); teammates get "💬 <Name> commented on <title>" at most once per 10 minutes per person per project; the author or the organiser can delete a comment. | Must | migration 058 |
| FR-STG-012 | Any member can attach one of their own uploaded documents (up to 30 files per project); every accepted member can open it (it is shared automatically, also with people who join later); the person who attached it or the organiser can remove it ("Remove this file from the project?"; the file stays in the owner's Documents). | Must | migration 058, study.groups.js |
| FR-STG-013 | When a file is detached, a member leaves or is removed, or the project is deleted, the sharing of the project's files with that person ends, unless the same document is still shared to them through another project or note. | Must | migration 058 `doc_linked`, `unshare_doc` |
| FR-STG-014 | A member can nudge another accepted member, about the project or about one task (hand button); the same sender can nudge the same person in the same project once every 6 hours; the result is "Nudge sent" or "Already nudged recently". The recipient gets "👋 <Name> nudged you". Nudging yourself or a non-member is refused ("Not allowed"). | Must | migration 054, study.groups.js `sdNudge` |
| FR-STG-015 | A member can leave ("Leave this project?"; their tasks become unassigned; the organiser is not asked). The organiser can remove a member ("Remove <name>?"). The organiser cannot leave ("The owner cannot leave; delete the project instead"). | Must | migration 054 `leave_study_project` |
| FR-STG-016 | The organiser can delete the project ("The project, its tasks and notes are removed for everyone on the team."); a non-owner is refused ("Only the owner can delete the project"). | Must | migration 054 |
| FR-STG-017 | Assigned group tasks shall be reminded by a job (`luma-group-task-reminders`, hourly) at the assignee's Study reminder hour: "🤝 <task> is due in <n> day(s)" (first-reminder days, 1 day, today) and "⚠️ <task> is overdue by <n> day(s)" daily up to 7 days, body "Group project · <title>"; not for done or unassigned tasks, not when the assignee switched Study reminders off; the add-on is not needed. | Should | migration 058 `run_group_task_reminders` |

### 7.3 Guests and semesters

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STG-018 | A person without the Study add-on who has been invited to a project owned by someone else shall be able to open Study with only the Groups tab (other tabs are not shown, the Study archive opens the add-on popup, the add button reads "New project"), and Study mode is unlocked for them; owning projects of their own does not unlock Study mode. | Must | study.js `sdGuest`, modes.js `sdCheckGuest`, `lumaModeOpen` |
| FR-STG-019 | A group project made while the owner has an active semester is filed in it; a project owned by a person without the add-on has no semester. The owner's list hides projects of an archived semester (they show in Study → Archive → Groups); members see the project in their list regardless of the owner's semester. | Must | migrations 056, 058, study.groups.js |
| FR-STG-020 | Deleting a semester permanently also deletes the group projects owned in it (FR-STS-022). | Must | migration 057 |
| FR-STG-021 | A person without the add-on can start a project (up to 3 owned) without an active semester; a person with the add-on and no active semester sees the "No active semester" popup instead of the "New project" form. | Must | study.groups.js `openProjNew`, migration 058 |
| FR-STG-022 | Group project invitations, replies and new tasks shall open Study on the Groups tab and highlight the project when tapped in Notifications. | Could | migration 070 |

## 8. Study notes (STN)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STN-001 | The Notes tab shall list the person's own study notes as cards (title, snippet of about 140 characters of plain text, subject chip, "Updated <date>"), newest first, filtered by subject chips ("All subjects" plus active subjects); notes of an archived semester are not shown. An empty tab shows "Keep your study notes here" with a "New note" button; an empty subject filter shows "No notes for this subject". | Must | study.notes.js `sdNotesView` |
| FR-STN-002 | A note shall have a Title (required, 1 to 120 characters; "Give the note a title."), an optional Subject, and a body of up to 20000 characters. Creating a note needs the Study add-on and an active semester (FR-STS-011); the database files it in the active semester. At most 300 notes per person. | Must | study.html, migration 053 |
| FR-STN-003 | The editor shall have formatting buttons and a Preview / Edit switch. The formatter shall support **bold**, *italic*, `code`, headings (#, ##, ###), bullet lists, numbered lists, checklists (- [ ] and - [x]) and links [text](https://…); text is HTML-escaped and only http(s) links are made. | Should | study.notes.js `sdMd`, `sdMdApply` |
| FR-STN-004 | The owner can share a note with accepted contacts only ("You can only share with people in your contacts"), choosing "Can read" or "Can edit" before adding people; at most 30 people per note ("A note can be shared with up to 30 people"); sharing again with a person already on the list changes their right without a new notice. The person gets "📝 <Name> shared a note with you" (with " (you can edit it)" when edit was given). | Must | study.notes.js, migration 053 / 059 `share_study_note` |
| FR-STN-005 | The owner can switch each person between read and edit at once (tap the "read" / "edit" label on the person's chip) and stop sharing (cross on the chip; applied on Save note). Only the owner can do this ("Not allowed"). | Must | study.notes.js, migration 059 |
| FR-STN-006 | Notes shared with the person are listed under "Shared with me" with the owner's name and "you can edit" or "read only". A read-only note opens in a read-only viewer ("… · read only") with files and a "Remove" button ("Remove this shared note?": it is taken off the person's list, the owner keeps it). | Must | study.notes.js `openSharedNote` |
| FR-STN-007 | A person with edit rights opens the note in "Editing a shared note": title and text only (no subject, sharing or delete), with the notice "From <name>. You can edit it, and so can they. The latest save wins."; saving shows "Changes saved". A person with read-only rights is refused by the database ("You can only read this note"). | Must | study.notes.js, migration 059 `update_shared_study_note` |
| FR-STN-008 | The shared-notes table is private: a person other than the owner cannot read, update or delete a study note or its share rows directly; they only see notes through the share functions. | Must | migration 053 (row level security, revoked share table) |
| FR-STN-009 | The owner can attach their own uploaded documents to a note (after the note has been saved once), at most 10 files; people the note is shared with can open them (shared automatically, also for people added later); detaching asks "Remove this file from the note?"; only the owner can attach ("Only the note owner can attach files", "You can only attach your own documents", "A note can have up to 10 files"). | Must | study.notes.js, migration 059 |
| FR-STN-010 | Stopping sharing, detaching a file or deleting the note shall end the sharing of the note's files with the affected people, unless another project or note still gives them the file. | Must | migration 058 `note_cleanup_shares`, 059 |
| FR-STN-011 | The owner can delete a note ("Delete “<title>”?": removed for the owner and everyone it was shared with). | Must | study.notes.js |
| FR-STN-012 | Study notes shall appear in global search ("Study note · <subject>") while Study data is visible, and in the archive search; opening a result opens the note. | Should | study.js `studySearchItems`, study.archive.js |
| FR-STN-013 | When the notes tables or share functions are missing the app shall show "Notes aren't set up yet — run supabase/migrations/053_study_notes.sql in the SQL Editor." or "Run supabase/migrations/059_study_notes_extras.sql to share notes." instead of failing silently. If a note saves but sharing fails the person sees "The note was saved, but sharing did not fully work: <reason>". | Could | study.notes.js |
| FR-STN-014 | Notes shared with a person, with the owner's add-on ended, remain readable and (with edit rights) editable by that person, because the share functions do not check the add-on. | Should | migration 059 (TBC: not stated in the requirements of the product owner) |

## 9. Flashcards (STC)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STC-001 | The Cards tab shall show a bar "<n> card(s) to review today" with a "Review all due" button (when n > 0) and one card per deck (title, subject chip, number of cards, number due, buttons "Review n" / "Practise" / "No cards yet" and "Edit"). Decks of an archived semester are hidden. An empty tab shows "Make flashcards to remember things" with "Make your first deck". | Must | study.cards.js `sdCardsView` |
| FR-STC-002 | A deck shall have a name (required, 1 to 80 characters; "Give the deck a name.") and an optional subject; creating a deck needs the Study add-on and an active semester; at most 200 decks. | Must | study.cards.js, migration 067 |
| FR-STC-003 | A card shall have a front (1 to 500 characters) and a back (1 to 1000 characters); both are required in the editor ("Write both sides of the card.", "Every card needs both a front and a back."); a deck holds at most 500 cards ("A deck can have up to 500 cards") and a person at most 20000. | Must | study.cards.js, migration 067 |
| FR-STC-004 | The deck editor shall add cards one at a time (Enter in either field adds) or paste many lines in the form "front | back" (a tab also separates); lines without a separator are skipped with the message "<n> added. <m> line(s) skipped (write each as: front | back)."; cards can be edited and removed in the list; nothing is saved until "Save deck". | Must | study.cards.js `sdDeckPasteGo`, `sdDeckSave` |
| FR-STC-005 | Deleting a deck shall ask "Delete “<title>”?" ("The deck and all its cards are removed. This can't be undone."). | Must | study.cards.js |
| FR-STC-006 | A new card is due today with ease 2.5, interval 0, 0 repetitions and 0 lapses. | Must | migration 067 |
| FR-STC-007 | A review session shall take the cards that are due (due date today or earlier), oldest first, at most 30 in one session. If nothing is due, "Review" becomes "Practise": a random 15 cards, titled "Practise (nothing is due)", and nothing is saved. A deck without cards says "This deck has no cards yet." | Must | study.cards.js `sdRunStart` |
| FR-STC-008 | In a session the person taps the card to see the answer, then rates Again, Hard, Good or Easy (keys 1 to 4; Space or Enter flips); each rating button shows the next interval ("Today", "1 day", "n days", "n mo"). | Must | study.cards.js `sdRunFlip` |
| FR-STC-009 | The scheduling rule shall be: Again — repetitions 0, lapses + 1, ease − 0.2 (not below 1.3), due today; Hard — ease − 0.15 (min 1.3), interval = max(1, round(interval × 1.2)); Good — interval 1 day when repetitions are 0, 3 days when 1, otherwise max(interval + 1, round(interval × ease)); Easy — ease + 0.15, interval 3 days when repetitions are 0, otherwise max(interval + 2, round(max(interval, 1) × ease × 1.3)); Hard, Good and Easy add one repetition; the due date is today + interval. | Must | study.cards.js `sdSrs` |
| FR-STC-010 | A card rated Again shall return to the queue after three other cards, at most twice more (it is counted done on its third Again); the end screen says "All done for now!" (or "Nice practice!") with "<n> card(s) reviewed · <m> you will see again soon". | Should | study.cards.js `sdRunRate`, `sdRunFinish` |
| FR-STC-011 | Each rating in a real review is saved in the background; a failed save is only logged to the console (the person is not told). | Should | study.cards.js `sdRunRate` |
| FR-STC-012 | The due and total counts per deck come from the database function `my_deck_stats(today)` for the person's own cards. | Must | migration 067 |
| FR-STC-013 | Decks, cards and attendance are the person's own (row level security); adding or changing needs the Study add-on; a card's deck and a deck's subject must belong to the person. | Must | migration 067 |
| FR-STC-014 | If the flashcard tables are missing the app shall say "Has supabase/migrations/067_study_attendance_cards.sql been run in the Supabase SQL Editor?" or, on saving, "Flashcards need one more database step: run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor." | Could | study.cards.js |

## 10. Grades and extras (STK)

### 10.1 Marks and grade calculation

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STK-001 | The grade so far of a subject shall be the average of the scored assignments (score and "Out of" above 0) weighted by their weights when at least one scored item has a weight above 0 (items without weight are then ignored); with no weights at all, the plain average of score ÷ out of. A subject with no scored item has no grade ("—"). | Must | study.js `sdGrade` |
| FR-STK-002 | The "To reach <target>%" line shall use only assignments with a weight above 0: marks earned = Σ(score ÷ out of × weight) over scored ones, weight left = 100 − weight of scored ones; needed = (target − earned) ÷ left × 100. Weights of the assignments of one subject are not required to add up to 100 and the app does not warn when they do not (see Findings). | Must | study.js `sdNeeded` |
| FR-STK-003 | Subjects → "What if?" shall open a calculator (only when the subject has weighted assignments; otherwise a hint to give them weights) with inputs 0 to 100 for each unscored weighted item and "Everything else (e.g. the final exam)" for the weight not yet assigned, seeded with the current grade (70 when none). It shows the projected %, letter and points, whether the target is reached ("That reaches your <n>% target." / "<x> points short of your <n>% target."), and the semester GPA it would give. Nothing is saved. | Should | study.extras.js `sdWifOpen`, `sdWifPaint` |
| FR-STK-004 | Letters shown on subject cards and semester cards come from the subject's scale (FR-STS-024) using the mark of FR-STS-028. | Must | study.js |

### 10.2 Attendance goal

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STK-005 | Each subject has an attendance goal (0 to 100 %, default 80, whole number; the database refuses values outside 0 to 100). It is set in the Attendance popup ("Enter a goal between 0 and 100."; toast "Goal saved"). | Must | study.extras.js, migration 067 |
| FR-STK-006 | Attendance % = (present + late) ÷ (present + late + absent) × 100 (excused and unmarked sessions are not counted). "You can miss n more" = floor((all sessions − excused) × (1 − goal ÷ 100)) − absent, never below 0, where all sessions are the subject's past and future sessions of FR-STT-015 (using the class dates, or the semester dates when a class has none). The subject is "below your goal" when the % is under the goal. | Must | study.extras.js `sdAttStats` |
| FR-STK-007 | The subject card shows "Attendance <n>%", "<x> of <y> classes · goal <g>% · can miss <m> more" or "<n> classes so far, none marked yet" / "No classes yet", and an "Attendance (<unmarked>)" button; archived subjects have no attendance block. | Should | study.extras.js `sdXDecorate` |

### 10.3 Study time and Overview

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STK-008 | A Focus Mode session finished while in Study mode shall be tagged with the subject whose class is on at that moment (start time ≤ now < end time, class valid on the day by FR-STT-015), and none when no class is on; outside Study mode it is not tagged. | Should | focus.js `subjectId`, study.js `sdCurrentCourse`, migration 045 |
| FR-STK-009 | Overview → "Study time this week" shall total the Focus minutes since this week's Monday per subject (bars; "No subject" for untagged ones, total shown in the "Studied this week" tile as "<h> h <m> m" or "<n> min"); with none it says "Start Focus Mode and pick a subject. Your study time shows up here." Subject cards show the subject's minutes under "This week". | Should | study.js `sdOverview`, `sdCourseCard` |
| FR-STK-010 | Overview shall show four tiles — "Due this week" (open assignments due today to 7 days ahead), "Overdue", "Classes today", "Studied this week" — and the cards "Today's classes", "Due soon", "Study time this week", "Grades" and "Exam countdown". | Must | study.js `sdOverview` |
| FR-STK-011 | "Today's classes" shall list today's classes by start time with the badge "Now", "Next" (the first one still to come) or "Done"; with none it says "No classes today. Enjoy!". | Should | study.js |
| FR-STK-012 | "Due soon" shall list overdue and upcoming open assignments, earliest first, at most 8; with none it says "Nothing is due. Add an assignment, test or exam to track it." | Should | study.js |
| FR-STK-013 | "Grades" shall show a bar per subject that has a grade so far; "Exam countdown" shall list the next 5 open items of type Exam or Test (not Quiz) with the days left (highlighted at 3 days or fewer). | Should | study.js |
| FR-STK-014 | Overview shall show the busy-day notice (FR-STM-016) and, on first use with no subject, assignment or semester, an empty state "Set up your semester". The header says "<n> subject(s) · <m> to do". | Should | study.js `sdPaint` |

### 10.4 Calendar, search and export

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STK-015 | The Calendar shall show Study classes (category "Classes", with time) on each date where the class happens (FR-STT-015) and open assignments on their due date (category "Study", "<Type> due"; Done ones are not shown), only for people with the add-on, and in Personal mode only while "Show Study in Personal" is on. Clicking opens the class or assignment form. The Classes / Study filter chips can hide them. | Must | study.js `studyCalItems`, calendar.js |
| FR-STK-016 | Global search shall include Study subjects, live assignments, notes and group projects for people with the add-on while Study data is visible (Study mode, or Personal with "Show Study in Personal"). | Should | study.js `studySearchItems`, search.js |
| FR-STK-017 | "Export my data" (Settings) shall include a "study" section (semesters, subjects, classes, cancelled dates, breaks, assignments, notes, notes shared with me, group projects, the grade scale, attendance, flashcard decks and cards) only for people who currently have the Study add-on. | Should | study.js `sdExport`, study.extras.js, settings.js |

## 11. Plan and add-on rules (STM)

### 11.1 Getting Study

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STM-001 | A person without the add-on who taps the Study mode button (or Study in the menu) shall see the popup "Study mode": "Study add-on", tag "Classes & assignments", price "RM7 / month", five perks, and a note that it works on every plan. | Must | modes.js `openAddon`, `ADDONS` |
| FR-STM-002 | The popup shall offer "Get Study · RM7 / month" (opens WhatsApp with name, email, current plan, add-on and price pre-filled; if no WhatsApp number is configured: "The WhatsApp number for requests isn't set up yet. Please email aeinscape@gmail.com to add this.") and, when the person has neither Work nor Study, "Get both: Work + Study · RM19 / month" with "Save RM3 a month". | Must | modes.js `requestAddon` |
| FR-STM-003 | Where the trial is switched on (everywhere except production), a person who has never used it sees "Start 7-day free trial". Starting it gives Study for 7 days, marks the trial as used for ever, sends "🎉 Your Study trial has started" and shows "Study trial started · Free for 7 days". Refusals: "You already have this add-on", "The free trial was already used". | Must | modes.js, migration 044 `start_addon_trial` |
| FR-STM-004 | An administrator can switch Study on for a number of months, until a date, or with no end, or add time ("extend"); switch it off (ends now); start a trial by hand (1 to 60 days, counts as their trial); reset a person's trial; and give free access in bulk or as a gift (a gift does not use the person's own trial). The person gets "🎉 Study mode is on" with the end date. | Must | migrations 062, 065, 069 |
| FR-STM-005 | The Study header shall show "· add-on until <d Mon yyyy> (n days left)" or "· free trial until …" when the add-on has an end date; Settings → "Your plan and add-ons" shows the Study end date. | Should | study.js `MODULES.study`, settings.js |

### 11.2 When the add-on ends

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STM-006 | The add-on is active while its end date is empty or in the future. A job (`luma-plan-expiry`, hourly at minute 5) shall notify "⏳ Your Study add-on ends in 7 days" and "… ends tomorrow" (at most once per 20 hours) and "Your Study add-on has ended" ("Everything you made is kept, but you can not add new Study items until it is switched on again. Renew from Settings → your plan."; at most once per 3 days). | Must | migration 062 `run_plan_expiry` |
| FR-STM-007 | When the add-on ends, the person who is in Study mode (or on the Study page) shall be moved to Personal mode and the dashboard (checked when the app is opened again after 2 minutes, and after any plan change), the Study mode button is locked, and the Study archive opens the add-on popup. | Must | modes.js `enforceModeAccess`, router.js |
| FR-STM-008 | After the add-on ends, the database refuses adding or changing Study rows (subjects, classes, assignments, semesters, notes, decks, attendance, cancelled dates, breaks; semester activate / archive / restore) with a row-level-security error, which the app words as "Your Study add-on isn't active, so changes can't be saved."; deleting the person's own Study rows and permanently deleting an archived semester still work. | Must | migrations 045, 046, 049, 052, 053, 056, 057, 067; study.js `sdHint` |
| FR-STM-009 | After the add-on ends, nothing is deleted. Reminders for assignments and classes stop (the jobs check the add-on); group-task reminders continue; Study items disappear from the Calendar, search and busy-day counts; shared notes stay readable by the people they were shared with (FR-STN-014); projects the person is invited to keep working as a guest (FR-STG-018). Study data of the ended person is not included in "Export my data" (FR-STK-017). | Must | migrations 052, 058, 060, 082; calendar.js; study.js |
| FR-STM-010 | When the person gets the add-on again (renewal, admin switch), all earlier Study data is shown again as it was. | Must | migration 044 (an ended add-on only sets the end date) |

### 11.3 Spaces and "Show Study in Personal"

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STM-011 | Items made while in Study mode (reminders, events, tasks, notes, documents, habits, goals, bills, money entries) shall be filed with space "study" and shown only in Study mode, and in Personal mode only while Settings → Preferences → "Show Study in Personal" is on ("Turn it off and it is gone from Personal again."). Work mode never shows Study items. | Must | shared/luma-space.js, migration 050 |
| FR-STM-012 | A "study" tag shall be accepted only while the person has the add-on; otherwise the database keeps the item as personal. | Must | migration 050 `check_space` |
| FR-STM-013 | Items of an archived semester shall be hidden from every page and from the Calendar (the client adds a filter excluding archived semester ids) except on the Study archive page, which switches the filter off while it reads. | Must | shared/luma-space.js, study.archive.js |
| FR-STM-014 | Until migration 050 / 056 has run, nothing is filtered or tagged and the app keeps working. | Could | shared/luma-space.js |
| FR-STM-015 | Study mode shows the menu entries Study, Study archive, Calendar, Reminders, Notes, Documents and Assistant (plus Settings, Support, Feedback, Notifications and the admin pages); Personal mode shows everything that is not mode-only. The mode is remembered between visits. Opening the Study archive switches to Study mode. | Must | modes.js `MODE_MENUS`, `modeSync` |

### 11.4 Busy days

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STM-016 | In the Calendar, Dashboard, Work and Study Overview the app shall mark a day "busy" or "packed" using what the Calendar shows for the mode (in Study mode: events, tasks, bills, classes and Study deadlines); a class counts as half a thing. Levels (Settings → Preferences → "How easily a day counts as busy"), given as busy / packed for things, hours booked and clashes: Sensitive 4 / 6 things, 4 / 6 hours, 1 / 2 clashes; Normal 6 / 9, 6 / 9, 1 / 3; Relaxed 8 / 12, 8 / 12, 2 / 4. The alert can be switched off ("Busy-day alerts"). | Should | app/core/busy.js, CHANGELOG (busy-day alerts) |
| FR-STM-017 | At 18:00 in the person's time zone a job (`luma-busy-alerts`) shall send "⚠️ Tomorrow is busy" or "🔥 Tomorrow is packed" counting, for a person with the Study add-on, open Study deadlines on that day (1 each) and classes on that weekday (0.5 each). | Should | migration 082 `busy_day_stats` |

### 11.5 Plans

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-STM-018 | Study shall be available on Dawn, Glow and Zenith alike; the plan only decides whether reminder times can be chosen (FR-STT-023, FR-STA-021). If the plan cannot be found out, the app falls back to the strictest plan (Dawn) and never to a bigger one. | Must | shared/luma-plan.js, ADDONS popup text |
| FR-STM-019 | The browser remembers the last plan and add-ons it saw (`luma_plan_cache`) so the menu does not flicker; the plan and add-ons are fetched again when the app is opened after more than 2 minutes. | Could | shared/luma-plan.js, modes.js |

## 12. Non-functional requirements

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-STT-001 | The Study page and all its popups shall have no horizontal page scroll at 320, 360, 390 px and 1180 px widths; on windows up to 900 px the tab names are hidden (icons only), the week grid is replaced by the list, the list columns become 2 (up to 1100 px) or 1 (up to 560 px), and the Export button shows only its icon at 560 px or less. | Must | study.css, CHANGELOG (responsive checks) |
| NFR-STT-002 | On windows from 901 to 1360 px only the open tab shows its name, so all eight tabs fit. | Should | study.css, CHANGELOG (Study tabs on a laptop window) |
| NFR-STM-001 | Every Study table has row level security; a person can read only their own rows; group and shared-note data is reachable only through functions that check the caller (`security definer`, `search_path = ''`); `anon` has no access. | Must | migrations 045 to 067 |
| NFR-STM-002 | Rows are protected from abuse by limits (section 3) and by text length checks in the database; limits are enforced by triggers, not only by the page. | Must | migrations 045 to 067 |
| NFR-STM-003 | Study data from other pages (Calendar, Focus Mode, busy-day notice) is reused for 60 seconds before it is fetched again. | Could | study.js `sdEnsureLoaded` |
| NFR-STS-001 | Pages written for a newer migration shall degrade: if a column from a later migration is missing the app retries with the older columns and shows a message naming the migration to run. | Could | study.data.js `table` |
| NFR-STM-004 | All user-supplied text shown in Study (subject, class, note, comment, project names) is HTML-escaped. | Must | study*.js `escapeHtml` |
| NFR-STT-003 | The server jobs run on a schedule: class reminders every minute; assignment, group-task reminders hourly (at minute 0); plan expiry hourly (minute 5); busy alerts hourly with a 18:00 local-time check. A reminder is never sent twice inside its de-duplication window (3 to 20 hours, see requirements). | Must | pg_cron in migrations 045, 052, 058, 062, 082 |
