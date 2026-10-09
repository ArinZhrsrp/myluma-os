# Test cases — Study mode

Test cases for `docs/srs/SRS-study.md`. Format and identifiers follow `docs/CONVENTIONS.md`. Areas in SRS order: STT, STA, STS, STG, STN, STC, STK, STM.

**Common preconditions.** "Study user" = signed in with the Study add-on and one **active semester** ("Semester 2, 2026", 14 weeks, started 4 weeks ago) and the subject "Databases". "Second user" = another account with a different add-on state, accepted as a contact of the Study user. Staging site, so the trial button is visible.

**Automation key.** `pg_study_test` and `pg_study2_test` (`docs/test-automation/sql/`) run the migrations in an in-memory Postgres and call the database rules directly; `pg_refs_test` checks notification references; `v41_test` renders each Study tab and the Study archive page in jsdom and only checks that the tab is not empty and no script error occurs ("study archive: ok"); `v49_test` prints whether the Study Overview busy box exists (no hard assertion); `space_test` (`edge/space_test.js`) prints how `shared/luma-space.js` filters and tags. Nothing automated clicks Study forms, so form messages are Manual.

## 1. Timetable and classes (STT)

#### TC-STT-001 — Week grid shows real dates on a laptop
- **Requirement:** FR-STT-001, FR-STT-002, FR-STT-003
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user with a class Mon 09:00–11:00; window 1180 px wide.
- **Test data:** None.
- **Steps:**
  1. Open Study → Timetable.
  2. Look at the header and scroll the grid.
  3. Press Next week, then Today.
- **Expected result:** "Week" view is shown with Mon–Sun real dates, 24 hours, the class block 2 hours high, a now line on today's column; the label reads "<d Mon> to <d Mon yyyy> · Semester 2, 2026, week n of 14"; Next week moves 7 days, Today returns.
- **Automation:** `v41_test` (only that the Timetable tab is not empty) · otherwise manual.

#### TC-STT-002 — Week / List switch remembered
- **Requirement:** FR-STT-001
- **Type / Priority:** Usability · P2
- **Preconditions:** Study user, 1180 px window.
- **Test data:** None.
- **Steps:**
  1. Press "List" in the Week/List switch.
  2. Reload the page and open Study → Timetable.
- **Expected result:** The list (seven day columns) is still shown after reload.
- **Automation:** Manual.

#### TC-STT-003 — Narrow window forces the list
- **Requirement:** FR-STT-001, NFR-STT-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** Study user with classes.
- **Test data:** Window 390 px, then 320 px.
- **Steps:**
  1. Open Study → Timetable at 390 px, then 320 px.
- **Expected result:** Only the list is shown, no Week/List switch, one day column per row, no horizontal page scroll.
- **Automation:** Device only (rig `audit.sh` measures overflow of pages at 320 / 360 px; TBC whether it opens the Study Timetable).

#### TC-STT-004 — Overlapping classes side by side
- **Requirement:** FR-STT-002
- **Type / Priority:** Functional · P3
- **Preconditions:** Two Monday classes 09:00–11:00 and 10:00–12:00.
- **Test data:** None.
- **Steps:**
  1. Open the Week grid on that Monday.
- **Expected result:** The two blocks share the column width side by side, none hidden.
- **Automation:** Manual.

#### TC-STT-005 — Tiny class is drawn at least 25 minutes
- **Requirement:** FR-STT-002
- **Type / Priority:** Boundary · P3
- **Preconditions:** A class 09:00–09:10 (add via New class).
- **Test data:** Start 09:00, end 09:10.
- **Steps:**
  1. Look at the block in the week grid.
- **Expected result:** The block is drawn about 25 minutes tall and has a title tooltip with the real times.
- **Automation:** Manual.

#### TC-STT-006 — Class outside its dates, cancelled day and break day in the grid
- **Requirement:** FR-STT-004, FR-STT-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Class Mon 09:00–10:00 from 2 weeks ago until 2 weeks ahead; one future Monday cancelled; another future Monday inside a break "Mid-term"; an archived subject with a Monday class.
- **Test data:** None.
- **Steps:**
  1. Step through the weeks with Next week.
- **Expected result:** The class shows on valid Mondays only; the cancelled Monday shows the block marked "cancelled"; the break week shows a "Break" tag and a shaded column with no block; weeks after the end date show no block; the archived subject's class never appears.
- **Automation:** Manual.

#### TC-STT-007 — List view ended classes
- **Requirement:** FR-STT-005, FR-STT-006
- **Type / Priority:** Functional · P2
- **Preconditions:** One class that ended last week and one current class; List view.
- **Test data:** None.
- **Steps:**
  1. Open the list. Note the button "Show ended classes (1)".
  2. Press it, then press "Hide ended classes (1)".
- **Expected result:** The ended class appears with "Ended <date>" and a faded style, then disappears again.
- **Automation:** Manual.

#### TC-STT-008 — Empty timetable
- **Requirement:** FR-STT-007
- **Type / Priority:** Usability · P2
- **Preconditions:** Study user with one subject and no class; then a user with no subject.
- **Test data:** None.
- **Steps:**
  1. Open Timetable.
  2. Repeat as the user with no subject.
- **Expected result:** "Build your weekly timetable" with "Add a class" (first user) or "Add a subject" (second).
- **Automation:** Manual.

#### TC-STT-009 — Add a class on several days
- **Requirement:** FR-STT-009, FR-STT-010, FR-STT-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user, subject "Databases" in the active semester.
- **Test data:** Days Mon and Wed, 09:00–11:00, Lecture, room "B2.1", end rule Weeks = 14.
- **Steps:**
  1. Timetable → Add class.
  2. Choose Databases; tap Mon and Wed; set times, type, room.
  3. Read the line under the end rule; press Save class.
- **Expected result:** The form opens with Starts on = today and an end date = semester last day (semester default); after choosing Weeks=14 the line reads "Runs <start> to <end> (14 weeks)". Two classes (Mon, Wed) are created.
- **Automation:** Manual (database constraint only: `pg_study_test` "class must end after it starts").

#### TC-STT-010 — Class form validation messages
- **Requirement:** FR-STT-011
- **Type / Priority:** Negative · P1
- **Preconditions:** New class form open.
- **Test data:** See steps.
- **Steps:**
  1. Clear Starts, press Save class.
  2. Set Starts 10:00, Ends 09:00, Save.
  3. Clear "Starts on", Save.
  4. Choose Weeks and type 0, then 61, Save each time.
  5. Choose Months and type 25, Save.
  6. Choose "On a date" with no date, Save.
  7. Choose "On a date" with a date before "Starts on", Save.
- **Expected result:** In order: "Set the start and end time."; "The class must end after it starts."; "Pick the date the class starts."; "Enter 1 to 60 weeks." (both); "Enter 1 to 24 months."; "Pick the date the class ends."; "The end date must be after the start date."
- **Automation:** Manual.

#### TC-STT-011 — End date equal to start date
- **Requirement:** FR-STT-011
- **Type / Priority:** Boundary · P3
- **Preconditions:** New class form.
- **Test data:** Starts on = End date = next Monday, class day Monday.
- **Steps:**
  1. Save.
- **Expected result:** Saved (message says "after" but equal dates are accepted; see Findings F-05).
- **Automation:** Manual.

#### TC-STT-012 — End rule limits
- **Requirement:** FR-STT-010
- **Type / Priority:** Boundary · P2
- **Preconditions:** New class form, start 2026-01-05.
- **Test data:** Weeks=60; Months=24; Weeks=1.
- **Steps:**
  1. For each value read the "Runs …" line and save.
- **Expected result:** Weeks=1 ends 2026-01-11; Weeks=60 ends 2027-02-28 (start + 60 weeks − 1 day); Months=24 ends 2028-01-04 (start + 24 months − 1 day); all save.
- **Automation:** Manual.

#### TC-STT-013 — New class needs an active semester and a subject
- **Requirement:** FR-STT-013, FR-STS-011
- **Type / Priority:** Negative · P1
- **Preconditions:** (a) Study user with no active semester; (b) Study user with an active semester and no subject.
- **Test data:** None.
- **Steps:**
  1. As (a) press Add class.
  2. As (b) press Add class.
- **Expected result:** (a) popup "No active semester" with "Open Semesters"; (b) New subject form opens with the toast "Add a subject first".
- **Automation:** Manual.

#### TC-STT-014 — Edit and delete a class
- **Requirement:** FR-STT-009, FR-STT-014
- **Type / Priority:** Functional · P1
- **Preconditions:** A class with a cancelled date and an attendance record.
- **Test data:** None.
- **Steps:**
  1. Tap the class; note only one day chip can be chosen; change the room; Save.
  2. Open it again; press Delete; read the confirmation; confirm.
- **Expected result:** Room updated. Confirmation "Delete this class?". Class gone; its cancelled date and attendance record are gone too.
- **Automation:** Manual (cascade is by foreign key, not asserted).

#### TC-STT-015 — Cancel one session
- **Requirement:** FR-STT-016
- **Type / Priority:** Functional · P1
- **Preconditions:** Monday class; edit form open.
- **Test data:** A future Monday.
- **Steps:**
  1. In "Cancelled dates" pick the Monday; press add.
  2. Remove the chip with the cross.
- **Expected result:** A chip with the date appears and the grid marks that session cancelled; removing the chip brings the class back.
- **Automation:** Manual.

#### TC-STT-016 — Cancel session errors
- **Requirement:** FR-STT-016
- **Type / Priority:** Negative · P2
- **Preconditions:** Monday class; edit form open.
- **Test data:** A Tuesday; a Monday already cancelled; empty date.
- **Steps:**
  1. Add the Tuesday.
  2. Add an already cancelled Monday.
  3. Clear the date and add.
- **Expected result:** "That date is a Tuesday; this class is on Mon."; "That date is already cancelled."; "Pick the date to cancel."
- **Automation:** Manual (uniqueness of class+date: database `unique`, not tested).

#### TC-STT-017 — Add a break
- **Requirement:** FR-STT-017, FR-STT-018
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user with classes.
- **Test data:** Name "Mid-sem break", From = To = a future Monday; then From 3 days, To 1 day earlier.
- **Steps:**
  1. Semesters → Breaks & holidays.
  2. Add the single-day break.
  3. Add a break with To before From.
  4. Check Timetable, Calendar for that day.
- **Expected result:** Single day break saved ("1 day"); the second is refused "The last day must not be before the first day."; the day has no classes in grid or Calendar. Button shows "Breaks & holidays (1)".
- **Automation:** Manual.

#### TC-STT-018 — Break validation and limit
- **Requirement:** FR-STT-017
- **Type / Priority:** Boundary · P3
- **Preconditions:** Breaks dialog.
- **Test data:** Empty name; 61-character name; 100 breaks then one more.
- **Steps:**
  1. Add with empty name.
  2. Type 61 characters (the field stops at 60).
  3. (Database) insert the 101st break.
- **Expected result:** "Give the break a name."; input limited to 60; the 101st insert fails with "You have reached the limit of 100 breaks".
- **Automation:** Manual.

#### TC-STT-019 — Import Malaysian national days
- **Requirement:** FR-STT-019
- **Type / Priority:** Functional · P2
- **Preconditions:** Breaks dialog → Import public holidays.
- **Test data:** Year 2026.
- **Steps:**
  1. Choose "Malaysia: national days" and press the button.
  2. Untick Christmas Day; press "Add 5 holidays".
  3. Open the import again and repeat.
- **Expected result:** Six holidays listed, Agong's Birthday on the first Monday of June 2026 (1 June); five added with toast "Holidays added"; on the second import they show "already added" and cannot be ticked.
- **Automation:** Manual.

#### TC-STT-020 — Import holidays by country (online and offline)
- **Requirement:** FR-STT-019, FR-STT-020
- **Type / Priority:** Functional · P3
- **Preconditions:** Online, then offline.
- **Test data:** Country Singapore, year 2026.
- **Steps:**
  1. Choose "By country", Find.
  2. Go offline; Find again; also open the dialog with offline country list.
  3. Pick a country with no data.
- **Expected result:** Online: list found. Offline: "Could not reach the holiday list (are you online?). You can still import a calendar file." and the 14-country fallback list. No-data country: "No automatic list exists for that country. Try “Malaysia: national days” or import a calendar file."
- **Automation:** Manual.

#### TC-STT-021 — Import holidays from a calendar file
- **Requirement:** FR-STT-019, FR-STT-020
- **Type / Priority:** Functional · P3
- **Preconditions:** A .ics with two all-day events (one spanning 3 days), and an empty .ics, and a text file.
- **Test data:** Files above.
- **Steps:**
  1. Choose "From a file" and pick each file.
- **Expected result:** First file: two items; the 3-day event ends one day before its DTEND. Empty file: "No events were found in that file." Names longer than 60 characters are cut.
- **Automation:** Manual.

#### TC-STT-022 — Class reminder fires and respects exclusions
- **Requirement:** FR-STT-021, FR-STT-022
- **Type / Priority:** Integration · P1
- **Preconditions:** Study user, class starting in 10 minutes, lead time 15, Classes reminder on.
- **Test data:** Repeat with: cancelled today, break today, archived subject, add-on expired, reminder off.
- **Steps:**
  1. Wait one minute (job runs every minute) or run `luma.run_class_reminders()`.
  2. Repeat after each exclusion.
- **Expected result:** "🎓 Databases starts in 10 min" with body "<time> · <room>" once (not repeated within 6 hours); nothing in any excluded case.
- **Automation:** Manual (the job is not called by `pg_study_test`; only the timed-assignment job is).

#### TC-STT-023 — Class reminder lead on Dawn
- **Requirement:** FR-STT-023, FR-STA-021
- **Type / Priority:** Security · P2
- **Preconditions:** Dawn plan with Study add-on.
- **Test data:** `class_lead_min` = 30.
- **Steps:**
  1. Open Settings → Reminders; look at the Classes card.
  2. Try to save `class_lead_min` 30 through the API.
- **Expected result:** The lead selector is locked; the database refuses with "Plan limit: choosing reminder times …"; switching the reminder on / off still works.
- **Automation:** Manual.

#### TC-STT-024 — Mark attendance on Overview
- **Requirement:** FR-STT-024, FR-STT-026
- **Type / Priority:** Functional · P1
- **Preconditions:** A class that started 30 minutes ago and one that starts in 3 hours.
- **Test data:** None.
- **Steps:**
  1. Overview → Today's classes.
  2. Tap Present on the started class; tap Present again.
  3. Tap Late, then Absent.
- **Expected result:** Only the started class has buttons. Present highlights; second tap clears; Late then Absent replace the status; one record per class and date.
- **Automation:** `pg_study2_test` ("one record per class and date", "upsert changes the status") for the database part.

#### TC-STT-025 — Past sessions list and Excused
- **Requirement:** FR-STT-025
- **Type / Priority:** Functional · P2
- **Preconditions:** Weekly class running for 6 weeks, one date cancelled, one in a break.
- **Test data:** None.
- **Steps:**
  1. Subjects → Attendance on the subject.
  2. Set a past session Excused.
- **Expected result:** Past sessions newest first, cancelled / break dates absent; four buttons per session; Excused saved.
- **Automation:** Manual.

#### TC-STT-026 — Attendance list limited to 120 sessions
- **Requirement:** FR-STT-025
- **Type / Priority:** Boundary · P3
- **Preconditions:** A class with no end date running daily-weekly for more than 120 past weeks (start date 3 years ago).
- **Test data:** None.
- **Steps:**
  1. Open the Attendance popup.
- **Expected result:** At most 120 rows (newest). Older sessions cannot be marked (Findings F-09).
- **Automation:** Manual.

#### TC-STT-027 — Attendance database rules
- **Requirement:** FR-STT-026, FR-STM-008
- **Type / Priority:** Security · P1
- **Preconditions:** Database access as the Study user and as a user without the add-on.
- **Test data:** Status "maybe"; a class of another subject; another user's class.
- **Steps:**
  1. Insert attendance with status "maybe".
  2. Insert with a mismatching course_id.
  3. As the user without add-on insert a record.
- **Expected result:** All three refused (check constraint; "That class is not yours"; row level security).
- **Automation:** `pg_study2_test` ("unknown status refused", "the class must belong to that subject", "without the add-on nothing can be added").

#### TC-STT-028 — Export the timetable
- **Requirement:** FR-STT-028, FR-STT-029
- **Type / Priority:** Functional · P2
- **Preconditions:** Classes with a cancelled day and a break, plus an open assignment with a due time.
- **Test data:** None.
- **Steps:**
  1. Timetable → Export; read the confirmation; press Download.
  2. Open `LUMA-study.ics` in a text editor.
  3. Repeat on an account with nothing to export.
- **Expected result:** Confirmation "Export your timetable" with counts; file has weekly RRULE with UNTIL, EXDATE lines for the cancelled and break Mondays, 15-minute alarm; the assignment appears. Empty account: "There is nothing to export yet. Add your classes and assignments first."
- **Automation:** Manual.

#### TC-STT-029 — Class limits and constraints in the database
- **Requirement:** FR-STT-009, FR-STT-014, NFR-STM-002
- **Type / Priority:** Boundary · P3
- **Preconditions:** Database access as the Study user.
- **Test data:** weekday 7; end_date before start_date; the 201st class.
- **Steps:**
  1. Insert each invalid row.
- **Expected result:** weekday 7 and end_date < start_date violate checks; the 201st class gives "You have reached the limit of 200 classes".
- **Automation:** Manual.

#### TC-STT-030 — Timetable at phone widths
- **Requirement:** NFR-STT-001, FR-STT-005
- **Type / Priority:** Responsive · P1
- **Preconditions:** Study user with 6 classes.
- **Test data:** 320, 360, 390 px.
- **Steps:**
  1. Open Timetable and the New class popup at each width.
- **Expected result:** No horizontal scroll; Export shows only its icon at 560 px or less; popup fits and scrolls inside.
- **Automation:** Device only.

#### TC-STT-031 — Quick add from the grid and missing attendance tables
- **Requirement:** FR-STT-008, FR-STT-027
- **Type / Priority:** Usability · P3
- **Preconditions:** Week grid on a laptop; (second part) a test database without migration 067.
- **Test data:** Click in the Wednesday column at 14:20; list day header "+" on Friday.
- **Steps:**
  1. Click the empty Wednesday column at 14:20.
  2. In list mode press "+" on Friday.
  3. On the database without 067 open Subjects and mark attendance via the API path.
- **Expected result:** New class opens on Wednesday 14:00–15:00 (hour start, one hour later); Friday for the "+"; without 067 the attendance controls are hidden and saving shows "Attendance needs one more database step: run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor."
- **Automation:** Manual.

## 2. Assignments, tests and exams (STA)

#### TC-STA-001 — Add an assignment with everything filled
- **Requirement:** FR-STA-006, FR-STA-007, FR-STA-014
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user.
- **Test data:** Title "ER diagram report", Type Exam, Subject Databases, due next Friday 14:30, Weight 30, notes "Bring ID".
- **Steps:**
  1. Assignments → Add assignment; fill the form; Save.
- **Expected result:** Row shows the title, "Exam", the subject chip, due text "<Friday>· 2:30 pm" and a "30%" pill. In the database `semester_id` is the active semester.
- **Automation:** `pg_study_test` ("assignment gets the active semester") for the semester rule.

#### TC-STA-002 — Required title
- **Requirement:** FR-STA-009, FR-STA-006
- **Type / Priority:** Negative · P1
- **Preconditions:** New assignment form.
- **Test data:** Empty title; title of 141 characters.
- **Steps:**
  1. Save with an empty title.
  2. Paste 141 characters.
- **Expected result:** "Give it a title."; the field stops at 140 characters.
- **Automation:** Manual.

#### TC-STA-003 — Weight boundaries
- **Requirement:** FR-STA-009, FR-STA-010
- **Type / Priority:** Boundary · P1
- **Preconditions:** New assignment form.
- **Test data:** Weight -1, 0, 100, 100.01, "abc", "12,5".
- **Steps:**
  1. Save with each value (title filled).
- **Expected result:** 0, 100 and 12,5 (stored 12.5) save; -1, 100.01, abc show "Weight is a percentage between 0 and 100."
- **Automation:** Manual.

#### TC-STA-004 — Score and Out of rules
- **Requirement:** FR-STA-009
- **Type / Priority:** Boundary · P1
- **Preconditions:** New assignment form.
- **Test data:** (score, out of): (45, 50), (45, empty), (-1, 50), (10, 0), (60, 50).
- **Steps:**
  1. Save each pair.
- **Expected result:** (45,50) saves; (45, empty) "Add what the score is out of, e.g. 50."; (-1,50) and (10,0) "Score must be 0 or more, and "Out of" above 0."; (60,50) saves (TBC whether intended).
- **Automation:** Manual.

#### TC-STA-005 — Due time only with a due date
- **Requirement:** FR-STA-008
- **Type / Priority:** Functional · P2
- **Preconditions:** New assignment form.
- **Test data:** Due time 09:00, no due date.
- **Steps:**
  1. Fill title and time only; Save; reopen.
- **Expected result:** Saved without due time and "No due date".
- **Automation:** Manual.

#### TC-STA-006 — Due text variants
- **Requirement:** FR-STA-012
- **Type / Priority:** Functional · P2
- **Preconditions:** Open assignments due 3 days ago, today, tomorrow, in 4 days, in 10 days; and one Done and past.
- **Test data:** None.
- **Steps:**
  1. Open the Assignments list.
- **Expected result:** "3 days overdue", "Today", "Tomorrow", a weekday name, "<d Mon>"; the Done past item shows no overdue text.
- **Automation:** Manual.

#### TC-STA-007 — Groups in the To do list
- **Requirement:** FR-STA-001, FR-STA-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Items as in TC-STA-006 plus one without a date.
- **Test data:** None.
- **Steps:**
  1. Filter "To do"; then "Done"; then "All"; then press a subject chip.
- **Expected result:** To do: groups Overdue, Next 7 days, Later, No due date with counts; Done and All: single list newest due first; subject chip narrows. Empty filter: "Nothing here with these filters."
- **Automation:** `v41_test` (tab renders non-empty only).

#### TC-STA-008 — Empty list
- **Requirement:** FR-STA-003
- **Type / Priority:** Usability · P3
- **Preconditions:** Study user with a subject but no assignment.
- **Test data:** None.
- **Steps:**
  1. Open Assignments.
- **Expected result:** "No assignments yet. Tap Add assignment to track your first one."
- **Automation:** Manual.

#### TC-STA-009 — Tick done and undo; failure revert
- **Requirement:** FR-STA-011
- **Type / Priority:** Functional · P1
- **Preconditions:** One open assignment.
- **Test data:** None.
- **Steps:**
  1. Press the tick; press it again.
  2. Go offline and press the tick.
- **Expected result:** Toast "Done" and row greys; second press returns to To do (completed_at cleared). Offline: row reverts and alert "Could not update: …".
- **Automation:** Manual (`completed_at` trigger not asserted by the suites).

#### TC-STA-010 — Status values
- **Requirement:** FR-STA-007
- **Type / Priority:** Functional · P3
- **Preconditions:** An open assignment.
- **Test data:** Status In progress.
- **Steps:**
  1. Edit; choose In progress; Save; filter To do.
- **Expected result:** Still listed under To do (any status except Done).
- **Automation:** Manual.

#### TC-STA-011 — Subject dropdown excludes archived subjects
- **Requirement:** FR-STA-006, FR-STA-005
- **Type / Priority:** Functional · P2
- **Preconditions:** One archived subject.
- **Test data:** None.
- **Steps:**
  1. Open New assignment; open the Subject list.
  2. Open an old assignment of the archived subject.
- **Expected result:** Archived subject not offered for new; the old one still shows its own subject.
- **Automation:** Manual.

#### TC-STA-012 — Archived items leave live views
- **Requirement:** FR-STA-005
- **Type / Priority:** Data · P1
- **Preconditions:** Assignment in subject "Physics"; archive Physics.
- **Test data:** None.
- **Steps:**
  1. Archive the subject; look at Overview, Assignments, Calendar, global search.
  2. Open Study → Archive → Archived subjects → Assignments.
- **Expected result:** Gone from live views; present in the archive.
- **Automation:** Manual.

#### TC-STA-013 — Delete assignment
- **Requirement:** FR-STA-013
- **Type / Priority:** Functional · P2
- **Preconditions:** An assignment.
- **Test data:** None.
- **Steps:**
  1. Open; Delete; Cancel; Delete again; confirm.
- **Expected result:** Confirmation "Delete “<title>”?" "This can't be undone."; cancelling keeps it; confirming removes it.
- **Automation:** Manual.

#### TC-STA-014 — Subject deleted, assignment stays
- **Requirement:** FR-STA-015, FR-STS-005
- **Type / Priority:** Data · P1
- **Preconditions:** Assignment in subject "Physics" with a class.
- **Test data:** None.
- **Steps:**
  1. Delete the subject Physics.
  2. Look at the assignment and the timetable.
- **Expected result:** Assignment stays with no subject chip; the class is gone.
- **Automation:** Manual.

#### TC-STA-015 — Timed assignment reminder
- **Requirement:** FR-STA-017, FR-STA-020
- **Type / Priority:** Integration · P1
- **Preconditions:** Assignment due today in 20 minutes; lead 60.
- **Test data:** None.
- **Steps:**
  1. Run the study reminder job.
  2. Run again; then mark Done and run.
- **Expected result:** "🎓 <title> is due in 20 min" once; not repeated within 3 hours; none when Done.
- **Automation:** `pg_study_test` ("a timed item due in 20 min is reminded now").

#### TC-STA-016 — Day-before and due-day reminders at the chosen hour
- **Requirement:** FR-STA-016, FR-STA-020
- **Type / Priority:** Integration · P1
- **Preconditions:** Assignments due in 3 days, tomorrow and today (no time); reminder hour = current hour.
- **Test data:** Study days 3, hour 9.
- **Steps:**
  1. Run the job at 09:xx local; run at 10:xx.
- **Expected result:** At 09: "is due in 3 days", "is due tomorrow", "is due today". At 10: nothing; no duplicates within 12 hours.
- **Automation:** Manual.

#### TC-STA-017 — Overdue nudges stop after 7 days
- **Requirement:** FR-STA-018
- **Type / Priority:** Boundary · P2
- **Preconditions:** Open items overdue by 1, 7 and 8 days.
- **Test data:** None.
- **Steps:**
  1. Run the job at the reminder hour.
- **Expected result:** "⚠️ … is overdue by 1 day" and "… by 7 days"; nothing for 8 days.
- **Automation:** Manual.

#### TC-STA-018 — Extra reminder rules
- **Requirement:** FR-STA-019
- **Type / Priority:** Functional · P1
- **Preconditions:** Assignment edit form.
- **Test data:** Reminder time only; a past date/time; a date 2 minutes ahead.
- **Steps:**
  1. Fill only the time, Save.
  2. Fill a past date and time, Save.
  3. Fill a date 2 minutes ahead; Save; run the job after 2 minutes twice.
- **Expected result:** "Pick the date of the extra reminder too."; "Pick a reminder time in the future."; saved; "🎓 Reminder: <title>" sent once (reminded_at set).
- **Automation:** `pg_study_test` ("the extra reminder fires once and is marked") for the job part.

#### TC-STA-019 — Reminders excluded: archived, no add-on, switched off
- **Requirement:** FR-STA-020
- **Type / Priority:** Negative · P1
- **Preconditions:** Item due today at the reminder hour.
- **Test data:** Cases: subject archived; add-on ended; Study reminder switched off.
- **Steps:**
  1. For each case run the job.
- **Expected result:** No notification in any case.
- **Automation:** `pg_study_test` covers "archive … its reminders are switched off" for Personal reminders only; the rest Manual.

#### TC-STA-020 — Study reminder settings on Dawn vs Glow
- **Requirement:** FR-STA-021
- **Type / Priority:** Functional · P2
- **Preconditions:** One Dawn and one Glow account, both with Study.
- **Test data:** Hour 8 am, 5 days before, timed lead 30 min.
- **Steps:**
  1. Open Settings → Reminders → Study on each; change the three selectors.
- **Expected result:** Dawn: selectors locked, switch still works; Glow: changes saved. Study card absent when no add-on.
- **Automation:** Manual.

#### TC-STA-021 — Database limits on assignments
- **Requirement:** FR-STA-010, NFR-STM-002
- **Type / Priority:** Boundary · P3
- **Preconditions:** Database access.
- **Test data:** kind "homework"; notes of 1001 characters; subject of another user; 1501st row.
- **Steps:**
  1. Insert each.
- **Expected result:** Check violations, "That subject is not yours", and "You have reached the limit of 1500 assignments".
- **Automation:** Manual.

#### TC-STA-022 — Another user cannot read or change my assignments
- **Requirement:** FR-STA-010, NFR-STM-001
- **Type / Priority:** Security · P1
- **Preconditions:** Two users; user 1 has an assignment.
- **Test data:** None.
- **Steps:**
  1. As user 2 select all rows and try to update / delete user 1's row.
- **Expected result:** No rows visible, update/delete affect 0 rows.
- **Automation:** `pg_study_test` ("another user cannot change my subject") covers subjects; assignments Manual.

#### TC-STA-023 — Notification opens the assignment
- **Requirement:** FR-STA-022
- **Type / Priority:** Usability · P3
- **Preconditions:** A reminder notification for an assignment.
- **Test data:** None.
- **Steps:**
  1. Tap it in Notifications.
- **Expected result:** Study opens and the assignment is highlighted.
- **Automation:** `pg_refs_test` covers references of notes and projects only; this one Manual.

#### TC-STA-024 — Lumi adds a study item
- **Requirement:** FR-STA-023
- **Type / Priority:** Integration · P3
- **Preconditions:** Study user, Lumi on a plan allowing actions.
- **Test data:** "Add an assignment: ER report for Databases, due Friday".
- **Steps:**
  1. Ask Lumi.
- **Expected result:** The assignment appears under Assignments; for a user without the add-on Lumi reports it is not switched on.
- **Automation:** Manual (`lumi_tools_test` is outside this area; TBC whether it covers study tools).

#### TC-STA-025 — Assignments on phone width
- **Requirement:** FR-STA-004, NFR-STT-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** List with long titles.
- **Test data:** 320, 360, 390 px.
- **Steps:**
  1. Open Assignments and the form.
- **Expected result:** Long titles wrap; pills visible; no horizontal scroll; the form scrolls inside the popup.
- **Automation:** Device only.

## 3. Subjects and semesters (STS)

#### TC-STS-001 — Add a subject
- **Requirement:** FR-STS-002, FR-STS-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user with an active semester.
- **Test data:** Name "Database Systems", code "CS201", credit hours 4, lecturer "Dr Lim", colour 3rd swatch.
- **Steps:**
  1. Subjects → Add subject; note the semester chip; fill; Save subject.
- **Expected result:** Chip shows the active semester with "New subjects go into your active semester."; the card appears under "Semester 2, 2026 · Current" with "CS201 · Dr Lim · 4 credit hours".
- **Automation:** `pg_study_test` ("new subject goes into the active semester automatically").

#### TC-STS-002 — Subject validation
- **Requirement:** FR-STS-003, FR-STS-002
- **Type / Priority:** Negative · P1
- **Preconditions:** New subject form.
- **Test data:** Empty name; credit hours 31; target 101; final "abc"; credit hours "3.5" typed.
- **Steps:**
  1. Save each variation.
- **Expected result:** "Give the subject a name."; "Credit hours should be between 0 and 30."; "Marks are percentages between 0 and 100." (target and final); credit hours field drops the dot (digits only).
- **Automation:** Manual.

#### TC-STS-003 — Subject boundaries
- **Requirement:** FR-STS-002, FR-STS-003
- **Type / Priority:** Boundary · P2
- **Preconditions:** New subject form.
- **Test data:** Credit hours 0 and 30; target 0 and 100; name 80 chars; code 20 chars.
- **Steps:**
  1. Save each.
- **Expected result:** All saved; name and code fields stop at 80 and 20.
- **Automation:** Manual.

#### TC-STS-004 — Subject limit
- **Requirement:** FR-STS-002, NFR-STM-002
- **Type / Priority:** Boundary · P3
- **Preconditions:** 40 subjects.
- **Test data:** The 41st.
- **Steps:**
  1. Save a new subject.
- **Expected result:** Error "You have reached the limit of 40 subjects" shown in the form.
- **Automation:** Manual.

#### TC-STS-005 — Delete a subject
- **Requirement:** FR-STS-005
- **Type / Priority:** Data · P1
- **Preconditions:** Subject with a class, attendance, assignment, note, deck.
- **Test data:** None.
- **Steps:**
  1. Edit the subject; Delete; read the message; confirm.
- **Expected result:** Class and attendance gone; assignment, note and deck remain without subject.
- **Automation:** Manual.

#### TC-STS-006 — Archive and restore one subject
- **Requirement:** FR-STS-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Subject with a class and an assignment.
- **Test data:** None.
- **Steps:**
  1. Edit subject → Status Archived → Save.
  2. Check Timetable, Calendar, Assignments.
  3. Press "Show archived subjects (1)"; edit; Status Active.
- **Expected result:** Class and assignment vanish from live views and the card shows "Archived"; after restore they return.
- **Automation:** Manual.

#### TC-STS-007 — Bulk archive and restore
- **Requirement:** FR-STS-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Three subjects.
- **Test data:** Select two.
- **Steps:**
  1. Press Select; tap two cards; "Archive (2)"; read confirmation; confirm.
  2. Show archived; Select all; "Restore (2)".
- **Expected result:** Confirmation "Archive 2 subjects?" with the GPA note; toast "Archived"; later "Restored". Buttons disabled when no matching selection.
- **Automation:** Manual.

#### TC-STS-008 — Subject card contents
- **Requirement:** FR-STS-007, FR-STS-001
- **Type / Priority:** Functional · P2
- **Preconditions:** Subject with scored assignment, one open assignment, one class, focus time.
- **Test data:** None.
- **Steps:**
  1. Open Subjects; read the card.
- **Expected result:** Grade % with letter and "Grade so far"; "To do 1"; "Classes / week 1"; "This week" minutes; target line when applicable.
- **Automation:** `v41_test` (renders only).

#### TC-STS-009 — Create a semester (inputs)
- **Requirement:** FR-STS-008
- **Type / Priority:** Negative · P1
- **Preconditions:** Add semester form.
- **Test data:** Empty name; empty date; last day = first day; last day before first.
- **Steps:**
  1. Save each.
- **Expected result:** "Give the semester a name."; "Pick the first and last day."; "The last day must be after the first day." (both).
- **Automation:** Manual (database `check (end_date > start_date)` not asserted).

#### TC-STS-010 — Semester default dates and weeks hint
- **Requirement:** FR-STS-008
- **Type / Priority:** Boundary · P3
- **Preconditions:** Add semester form.
- **Test data:** First 2026-02-02, last 2026-05-10.
- **Steps:**
  1. Read the default dates; enter the test data.
- **Expected result:** Default last day is 97 days after the first (14 weeks); hint "14 weeks · 2 Feb to 10 May".
- **Automation:** Manual.

#### TC-STS-011 — First semester becomes active by default
- **Requirement:** FR-STS-012, FR-STS-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user with no semester.
- **Test data:** "Semester 1".
- **Steps:**
  1. Study shows a banner or empty state; open Semesters → Add semester.
  2. Note "Make it the active semester?" defaults to Yes; Save.
- **Expected result:** Created and active; tag "Active"; other tabs have no banner; adding subjects works.
- **Automation:** `pg_study_test` (activation rules).

#### TC-STS-012 — Only one active semester
- **Requirement:** FR-STS-010, FR-STS-012
- **Type / Priority:** Negative · P1
- **Preconditions:** One active semester; a second inactive one.
- **Test data:** Direct database update `is_active = true`.
- **Steps:**
  1. In the app note "Activate (archive <name> first)" is disabled and in the New semester form "Yes" is disabled.
  2. Try the direct update and the function `activate_study_semester`.
- **Expected result:** The update is ignored; the function raises `Archive "<name>" first: only one semester can be active at a time`; exactly one active semester remains.
- **Automation:** `pg_study_test` ("direct update cannot activate", "second activation refused while one is active", "exactly one active semester").

#### TC-STS-013 — No active semester blocks adding
- **Requirement:** FR-STS-011, FR-STS-013
- **Type / Priority:** Negative · P1
- **Preconditions:** Study user, all semesters inactive or archived.
- **Test data:** None.
- **Steps:**
  1. Try Add subject, Add assignment, New note, New deck, Add class, New project.
  2. Press "Open Semesters" in the popup.
  3. Insert a subject directly in the database.
- **Expected result:** Popup "No active semester" every time; opens Semesters; banner "No active semester" on other tabs; database says "Activate a semester first: Study items are added to your active semester."
- **Automation:** `pg_study_test` ("Study on but no active semester → "Activate a semester first"", "after archiving, adding needs a new active semester").

#### TC-STS-014 — Activate a semester
- **Requirement:** FR-STS-012
- **Type / Priority:** Functional · P1
- **Preconditions:** No active semester, one inactive.
- **Test data:** None.
- **Steps:**
  1. Press "Make this the active semester".
- **Expected result:** Toast "Semester activated"; tag Active; archived semester cannot be activated ("That semester is not available").
- **Automation:** `pg_study_test` ("next semester can be activated").

#### TC-STS-015 — Semester card states and CGPA tiles
- **Requirement:** FR-STS-009, FR-STS-014
- **Type / Priority:** Functional · P2
- **Preconditions:** Semesters: ended, running, future.
- **Test data:** None.
- **Steps:**
  1. Read Semesters and Overview strip.
- **Expected result:** "Ended", "Week n of N", "Starts in n days"; the strip shows "Week n of N · m weeks left" / "Starts <date> (in n days)" / "Ended <date>"; tiles CGPA, Subjects, Credit hours graded.
- **Automation:** `v41_test` (renders only).

#### TC-STS-016 — Edit and delete a non-archived semester
- **Requirement:** FR-STS-015
- **Type / Priority:** Data · P2
- **Preconditions:** Inactive semester with two subjects and a deck; active semester with one subject.
- **Test data:** None.
- **Steps:**
  1. Edit the name and dates; Save.
  2. Delete the inactive semester; read the message; confirm.
  3. Look at Subjects and Cards.
- **Expected result:** "Delete “<name>”?" says subjects stay; subjects appear under "No semester"; the deck is deleted too (Findings F-02). Deleting the active semester leaves no active semester.
- **Automation:** Manual.

#### TC-STS-017 — Archive a semester ("Done with this semester")
- **Requirement:** FR-STS-016, FR-STS-017
- **Type / Priority:** Data · P1
- **Preconditions:** Active semester with subjects, classes, 3 assignments (1 open), a note, a Personal reminder made in Study mode.
- **Test data:** Remark "Finished with 3.6 GPA".
- **Steps:**
  1. Press "Done with this semester"; read the summary; enter remark; Archive semester.
  2. Check Timetable, Calendar, Subjects, Notes, Reminders; check GPA.
- **Expected result:** Toast "Semester archived"; semester disappears from Semesters list (archived link shows); items leave live views; reminder switched off; CGPA still counts.
- **Automation:** `pg_study_test` ("archive sets archived_at, clears active, keeps the remark", "its subjects are archived", "its reminders are switched off").

#### TC-STS-018 — Remark length
- **Requirement:** FR-STS-016, FR-STS-020
- **Type / Priority:** Boundary · P3
- **Preconditions:** Archive dialog; archive page.
- **Test data:** 1001 characters.
- **Steps:**
  1. Paste 1001 characters in the archive remark; edit remark on the archive page with 1001 characters.
- **Expected result:** The textarea stops at 1000; the archive-page remark is cut to 1000 on save; the database check allows up to 1000.
- **Automation:** Manual.

#### TC-STS-019 — Restore with and without another active semester
- **Requirement:** FR-STS-018
- **Type / Priority:** Functional · P1
- **Preconditions:** One archived semester; (a) no active semester; (b) another active.
- **Test data:** None.
- **Steps:**
  1. Study → Archive → open it → Restore; confirm.
  2. Repeat for case (b).
- **Expected result:** (a) toast "… is the active semester again"; (b) "… is back, inactive: another semester is active". Subjects un-archived, reminders switched on.
- **Automation:** `pg_study_test` ("restoring while another is active → inactive").

#### TC-STS-020 — Restore un-archives individually archived subjects
- **Requirement:** FR-STS-018, FR-STS-006
- **Type / Priority:** Data · P2
- **Preconditions:** Subject A archived by hand before the semester was archived; subject B active.
- **Test data:** None.
- **Steps:**
  1. Archive then restore the semester.
- **Expected result:** Both A and B become active again (A is un-archived too; Findings F-04).
- **Automation:** Manual.

#### TC-STS-021 — Study archive list and empty state
- **Requirement:** FR-STS-019
- **Type / Priority:** Functional · P1
- **Preconditions:** (a) Nothing archived; (b) one archived semester and one subject archived alone.
- **Test data:** None.
- **Steps:**
  1. Open Study archive in each case.
- **Expected result:** (a) "Nothing archived yet" with "Go to Semesters"; (b) a semester card (dates, "archived <date>", remark, GPA, counts, "n of m assignments done") and an "Archived subjects" card.
- **Automation:** `v41_test` ("study archive: ok" means the page text is non-empty).

#### TC-STS-022 — Open an archived semester
- **Requirement:** FR-STS-020
- **Type / Priority:** Functional · P2
- **Preconditions:** Archived semester with all kinds of items.
- **Test data:** None.
- **Steps:**
  1. Open it and visit each tab: Subjects, Timetable, Assignments, Notes, Groups, Other.
  2. Add a remark.
- **Expected result:** Tiles GPA, Subjects, Assignments done, Credit hours; Timetable lists breaks of that period; Other lists events, reminders (switched off), tasks, notes, documents; remark saved.
- **Automation:** Manual.

#### TC-STS-023 — Archive search
- **Requirement:** FR-STS-021
- **Type / Priority:** Functional · P2
- **Preconditions:** Archived semester containing subject "Physics", note "Quantum", remark "tough".
- **Test data:** "quantum", "tough", "zzz".
- **Steps:**
  1. Type each in "Search the archive…".
  2. Press a result.
- **Expected result:** Results grouped by semester; the result opens the right tab; "zzz" gives "Nothing in the archive matches “zzz”."
- **Automation:** Manual.

#### TC-STS-024 — Delete permanently, two steps
- **Requirement:** FR-STS-022
- **Type / Priority:** Data · P1
- **Preconditions:** Archived semester with subjects, classes, assignments, a note, a deck, a group project owned, an uploaded document tagged to it.
- **Test data:** Typed "delete", then "REMOVE".
- **Steps:**
  1. Open it; press "Delete permanently"; read the list; Continue.
  2. Type "REMOVE"; then repeat and type "delete".
- **Expected result:** Confirmation lists counts; "REMOVE" → "Nothing was deleted: you did not type DELETE."; "delete" deletes everything including decks, the project and the document file; toast "Deleted permanently"; CGPA no longer counts it.
- **Automation:** `pg_study_test` ("deleting an archived semester returns counts", "everything in it is gone"), `pg_study2_test` ("deleting an archived semester removes its decks, cards and attendance").

#### TC-STS-025 — Only archived semesters can be deleted permanently
- **Requirement:** FR-STS-022
- **Type / Priority:** Negative · P1
- **Preconditions:** Active semester.
- **Test data:** `delete_study_semester(<active id>)`.
- **Steps:**
  1. Call the function.
- **Expected result:** "Only an archived semester can be deleted"; nothing removed.
- **Automation:** `pg_study_test` ("an active (not archived) semester cannot be deleted").

#### TC-STS-026 — Delete archived subjects on their own
- **Requirement:** FR-STS-022
- **Type / Priority:** Data · P2
- **Preconditions:** A subject archived alone, with a note and an assignment.
- **Test data:** None.
- **Steps:**
  1. Archive → "Archived subjects" → Delete permanently → DELETE.
  2. Check Notes.
- **Expected result:** Subject and its assignments and classes are removed; the confirmation counted the note but the note remains without a subject (Findings F-03).
- **Automation:** Manual.

#### TC-STS-027 — Start from a previous semester
- **Requirement:** FR-STS-023
- **Type / Priority:** Functional · P1
- **Preconditions:** Active "Sem 2" empty; archived "Sem 1" with subject Databases (code CS201) with 2 classes, 1 open assignment due in the past and 1 due next week, scores and notes.
- **Test data:** Both options ticked.
- **Steps:**
  1. Sem 2 card → "Start from a previous semester"; choose Sem 1; read hint; tick both; Copy.
  2. Run it again.
- **Expected result:** Toast "Copied into Sem 2" with counts; subject and 2 classes (start = later of today and semester start, end = semester end); both assignments copied, the past due date dropped; no scores. Second run reuses the subject but duplicates the classes and assignments (Findings F-06).
- **Automation:** Manual.

#### TC-STS-028 — Copy dialog messages
- **Requirement:** FR-STS-023
- **Type / Priority:** Negative · P3
- **Preconditions:** (a) only one semester; (b) copy dialog open.
- **Test data:** Untick everything.
- **Steps:**
  1. Press the copy button in (a).
  2. In (b) untick both chips; press "Copy into this semester".
- **Expected result:** "You have no other semester to copy from yet."; "Pick what to copy."
- **Automation:** Manual.

#### TC-STS-029 — Default scale and letters
- **Requirement:** FR-STS-024, FR-STS-028
- **Type / Priority:** Boundary · P1
- **Preconditions:** Subjects with final marks 80, 79.9, 47, 46.9, 0 and no custom scale.
- **Test data:** As listed.
- **Steps:**
  1. Read the letters on the Subjects cards.
- **Expected result:** A, A-, C-, D+, F.
- **Automation:** Manual.

#### TC-STS-030 — Scale precedence
- **Requirement:** FR-STS-024
- **Type / Priority:** Functional · P2
- **Preconditions:** Account scale A≥90; semester scale A≥85; subject scale A≥70; mark 75 in each case.
- **Test data:** Mark 75 in subjects with (subject scale), (semester scale only), (account scale only), (none).
- **Steps:**
  1. Compare letters.
- **Expected result:** The letter always comes from the first scale available in the order subject, semester, account, standard: the subject case gives A (75 ≥ 70); the others follow their own rows; with none, the standard scale gives A- (75).
- **Automation:** Manual.

#### TC-STS-031 — Scale editor validation
- **Requirement:** FR-STS-025
- **Type / Priority:** Negative · P1
- **Preconditions:** Grade scale dialog (account).
- **Test data:** Empty "From %"; 101; empty letter; 13-character letter; GPA 11; two rows 60; no 0 row.
- **Steps:**
  1. Edit each and press Save scale.
- **Expected result:** Messages: "Every row needs a "From %" between 0 and 100." (empty, 101); "Every row needs a grade name (up to 12 characters, like A- or Distinction)."; "GPA points are numbers from 0 to 10."; "Two rows start at the same percentage."; "One row must start at 0 so every mark gets a grade."
- **Automation:** Manual.

#### TC-STS-032 — Scale row count 2 to 20
- **Requirement:** FR-STS-026
- **Type / Priority:** Boundary · P1
- **Preconditions:** Scale dialog for a semester.
- **Test data:** Reduce to 2 rows; add up to 20; try 21; database insert of 1 and 21 rows.
- **Steps:**
  1. Delete rows until 2 remain; delete once more.
  2. Add rows until 20; press add again.
  3. Update the semester `grade_scale` with 1 row and with 21 rows.
- **Expected result:** "Keep at least two rows."; add button does nothing at 20; the database refuses 1 and 21 rows (check constraint). An account scale of more than 20 rows is not checked by the database (Findings F-08).
- **Automation:** Manual.

#### TC-STS-033 — Save, reset and "Back to the scale above it"
- **Requirement:** FR-STS-027, FR-STS-024
- **Type / Priority:** Functional · P2
- **Preconditions:** Semester with its own scale.
- **Test data:** None.
- **Steps:**
  1. Choose the semester; press Reset.
  2. Choose "Everything"; press Reset; Save scale without changes.
- **Expected result:** Toast "Back to the scale above it" and the editor shows the inherited rows; account Reset only fills the editor; saving the standard rows keeps "Using the standard scale" toast.
- **Automation:** Manual.

#### TC-STS-034 — GPA and CGPA
- **Requirement:** FR-STS-028
- **Type / Priority:** Boundary · P1
- **Preconditions:** Semester 1: A (4.0) 4 credits, C (2.0) 2 credits, B (3.0) with no credits and a subject without mark.
- **Test data:** Marks 85, 52, 66.
- **Steps:**
  1. Read the semester GPA and CGPA tile; remove all credits and read again.
- **Expected result:** GPA = (4×4 + 2×2) ÷ 6 = 3.33 (the subject without credit hours is left out); with no credit hours at all the plain average of points of the three is 3.00; the subject without a mark is ignored; CGPA includes archived semesters.
- **Automation:** Manual.

#### TC-STS-035 — Target line
- **Requirement:** FR-STS-029, FR-STK-002
- **Type / Priority:** Boundary · P2
- **Preconditions:** Subject target 70 with assignments: A weight 40 score 30/50; B weight 60 unscored.
- **Test data:** Also targets 50 (default), 95, and a final mark entered.
- **Steps:**
  1. Read the subject card line for each target.
- **Expected result:** Earned 24 of 40 → need (70−24)/60 = 76.7% ("To reach 70% you need 76.7% on the remaining 60%", amber warning style above 85); target 95 → "out of reach"; target 50 → need 43.3; with a final mark or archived subject no line.
- **Automation:** Manual.

#### TC-STS-036 — Semester data integrity under the add-on
- **Requirement:** FR-STS-010, FR-STS-016, FR-STM-008
- **Type / Priority:** Security · P1
- **Preconditions:** Two users.
- **Test data:** User 2 calls `archive_study_semester(<user 1's semester>)`; user without add-on calls it on own.
- **Steps:**
  1. Call both.
- **Expected result:** "That semester is not available" for user 2; "The Study add-on is not active" for the other.
- **Automation:** `pg_study_test` covers add-on gating of insert and the protected flags; function-level cross-user calls Manual.

#### TC-STS-037 — Semesters at phone widths
- **Requirement:** NFR-STT-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Semesters with archived link; Grade scale dialog open.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Semesters, Grade scale, Archive dialog, and the Study archive page.
- **Expected result:** No horizontal scroll; scale rows usable; tiles in 2 columns up to 900 px.
- **Automation:** Device only.

## 4. Group projects (STG)

#### TC-STG-001 — Create a project and invite classmates
- **Requirement:** FR-STG-002, FR-STG-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user with contacts Aina and Ben (accepted).
- **Test data:** Name "Database design presentation", subject "Databases", due in 2 weeks; invite Aina and Ben.
- **Steps:**
  1. Groups → New project; fill; "Invite classmates" → tick both → Done; Create project.
- **Expected result:** Project opens; team lists you (crown) and the two as "invited"; Aina and Ben get "🤝 <You> invited you to a group project".
- **Automation:** `pg_study_test` ("project created", "invite a contact").

#### TC-STG-002 — Project name required and limits
- **Requirement:** FR-STG-002
- **Type / Priority:** Boundary · P2
- **Preconditions:** New project form.
- **Test data:** Empty name; 121 characters; subject 81 characters.
- **Steps:**
  1. Save each.
- **Expected result:** "Give the project a name."; fields stop at 120 / 80.
- **Automation:** Manual.

#### TC-STG-003 — Cannot invite a non-contact
- **Requirement:** FR-STG-004, FR-STG-007
- **Type / Priority:** Security · P1
- **Preconditions:** A user who is not a contact.
- **Test data:** Direct call `invite_to_study_project`.
- **Steps:**
  1. Call it with the stranger's id.
- **Expected result:** "You can only invite people in your contacts".
- **Automation:** `pg_study_test` ("cannot invite a non-contact").

#### TC-STG-004 — Only the owner invites; 12-member cap
- **Requirement:** FR-STG-004
- **Type / Priority:** Boundary · P2
- **Preconditions:** Project with 11 members (accepted or pending) and several more contacts.
- **Test data:** Invite 2 more.
- **Steps:**
  1. Invite two people; then as a member (not owner) call invite.
- **Expected result:** First invitee accepted (12th), the second fails "A group project can have up to 12 members"; member call fails "Only the project owner can invite people". Declined people do not count.
- **Automation:** Manual.

#### TC-STG-005 — Join and decline
- **Requirement:** FR-STG-001, FR-STG-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina and Ben have invitations.
- **Test data:** None.
- **Steps:**
  1. Aina opens Groups; presses Join.
  2. Ben presses Decline.
  3. Aina presses Join again on the same project via the API.
- **Expected result:** Aina: toast "You joined the project", the project opens; owner told "✅ Aina joined …"; Ben: owner told "❌ Ben declined …", project gone from his tab; repeat reply fails "No invitation found". Ben can be invited again.
- **Automation:** `pg_study_test` ("invited person sees the invitation (pending)").

#### TC-STG-006 — Pending member sees only basics
- **Requirement:** FR-STG-006
- **Type / Priority:** Security · P1
- **Preconditions:** Pending invitation with a task and notes in the project.
- **Test data:** None.
- **Steps:**
  1. As the invitee open the invitation and call `study_project_detail`.
- **Expected result:** Title, subject, due date and members only; tasks empty, notes empty; comments and files calls fail "Not allowed".
- **Automation:** `pg_study_test` ("pending member sees no tasks or notes yet").

#### TC-STG-007 — Non-member and tables closed
- **Requirement:** FR-STG-006, FR-STG-007
- **Type / Priority:** Security · P1
- **Preconditions:** A stranger.
- **Test data:** Direct select on `study_projects`, `study_project_members`, `study_project_tasks`; detail call.
- **Steps:**
  1. Query each as the stranger and as a member.
- **Expected result:** Direct table access is denied for everyone signed in; detail returns "Not allowed" to the stranger.
- **Automation:** `pg_study_test` ("a non-member cannot open the project").

#### TC-STG-008 — Owner-only fields
- **Requirement:** FR-STG-008
- **Type / Priority:** Security · P1
- **Preconditions:** Accepted member (not owner).
- **Test data:** Update with `title`; update with `notes`.
- **Steps:**
  1. As the member open the project: look at name, subject, due date, and notes.
  2. Edit notes; Save changes. Call update with title.
- **Expected result:** Name, subject and due are read-only; notes editable and saved ("Project saved"); the title call fails "Only the owner can change the title, subject and due date". Save button reads "All changes saved" when untouched.
- **Automation:** Manual.

#### TC-STG-009 — Tasks: add, assign, tick
- **Requirement:** FR-STG-009, FR-STG-010
- **Type / Priority:** Functional · P1
- **Preconditions:** Project with Aina accepted.
- **Test data:** Task "Draw ER diagram", assignee Aina, due next Monday.
- **Steps:**
  1. Press + with empty title; then enter the task and press Enter.
  2. As Aina tick it; change assignee to "Anyone"; clear the due date.
- **Expected result:** First: "Type what the task is first, then press +."; Aina notified "📌 <Name> gave you a task"; tick updates the progress bar on the card ("1 of 1 tasks done · 100%").
- **Automation:** `pg_study_test` ("task assigned to a member").

#### TC-STG-010 — Cannot assign to a non-member
- **Requirement:** FR-STG-009
- **Type / Priority:** Negative · P1
- **Preconditions:** A contact not on the project.
- **Test data:** Direct call.
- **Steps:**
  1. `add_study_project_task` with that assignee.
- **Expected result:** "That person is not on this project".
- **Automation:** `pg_study_test` ("cannot assign to someone not on the project").

#### TC-STG-011 — Task limits and delete rights
- **Requirement:** FR-STG-009, FR-STG-010
- **Type / Priority:** Boundary · P2
- **Preconditions:** Project with 200 tasks; a task made by member M.
- **Test data:** 201st task; delete by another member.
- **Steps:**
  1. Add the 201st task.
  2. As member N delete M's task; as M delete it; as owner delete another's.
- **Expected result:** "A project can have up to 200 tasks"; N: "Only the person who added a task, or the organiser, can delete it" (the button is shown to all); M and owner succeed.
- **Automation:** Manual.

#### TC-STG-012 — Comments and the 10-minute notice rule
- **Requirement:** FR-STG-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Owner and Aina in a project.
- **Test data:** Two comments within a minute; empty comment; 1001 characters.
- **Steps:**
  1. Aina presses send empty.
  2. Aina posts two comments quickly.
  3. Owner deletes one; Aina deletes her other; Ben (member) tries to delete Aina's via API.
- **Expected result:** "Write your comment first, then press send."; toast "Comment sent"; owner gets one notification "💬 Aina commented on …" only; deletes by author or owner work; Ben gets "Not allowed"; textarea stops at 1000.
- **Automation:** `pg_study_test` ("comment visible to the team").

#### TC-STG-013 — Comment limit and display
- **Requirement:** FR-STG-011
- **Type / Priority:** Boundary · P3
- **Preconditions:** Project with 500 comments.
- **Test data:** 501st comment.
- **Steps:**
  1. Post; open the thread.
- **Expected result:** "This discussion is full (500 comments)"; only the newest 200 are listed.
- **Automation:** Manual.

#### TC-STG-014 — Attach and detach files
- **Requirement:** FR-STG-012, FR-STG-013
- **Type / Priority:** Security · P1
- **Preconditions:** Owner and Aina (accepted); owner has an uploaded document.
- **Test data:** A 1 MB PDF; another user's document id.
- **Steps:**
  1. Owner attaches the file; Aina opens it from the project; attach someone else's document via API.
  2. Owner removes the file.
- **Expected result:** Aina can open it; "You can only attach your own documents" for the other id; after removal Aina can no longer open it and the file stays in the owner's Documents.
- **Automation:** `pg_study_test` ("attaching a file shares it with the team", "a teammate lists the project files", "detaching removes the sharing again").

#### TC-STG-015 — File sharing ends on leave and delete
- **Requirement:** FR-STG-013, FR-STG-015, FR-STG-016
- **Type / Priority:** Data · P1
- **Preconditions:** Project with a file; Aina and Ben members; the same document also attached to a second project that Ben is in.
- **Test data:** None.
- **Steps:**
  1. Aina leaves; check her access to the document.
  2. Delete the first project; check Ben's access.
- **Expected result:** Aina loses access; Ben keeps access because the second project still has the document.
- **Automation:** `pg_study_test` ("leaving the project removes the sharing", "deleting the project cleans the file sharing"); the two-project case Manual.

#### TC-STG-016 — File limit
- **Requirement:** FR-STG-012
- **Type / Priority:** Boundary · P3
- **Preconditions:** Project with 30 files.
- **Test data:** 31st.
- **Steps:**
  1. Attach another.
- **Expected result:** "Could not attach the file: A project can have up to 30 files".
- **Automation:** Manual.

#### TC-STG-017 — Nudge with 6-hour rule
- **Requirement:** FR-STG-014
- **Type / Priority:** Functional · P1
- **Preconditions:** Owner and Aina accepted; a task assigned to Aina.
- **Test data:** None.
- **Steps:**
  1. Press the hand beside Aina; press again.
  2. Nudge Ben on a different project; try nudging yourself and a non-member via API.
- **Expected result:** First: toast "Nudge sent" and Aina gets "👋 <Owner> nudged you"; second: "Already nudged recently — you can nudge the same person again after a few hours"; self / non-member: "Not allowed".
- **Automation:** `pg_study_test` ("nudge sent", "second nudge within 6 hours refused").

#### TC-STG-018 — Leave and remove
- **Requirement:** FR-STG-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina has a task.
- **Test data:** None.
- **Steps:**
  1. Aina presses Leave project; confirm.
  2. Re-invite and accept; owner removes Aina with the cross; confirm.
  3. Owner calls `leave_study_project` on themselves.
- **Expected result:** Aina's tasks become "Anyone" both times; owner not asked; owner's own leave fails "The owner cannot leave; delete the project instead" (no Leave button for owner).
- **Automation:** `pg_study_test` ("leaving the project removes the sharing") for the sharing part.

#### TC-STG-019 — Delete a project
- **Requirement:** FR-STG-016
- **Type / Priority:** Data · P1
- **Preconditions:** Project with members, tasks, comments.
- **Test data:** None.
- **Steps:**
  1. Member tries delete via API; owner presses Delete project; confirm.
- **Expected result:** Member: "Only the owner can delete the project"; owner: gone for everyone with tasks, comments, files.
- **Automation:** `pg_study_test` ("deleting the project cleans the file sharing").

#### TC-STG-020 — Group task reminders
- **Requirement:** FR-STG-017
- **Type / Priority:** Integration · P2
- **Preconditions:** Task assigned to Aina due in 3 days, one overdue by 2 days, one done, one unassigned; Aina's hour = now; Aina without add-on.
- **Test data:** None.
- **Steps:**
  1. Run `run_group_task_reminders()`.
  2. Switch Aina's Study reminder off and run again.
- **Expected result:** "🤝 … is due in 3 days" and "⚠️ … is overdue by 2 days" with body "Group project · <title>"; nothing for done or unassigned; nothing after switching off.
- **Automation:** `pg_study_test` ("group task reminder job runs with data" — only that it runs).

#### TC-STG-021 — Guest without the add-on
- **Requirement:** FR-STG-018, FR-STM-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Aina has no Study add-on and was invited to the owner's project.
- **Test data:** None.
- **Steps:**
  1. Aina presses the Study mode button; look at tabs and add button.
  2. Open Study archive from the menu.
  3. Compare with a user who only owns a project of their own.
- **Expected result:** Study opens with only "Groups", button "New project"; archive opens the add-on popup; the owner-only user stays locked (popup "Study mode").
- **Automation:** Manual.

#### TC-STG-022 — Project without the add-on: 3-project cap
- **Requirement:** FR-STG-003, FR-STG-021
- **Type / Priority:** Boundary · P1
- **Preconditions:** User without add-on; one with add-on; no active semester for the first.
- **Test data:** Create 4 projects.
- **Steps:**
  1. Create 3 projects via the API (the UI is reachable only as a guest); create a 4th.
  2. As the add-on user with 20 projects create the 21st.
- **Expected result:** First succeeds without a semester; 4th fails "Without the Study add-on you can own up to 3 group projects"; 21st fails "You can own up to 20 group projects".
- **Automation:** `pg_study_test` ("a person without the add-on can start a project") — caps not asserted.

#### TC-STG-023 — Add-on user with no active semester
- **Requirement:** FR-STG-021, FR-STS-011
- **Type / Priority:** Negative · P2
- **Preconditions:** Study user, no active semester.
- **Test data:** None.
- **Steps:**
  1. Groups → New project.
- **Expected result:** Popup "No active semester".
- **Automation:** Manual.

#### TC-STG-024 — Projects and archived semester
- **Requirement:** FR-STG-019, FR-STG-020
- **Type / Priority:** Data · P2
- **Preconditions:** Owner's project made in a semester that gets archived; Aina member.
- **Test data:** None.
- **Steps:**
  1. Archive the semester; check Groups tab for owner and Aina; archive page → Groups.
  2. Delete the semester permanently.
- **Expected result:** Owner's tab hides it; the archive Groups tab lists it (members count, tasks done); Aina still sees it; permanent delete removes it for all.
- **Automation:** Manual.

#### TC-STG-025 — Notifications open the project
- **Requirement:** FR-STG-022
- **Type / Priority:** Integration · P3
- **Preconditions:** Invitation, reply, and task-assigned notifications.
- **Test data:** None.
- **Steps:**
  1. Tap each in Notifications.
- **Expected result:** Study opens on Groups and highlights that project.
- **Automation:** `pg_refs_test` ("a project invitation carries the project id", "the reply carries it", "a new project task carries the project id") for the stored reference.

#### TC-STG-026 — Groups at phone widths
- **Requirement:** NFR-STT-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Project with 6 members and tasks.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Groups, the project popup, New project, and the contact picker.
- **Expected result:** Task rows wrap (640 px or less); no horizontal scroll; Join / Decline buttons reachable.
- **Automation:** Device only.

## 5. Study notes (STN)

#### TC-STN-001 — Create a note
- **Requirement:** FR-STN-001, FR-STN-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user, active semester.
- **Test data:** Title "Chapter 3 summary", subject Databases, body "# Keys\n- primary\n- foreign".
- **Steps:**
  1. Notes → New note; fill; Save note.
- **Expected result:** Card with title, snippet "Keys primary foreign", subject chip, "Updated <today>"; the note belongs to the active semester.
- **Automation:** `pg_study_test` ("note gets the active semester").

#### TC-STN-002 — Title required, size limits
- **Requirement:** FR-STN-002
- **Type / Priority:** Boundary · P2
- **Preconditions:** New note form.
- **Test data:** Empty title; 121-character title; body 20001 characters.
- **Steps:**
  1. Save with an empty title; paste long texts.
- **Expected result:** "Give the note a title."; inputs stop at 120 and 20000; database refuses longer text.
- **Automation:** Manual.

#### TC-STN-003 — Empty notes states
- **Requirement:** FR-STN-001
- **Type / Priority:** Usability · P3
- **Preconditions:** No notes; then notes in other subjects only.
- **Test data:** None.
- **Steps:**
  1. Open Notes; press a subject chip with no notes.
- **Expected result:** "Keep your study notes here"; then "No notes for this subject".
- **Automation:** Manual.

#### TC-STN-004 — Formatting and preview
- **Requirement:** FR-STN-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Note editor.
- **Test data:** `**bold** *it* \`code\` - [ ] todo [x](javascript:alert(1)) [ok](https://example.com) <b>raw</b>`
- **Steps:**
  1. Type the text; press Preview; press formatting buttons with selected text.
- **Expected result:** Bold, italic, code, a checklist; `javascript:` link is not made a link; `<b>raw</b>` is shown as text; https link opens in a new tab.
- **Automation:** Manual.

#### TC-STN-005 — Share read-only with a contact
- **Requirement:** FR-STN-004, FR-STN-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Note saved; Aina is a contact.
- **Test data:** Permission "Can read".
- **Steps:**
  1. Open the note → Share with → tick Aina → Done; Save note.
  2. As Aina open Notes → Shared with me; open the note.
- **Expected result:** Aina gets "📝 <Name> shared a note with you"; the viewer says "… · read only" and has a Remove button.
- **Automation:** `pg_study_test` ("a reader cannot edit", "shared notes list shows can_edit").

#### TC-STN-006 — Share with edit rights and edit
- **Requirement:** FR-STN-004, FR-STN-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Note shared with Aina.
- **Test data:** Permission "Can edit".
- **Steps:**
  1. Switch Aina's chip label from "read" to "edit".
  2. As Aina open the note; change title and text; Save changes.
  3. As the owner reopen.
- **Expected result:** Aina sees "Editing a shared note", the notice "From <name>. You can edit it, and so can they. The latest save wins.", no subject / sharing / delete; toast "Changes saved"; owner sees the new text.
- **Automation:** `pg_study_test` ("an editor can change the note").

#### TC-STN-007 — A reader cannot change a note
- **Requirement:** FR-STN-007, FR-STN-008
- **Type / Priority:** Security · P1
- **Preconditions:** Aina has read-only access.
- **Test data:** `update_shared_study_note` and direct updates / deletes of the table.
- **Steps:**
  1. Call the function as Aina; try `update`/`delete` on `study_notes` and `study_note_shares`.
- **Expected result:** Function: "You can only read this note"; direct updates change 0 rows; share table not accessible.
- **Automation:** `pg_study_test` ("a reader cannot edit", "the table itself stays private to the owner").

#### TC-STN-008 — Stranger cannot read the note
- **Requirement:** FR-STN-008
- **Type / Priority:** Security · P1
- **Preconditions:** Ben not on the share list.
- **Test data:** Note id.
- **Steps:**
  1. As Ben select the note, call `note_files`, `shared_study_notes`.
- **Expected result:** No rows; `note_files` "Not allowed".
- **Automation:** `pg_study_test` ("the table itself stays private to the owner").

#### TC-STN-009 — Share only with contacts, 30 people
- **Requirement:** FR-STN-004
- **Type / Priority:** Boundary · P2
- **Preconditions:** Note; a non-contact; 30 contacts.
- **Test data:** Share to non-contact; share to the 31st.
- **Steps:**
  1. Call `share_study_note` with the stranger; then add contacts up to 31.
- **Expected result:** "You can only share with people in your contacts"; 31st: "A note can be shared with up to 30 people".
- **Automation:** Manual.

#### TC-STN-010 — Change permission and stop sharing
- **Requirement:** FR-STN-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Note shared with Aina (edit).
- **Test data:** None.
- **Steps:**
  1. Tap "edit" to make it "read"; then tap the cross; Save note.
  2. As Aina open Shared with me.
  3. As Aina call `set_study_note_edit`.
- **Expected result:** Change is immediate; after Save note the note is gone from Aina's list; Aina's call: "Not allowed".
- **Automation:** Manual.

#### TC-STN-011 — Reader removes a shared note from her list
- **Requirement:** FR-STN-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Aina has a read-only shared note.
- **Test data:** None.
- **Steps:**
  1. Open → Remove; read confirm; confirm.
- **Expected result:** Note gone for Aina, still with owner; the file sharing for her ends.
- **Automation:** Manual.

#### TC-STN-012 — Attach files to a note
- **Requirement:** FR-STN-009, FR-STN-010
- **Type / Priority:** Security · P1
- **Preconditions:** Saved note shared with Aina; uploaded document.
- **Test data:** 11th file; another user's document.
- **Steps:**
  1. Attach a file; Aina opens it from the viewer.
  2. Detach it; Aina tries again.
  3. Attach another user's document; attach an 11th file; Aina calls `attach_note_file`.
- **Expected result:** Aina can open then cannot; "You can only attach your own documents"; "A note can have up to 10 files"; Aina: "Only the note owner can attach files". A new note shows the hint until saved.
- **Automation:** `pg_study_test` ("a file on a shared note is shared with the readers", "stopping sharing removes the file access").

#### TC-STN-013 — Delete a note
- **Requirement:** FR-STN-011, FR-STN-010
- **Type / Priority:** Data · P1
- **Preconditions:** Shared note with a file.
- **Test data:** None.
- **Steps:**
  1. Delete the note and confirm.
- **Expected result:** Gone for owner and Aina; Aina can no longer open the file.
- **Automation:** Manual.

#### TC-STN-014 — Search finds notes
- **Requirement:** FR-STN-012
- **Type / Priority:** Functional · P3
- **Preconditions:** Note "Quantum".
- **Test data:** "quant".
- **Steps:**
  1. Use the top search in Study mode; then in Personal mode with and without "Show Study in Personal".
- **Expected result:** Found as "Study note" in Study mode and with the preference on; not found in Personal with it off.
- **Automation:** Manual.

#### TC-STN-015 — Missing migration messages
- **Requirement:** FR-STN-013
- **Type / Priority:** Negative · P3
- **Preconditions:** Test database without migration 059.
- **Test data:** Share a note.
- **Steps:**
  1. Save a note with a share.
- **Expected result:** "The note was saved, but sharing did not fully work: Run supabase/migrations/059_study_notes_extras.sql to share notes."
- **Automation:** Manual.

#### TC-STN-016 — Shared note after the owner's add-on ends
- **Requirement:** FR-STN-014, FR-STM-009
- **Type / Priority:** Integration · P3
- **Preconditions:** Aina has edit rights; owner's add-on ends.
- **Test data:** None.
- **Steps:**
  1. As Aina edit the note; as owner try to edit it.
- **Expected result:** Aina's save works; owner's is refused (row level security). Policy is TBC with the product owner.
- **Automation:** Manual.

#### TC-STN-017 — Notes at phone widths
- **Requirement:** NFR-STT-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Long note, 3 shares.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Notes, the editor, the share picker, the viewer.
- **Expected result:** Toolbar and chips wrap; no horizontal scroll.
- **Automation:** Device only.

## 6. Flashcards (STC)

#### TC-STC-001 — Create a deck with cards
- **Requirement:** FR-STC-002, FR-STC-003, FR-STC-004, FR-STC-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user, active semester.
- **Test data:** Deck "Databases: key terms"; card "PK" / "Primary key".
- **Steps:**
  1. Cards → New deck; enter name and subject; type front and back; press Enter; Save deck.
- **Expected result:** Toast "Deck saved"; deck card shows "1 card", "1 due".
- **Automation:** `pg_study2_test` ("a deck goes into the active semester", "a new card is due today with a starting ease").

#### TC-STC-002 — Deck and card validation
- **Requirement:** FR-STC-002, FR-STC-003
- **Type / Priority:** Negative · P1
- **Preconditions:** Deck editor.
- **Test data:** Empty deck name; card with only front; blank card saved by API; front of 501 chars.
- **Steps:**
  1. Press Save deck with no name; press add with one side empty.
  2. Insert a card with blank back directly.
- **Expected result:** "Give the deck a name."; "Write both sides of the card."; the database refuses the blank card; inputs stop at 500 / 1000.
- **Automation:** `pg_study2_test` ("empty card refused") for the database check.

#### TC-STC-003 — Paste many cards
- **Requirement:** FR-STC-004
- **Type / Priority:** Functional · P2
- **Preconditions:** Deck editor.
- **Test data:** `a | b`, a tab line `c<TAB>d`, `no separator`.
- **Steps:**
  1. Paste the three lines; press the paste button.
- **Expected result:** 2 added; message "2 added. 1 line skipped (write each as: front | back)."
- **Automation:** Manual.

#### TC-STC-004 — 500 cards per deck
- **Requirement:** FR-STC-003, FR-STC-013
- **Type / Priority:** Boundary · P1
- **Preconditions:** Deck with 499 cards.
- **Test data:** Add the 500th and 501st.
- **Steps:**
  1. Add in the editor; separately insert via the database.
- **Expected result:** 500th accepted; 501st: editor "A deck can have up to 500 cards"; database "A deck can have up to 500 cards".
- **Automation:** `pg_study2_test` ("a deck holds at most 500 cards").

#### TC-STC-005 — Edit and remove cards, delete deck
- **Requirement:** FR-STC-004, FR-STC-005
- **Type / Priority:** Functional · P2
- **Preconditions:** Deck with 3 cards.
- **Test data:** None.
- **Steps:**
  1. Edit one, remove one, Save deck.
  2. Open again; Delete; confirm.
- **Expected result:** 2 cards remain with the edit; delete confirmation "The deck and all its cards are removed."; deck and cards gone.
- **Automation:** Manual.

#### TC-STC-006 — Review due cards
- **Requirement:** FR-STC-007, FR-STC-008, FR-STC-010
- **Type / Priority:** Functional · P1
- **Preconditions:** Deck with 3 due cards.
- **Test data:** Rate Again, Good, Easy.
- **Steps:**
  1. Press "Review 3"; tap card; read the interval labels; rate each.
  2. Use keyboard 1–4 and Space.
- **Expected result:** Cards show "Question" then "Answer"; ratings show next intervals; the Again card returns after three others; end screen "All done for now!" "… reviewed · 1 you will see again soon".
- **Automation:** Manual.

#### TC-STC-007 — Scheduling formulas
- **Requirement:** FR-STC-009
- **Type / Priority:** Boundary · P1
- **Preconditions:** New card (ease 2.5, interval 0, reps 0).
- **Test data:** Sequence Good, Good, Good; then Easy from new; Hard from new; Again after 3 reps.
- **Steps:**
  1. Rate and read intervals in the database after each.
- **Expected result:** Good: 1 day, 3 days, then round(3×2.5)=8 days; Easy from new: 3 days, ease 2.65; Hard from new: interval 1, ease 2.35; Again: interval 0, reps 0, lapses 1, ease −0.2 (never below 1.3), due today.
- **Automation:** Manual.

#### TC-STC-008 — Practise mode when nothing is due
- **Requirement:** FR-STC-007
- **Type / Priority:** Functional · P2
- **Preconditions:** Deck of 20 cards all due later.
- **Test data:** None.
- **Steps:**
  1. Press "Practise"; finish; check the cards' due dates.
- **Expected result:** Title "Practise (nothing is due)", 15 random cards, end "Nice practice!", due dates unchanged. A deck with no cards: button disabled "No cards yet".
- **Automation:** `pg_study2_test` ("a card scheduled later is not due") for the due rule only.

#### TC-STC-009 — Review limit of 30 and "Review all due"
- **Requirement:** FR-STC-001, FR-STC-007
- **Type / Priority:** Boundary · P2
- **Preconditions:** Two decks with 25 due cards each.
- **Test data:** None.
- **Steps:**
  1. Read the top bar; press "Review all due".
- **Expected result:** "50 cards to review today"; session has 30 cards, oldest due first.
- **Automation:** Manual.

#### TC-STC-010 — Deck statistics
- **Requirement:** FR-STC-012, FR-STC-001
- **Type / Priority:** Data · P2
- **Preconditions:** Deck with 3 cards, 1 due.
- **Test data:** None.
- **Steps:**
  1. Call `my_deck_stats(today)` as owner and as another user.
- **Expected result:** total 3, due 1 for the owner; no rows for the other user.
- **Automation:** `pg_study2_test` ("deck statistics count cards and due cards").

#### TC-STC-011 — Flashcards need the add-on and are private
- **Requirement:** FR-STC-013
- **Type / Priority:** Security · P1
- **Preconditions:** User without add-on; two users.
- **Test data:** Insert deck; insert card into another's deck.
- **Steps:**
  1. Try both.
- **Expected result:** Row-level-security error; "That deck is not yours".
- **Automation:** `pg_study2_test` ("without the add-on nothing can be added").

#### TC-STC-012 — Decks of an archived semester
- **Requirement:** FR-STC-001, FR-STS-017
- **Type / Priority:** Data · P2
- **Preconditions:** Deck in the active semester.
- **Test data:** None.
- **Steps:**
  1. Archive the semester; open Cards; restore; delete permanently an archived one.
- **Expected result:** Deck hidden while archived, back after restore, deleted with the semester.
- **Automation:** `pg_study2_test` ("deleting an archived semester removes its decks, cards and attendance") for the deletion.

#### TC-STC-013 — Failed review save is silent
- **Requirement:** FR-STC-011
- **Type / Priority:** Negative · P3
- **Preconditions:** Review session; go offline.
- **Test data:** None.
- **Steps:**
  1. Rate a card offline; reload; check due date.
- **Expected result:** No message shown; the card is still due (rating lost; Findings F-10).
- **Automation:** Manual.

#### TC-STC-014 — Cards at phone widths
- **Requirement:** NFR-STT-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Deck with long text.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Cards, the editor, a review session.
- **Expected result:** Card editor rows stack (560 px or less); rating buttons visible; no horizontal scroll.
- **Automation:** Device only.

#### TC-STC-015 — Missing flashcard tables
- **Requirement:** FR-STC-014
- **Type / Priority:** Negative · P3
- **Preconditions:** Test database without migration 067.
- **Test data:** None.
- **Steps:**
  1. Open Cards; try to save a deck.
- **Expected result:** "Could not load your flashcards: … Has supabase/migrations/067_study_attendance_cards.sql been run in the Supabase SQL Editor?"; saving: "Flashcards need one more database step: run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor."
- **Automation:** Manual.

## 7. Grades and extras (STK)

#### TC-STK-001 — Weighted grade so far
- **Requirement:** FR-STK-001, FR-STK-004
- **Type / Priority:** Boundary · P1
- **Preconditions:** Subject with A 40% 30/50, B 60% 45/50, C no weight 10/10.
- **Test data:** None.
- **Steps:**
  1. Read "Grade so far" on the subject card and Overview → Grades.
- **Expected result:** (0.6×40 + 0.9×60) ÷ 100 = 78% (C ignored because weighted items exist); letter from the scale.
- **Automation:** Manual.

#### TC-STK-002 — Unweighted average and no scores
- **Requirement:** FR-STK-001
- **Type / Priority:** Boundary · P2
- **Preconditions:** Subject X with scores 8/10 and 30/50 and no weights; subject Y with none.
- **Test data:** None.
- **Steps:**
  1. Read cards.
- **Expected result:** X 70% (average of 80 and 60); Y shows "—".
- **Automation:** Manual.

#### TC-STK-003 — Weights not adding to 100
- **Requirement:** FR-STK-002
- **Type / Priority:** Boundary · P2
- **Preconditions:** Weighted items totalling 130%, then 60%.
- **Test data:** Target 50.
- **Steps:**
  1. Read the target line for each.
- **Expected result:** With ≥100% all scored: "All marked: x% overall" (even if an unscored item remains) — no warning about the total (Findings F-01); with 60% the rest counts as "remaining" weight.
- **Automation:** Manual.

#### TC-STK-004 — What if? calculator
- **Requirement:** FR-STK-003
- **Type / Priority:** Functional · P2
- **Preconditions:** Subject with scored A 40% 30/50, unscored exam 40%; target 70.
- **Test data:** Exam input 90, then 20, then "abc", then 150; subject with no weights.
- **Steps:**
  1. Subjects → What if?; change the inputs.
- **Expected result:** Inputs are seeded with 60 (the rounded grade so far) and the 20% not yet assigned is "Everything else": projection 60%; exam 90 gives 24 + 36 + 12 = 72%; exam 20 gives 44%; shows letter and points; "That reaches your 70% target." (72%) or "26 points short of your 70% target." (44%); "abc" counts as 0 and 150 as 100; semester GPA shown; nothing saved. No weights: the explanation text only.
- **Automation:** Manual.

#### TC-STK-005 — Attendance goal
- **Requirement:** FR-STK-005
- **Type / Priority:** Boundary · P1
- **Preconditions:** Attendance popup.
- **Test data:** 0, 100, 101, -1, "abc", 79.6.
- **Steps:**
  1. Enter each and press save goal.
- **Expected result:** 0 and 100 saved ("Goal saved"); 101, -1, abc show "Enter a goal between 0 and 100."; 79.6 is rounded to 80; default is 80; database refuses 101.
- **Automation:** `pg_study2_test` ("a subject has an attendance goal of 80 by default", "goal must be 0-100").

#### TC-STK-006 — Attendance % and "can miss"
- **Requirement:** FR-STK-006, FR-STK-007
- **Type / Priority:** Boundary · P1
- **Preconditions:** Subject with 20 sessions in total (10 past), goal 80; marks: 6 present, 1 late, 1 absent, 1 excused, 1 unmarked.
- **Test data:** None.
- **Steps:**
  1. Read the subject card and popup.
- **Expected result:** % = 7 ÷ 8 = 87.5%; can miss = floor((20−1) × 0.2) − 1 = 2; "7 of 8 classes · goal 80% · can miss 2 more"; not below goal. Change goal to 90 → below goal message "You are below your goal."
- **Automation:** Manual.

#### TC-STK-007 — Attendance block hidden for archived subject / no classes
- **Requirement:** FR-STK-007
- **Type / Priority:** Functional · P3
- **Preconditions:** Subject without classes; an archived subject.
- **Test data:** None.
- **Steps:**
  1. Open Subjects.
- **Expected result:** Subject without classes: only "What if?" button; archived: no attendance block.
- **Automation:** Manual.

#### TC-STK-008 — Focus session tagged with the current class
- **Requirement:** FR-STK-008, FR-STK-009
- **Type / Priority:** Integration · P1
- **Preconditions:** Study mode; a class "Databases" on now; another time no class.
- **Test data:** 25-minute focus session.
- **Steps:**
  1. Finish a Focus session during the class; finish one when no class is on; finish one in Personal mode.
  2. Open Overview.
- **Expected result:** First tagged Databases; second "No subject"; third untagged (not counted under a subject); "Studied this week" and the bars show minutes; the subject card "This week" shows the first.
- **Automation:** Manual.

#### TC-STK-009 — Overview tiles and cards
- **Requirement:** FR-STK-010, FR-STK-011, FR-STK-012, FR-STK-013
- **Type / Priority:** Functional · P1
- **Preconditions:** Open items: 2 overdue, exam in 2 days, quiz in 3 days, one more in 5 days, test in 9 days, 2 more in 10 days; 3 classes today (one now, one next, one done).
- **Test data:** None.
- **Steps:**
  1. Open Overview.
- **Expected result:** Tiles: Due this week 3 (today to +7 days: exam, quiz, the 5-day item), Overdue 2, Classes today 3; "Today's classes" badges Now / Next / Done; Due soon lists overdue first, maximum 8; Exam countdown lists the exam (highlighted, 2 days) and the test, not the quiz.
- **Automation:** `v41_test` (Overview tab non-empty) · otherwise manual.

#### TC-STK-010 — Overview empty states
- **Requirement:** FR-STK-009, FR-STK-011, FR-STK-012, FR-STK-014
- **Type / Priority:** Usability · P3
- **Preconditions:** (a) brand-new Study user; (b) semester but nothing else.
- **Test data:** None.
- **Steps:**
  1. Open Overview.
- **Expected result:** (a) "Set up your semester" with "Add your first subject" (shown when there is no subject, assignment or semester); (b) "No classes today. Enjoy!", "Nothing is due. …", "Start Focus Mode and pick a subject. …", "No tests or exams coming up. …".
- **Automation:** Manual.

#### TC-STK-011 — Calendar items
- **Requirement:** FR-STK-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Classes and open and done assignments; filters.
- **Test data:** Personal mode with the preference off, then on.
- **Steps:**
  1. Open Calendar in Study mode; hide "Classes"; hide "Study".
  2. Switch to Personal mode and look; turn on "Show Study in Personal".
  3. Click a class and an assignment.
- **Expected result:** Study mode: classes (green, time) and "<Type> due" (purple), done ones absent; chips hide them; Personal with the preference off: none; on: shown; clicking opens the class / assignment form.
- **Automation:** Manual.

#### TC-STK-012 — Global search
- **Requirement:** FR-STK-016
- **Type / Priority:** Functional · P3
- **Preconditions:** Subject "Physics", assignment "Lab report", project "Robot".
- **Test data:** "phys", "lab", "robot".
- **Steps:**
  1. Search in Study mode; click each result.
- **Expected result:** Subject, assignment, group project found with their sub-lines; each opens its form. Without the add-on no Study results.
- **Automation:** Manual.

#### TC-STK-013 — Export my data
- **Requirement:** FR-STK-017, FR-STM-009
- **Type / Priority:** Data · P2
- **Preconditions:** Study user with data; same user after the add-on ended.
- **Test data:** None.
- **Steps:**
  1. Settings → Export my data (both states); inspect the file.
- **Expected result:** With add-on: "study" object with all lists and the grade scale (or "standard"). After expiry: no "study" section though the data exists (Findings F-07).
- **Automation:** Manual.

#### TC-STK-014 — Study screens render
- **Requirement:** FR-STK-010
- **Type / Priority:** Functional · P2
- **Preconditions:** jsdom stub data.
- **Test data:** Stub data of `v41_test`.
- **Steps:**
  1. Run `ui/v41_test.js`; read "study tabs" and "study archive".
- **Expected result:** All eight tabs `ok` with no script error; "study archive: ok".
- **Automation:** `v41_test` (smoke only; it does not check the contents).

#### TC-STK-015 — Overview and grade bars at phone widths
- **Requirement:** NFR-STT-001, FR-STK-010
- **Type / Priority:** Responsive · P2
- **Preconditions:** Study user with data.
- **Test data:** 320, 360, 390, 1180 px.
- **Steps:**
  1. Open Overview, Subjects (with attendance blocks), What if?, Attendance popup.
- **Expected result:** Tiles 2 per row up to 900 px; no horizontal scroll; tab bar shows icons only at 900 px or less and only the open tab's name from 901 to 1360 px.
- **Automation:** Device only.

## 8. Plan and add-on rules (STM)

#### TC-STM-001 — Locked Study mode shows the add-on popup
- **Requirement:** FR-STM-001, FR-STM-002
- **Type / Priority:** Functional · P1
- **Preconditions:** Account without Study (and without Work).
- **Test data:** None.
- **Steps:**
  1. Press Study in the mode switch; read the popup; press "Get Study · RM7 / month" and "Get both".
- **Expected result:** Popup "Study mode" with price RM7 / month, 5 perks and the plan note; the buttons open WhatsApp with name, email, plan, add-on and price; bundle button shows "Work + Study · RM19 / month" and "Save RM3 a month" and is hidden when the person has either add-on. Without a configured number: "The WhatsApp number for requests isn't set up yet. Please email aeinscape@gmail.com to add this."
- **Automation:** Manual.

#### TC-STM-002 — Start the 7-day free trial
- **Requirement:** FR-STM-003, FR-STM-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Staging; never used the Study trial.
- **Test data:** None.
- **Steps:**
  1. Open the popup; press "Start 7-day free trial".
  2. Read the Study header and Settings → Your plan and add-ons.
  3. Look at Notifications.
- **Expected result:** Study opens; toast "Study trial started · Free for 7 days"; header "· free trial until <date> (7 days left)"; notification "🎉 Your Study trial has started".
- **Automation:** Manual (`pg_study_test` switches Study on through the admin function only).

#### TC-STM-003 — Trial is one-time
- **Requirement:** FR-STM-003
- **Type / Priority:** Negative · P1
- **Preconditions:** Trial already used and ended.
- **Test data:** `start_addon_trial('study')` called directly.
- **Steps:**
  1. Open the popup; call the function; call it while Study is active.
- **Expected result:** No trial button; "The free trial was already used"; while active "You already have this add-on".
- **Automation:** Manual.

#### TC-STM-004 — Trial button hidden on production
- **Requirement:** FR-STM-003
- **Type / Priority:** Security · P2
- **Preconditions:** Production build (`LUMA_ENV = production`).
- **Test data:** Direct RPC call `start_addon_trial('study')`.
- **Steps:**
  1. Open the popup; then call the function.
- **Expected result:** No trial button. The function itself still works (the check is only in the page; Findings F-11).
- **Automation:** Manual.

#### TC-STM-005 — Admin gives Study for a period
- **Requirement:** FR-STM-004, FR-STM-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Admin and a normal user.
- **Test data:** 1 month; extend by 1 month; switch off.
- **Steps:**
  1. Admin sets Study for 1 month, then extends, then switches off.
  2. As the user read notifications and the header.
- **Expected result:** "🎉 Study mode is on" with the end date; extend adds to the current end; switching off ends it now.
- **Automation:** `pg_study_test` ("admin switches Study on (1 month)", "my_limits lists study + plan_expires_at key", "admin add-on switch-on is recorded").

#### TC-STM-006 — Expiry warnings and "has ended" notice
- **Requirement:** FR-STM-006
- **Type / Priority:** Integration · P1
- **Preconditions:** Add-on ending in 7 days; in 1 day; just ended.
- **Test data:** None.
- **Steps:**
  1. Run `run_plan_expiry()` for each; run twice.
- **Expected result:** "⏳ Your Study add-on ends in 7 days", "… ends tomorrow", "Your Study add-on has ended"; no duplicates within 20 hours (3 days for the ended notice).
- **Automation:** `pg_study_test` covers plan expiry and "the person is told" for plans, not add-ons; add-on notices Manual.

#### TC-STM-007 — Leaving Study when the add-on ends
- **Requirement:** FR-STM-007
- **Type / Priority:** Functional · P1
- **Preconditions:** Person in Study mode; admin ends the add-on.
- **Test data:** None.
- **Steps:**
  1. Leave the app idle for over 2 minutes; return to it.
  2. Press Study in the mode switch; open Study archive.
- **Expected result:** The app moves to Personal and the dashboard; the Study button is locked; archive shows the add-on popup.
- **Automation:** Manual.

#### TC-STM-008 — Changes refused after expiry
- **Requirement:** FR-STM-008
- **Type / Priority:** Security · P1
- **Preconditions:** Database access as a person whose add-on has ended, with existing data.
- **Test data:** Insert subject, update assignment, insert class, update note, activate / archive / restore semester.
- **Steps:**
  1. Try each; then delete an assignment and delete an archived semester.
- **Expected result:** Inserts / updates fail with row-level-security errors (page text "Your Study add-on isn't active, so changes can't be saved."); semester functions "The Study add-on is not active"; deletes succeed.
- **Automation:** `pg_study_test` ("no add-on → cannot add a subject"); `pg_study2_test` ("without the add-on nothing can be added").

#### TC-STM-009 — Data kept after expiry and returns after renewal
- **Requirement:** FR-STM-009, FR-STM-010
- **Type / Priority:** Data · P1
- **Preconditions:** Study user with subjects, classes, assignments, notes, a project; add-on ends then is renewed.
- **Test data:** None.
- **Steps:**
  1. Count rows in each Study table before and after expiry.
  2. Renew; open Study.
- **Expected result:** Row counts unchanged after expiry; after renewal everything shows again as before; while expired, Calendar, search and reminders show none of it.
- **Automation:** Manual.

#### TC-STM-010 — Reminders after expiry
- **Requirement:** FR-STM-009
- **Type / Priority:** Integration · P2
- **Preconditions:** Expired add-on; assignment due today; class now; group task assigned to the person.
- **Test data:** None.
- **Steps:**
  1. Run assignment, class and group-task reminder jobs.
- **Expected result:** No assignment or class reminder; group-task reminder is still sent.
- **Automation:** Manual.

#### TC-STM-011 — Items made in Study mode stay in Study
- **Requirement:** FR-STM-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Study user; "Show Study in Personal" off.
- **Test data:** Reminder "Revise chapter 2" made in Study mode.
- **Steps:**
  1. Create the reminder in Study mode; switch to Personal; switch the preference on; off again; switch to Work.
- **Expected result:** Visible in Study; not in Personal with the preference off; visible with it on ("Turn it off and it is gone again"); never in Work.
- **Automation:** `pg_study_test` ("a reminder made in Study mode keeps space=study and the semester"); `space_test` (prints the allowed spaces: study → study; personal + preference → personal and study; work never study).

#### TC-STM-012 — Study tag downgraded without add-on
- **Requirement:** FR-STM-012
- **Type / Priority:** Security · P2
- **Preconditions:** Account without Study.
- **Test data:** Insert reminder with space "study".
- **Steps:**
  1. Insert it directly.
- **Expected result:** Saved as personal.
- **Automation:** `pg_study_test` ("without the add-on a "study" tag is downgraded to personal").

#### TC-STM-013 — Archived semester items hidden everywhere
- **Requirement:** FR-STM-013, FR-STS-017
- **Type / Priority:** Data · P1
- **Preconditions:** Events, tasks and reminders made in the semester; archive it.
- **Test data:** None.
- **Steps:**
  1. Look at Calendar, Reminders, Tasks, Notes, Documents.
  2. Study → Archive → semester → Other.
- **Expected result:** None visible in the normal pages; all listed under Other (the archive page switches the filter off). Restore brings them back.
- **Automation:** `space_test` (prints the filter with and without archived ids and with bypass).

#### TC-STM-014 — Filter off before migrations
- **Requirement:** FR-STM-014
- **Type / Priority:** Compatibility · P3
- **Preconditions:** Database without the `space` column.
- **Test data:** None.
- **Steps:**
  1. Load the app; open Study.
- **Expected result:** No filtering or tagging; no error.
- **Automation:** `space_test` ("init without column", "not ready → no filter").

#### TC-STM-015 — Menus per mode
- **Requirement:** FR-STM-015
- **Type / Priority:** Functional · P2
- **Preconditions:** Study user.
- **Test data:** None.
- **Steps:**
  1. Switch to Study; read the menu; reload; open Study archive from Personal.
  2. Look for Contacts.
- **Expected result:** Menu: Study, Study archive, Calendar, Reminders, Notes, Documents, Assistant (plus Settings, Support, Feedback, Notifications); Contacts is absent in Study mode (Findings F-12); mode remembered after reload; opening the archive switches to Study.
- **Automation:** Manual.

#### TC-STM-016 — Busy day in Study mode
- **Requirement:** FR-STM-016
- **Type / Priority:** Functional · P2
- **Preconditions:** A day with 12 classes (6 things) or 6 deadlines; busy alerts on; each sensitivity.
- **Test data:** Normal / Sensitive / Relaxed.
- **Steps:**
  1. Open Overview; change "How easily a day counts as busy"; switch alerts off.
- **Expected result:** A classes-only day of 12 classes counts 6 (busy at Normal); 6 deadlines counts 6 (busy); 9 things packed; Sensitive busy from 4, packed from 6; Relaxed busy from 8; notice bar disappears when alerts are off. (A normal 5-class day is not busy.)
- **Automation:** `v49_test` (prints whether the Study Overview notice box exists; no assertion).

#### TC-STM-017 — "Tomorrow is busy" notification counts Study items
- **Requirement:** FR-STM-017
- **Type / Priority:** Integration · P2
- **Preconditions:** Study user with 8 classes on tomorrow's weekday and 3 deadlines tomorrow; local time 18:xx.
- **Test data:** None.
- **Steps:**
  1. Run `run_busy_alerts()`.
  2. Repeat for tomorrow with a cancelled class and a break (still counted).
- **Expected result:** Count 4 + 3 = 7 → "⚠️ Tomorrow is busy"; classes cancelled or in a break are still counted by the server (Findings F-13); a person without the add-on gets no Study counts.
- **Automation:** `pg_busy_test` (separate suite; TBC whether it includes Study items).

#### TC-STM-018 — Study on every plan
- **Requirement:** FR-STM-018
- **Type / Priority:** Functional · P2
- **Preconditions:** One Dawn, one Glow, one Zenith account, each with Study.
- **Test data:** None.
- **Steps:**
  1. Use every Study tab on each; read the add-on popup note.
- **Expected result:** Same features everywhere; only reminder time selectors differ; popup says it works on every plan.
- **Automation:** Manual.

#### TC-STM-019 — Plan lookup failure falls back to Dawn
- **Requirement:** FR-STM-018, FR-STM-019
- **Type / Priority:** Negative · P3
- **Preconditions:** Block the `my_limits` call; cached plan empty.
- **Test data:** None.
- **Steps:**
  1. Load the app offline.
- **Expected result:** Plan treated as Dawn, never bigger; with a cache the last known add-ons are used until the answer arrives.
- **Automation:** Manual.

#### TC-STM-020 — Security of all Study tables
- **Requirement:** NFR-STM-001, NFR-STM-002
- **Type / Priority:** Security · P1
- **Preconditions:** Two users with data in every Study table; one anonymous client.
- **Test data:** Select / insert / update / delete across users.
- **Steps:**
  1. As anon, select every Study table.
  2. As user 2, select / update / delete user 1's rows in each; insert rows with `user_id` = user 1.
- **Expected result:** anon: denied; user 2: no rows, no changes, inserts refused.
- **Automation:** `pg_study_test` ("another user cannot change my subject"; other tables not asserted).

#### TC-STM-021 — Text safety
- **Requirement:** NFR-STM-004
- **Type / Priority:** Security · P1
- **Preconditions:** Study user.
- **Test data:** Names `<img src=x onerror=alert(1)>` in subject, note title, comment, project name, deck name.
- **Steps:**
  1. Save each and view it in every list and popup.
- **Expected result:** Shown as plain text; no alert.
- **Automation:** Manual.

#### TC-STM-022 — Work + Study bundle visibility
- **Requirement:** FR-STM-002
- **Type / Priority:** Functional · P3
- **Preconditions:** Account with Work add-on only.
- **Test data:** None.
- **Steps:**
  1. Open the Study popup.
- **Expected result:** "Get Study" shown, "Get both" hidden.
- **Automation:** Manual.

#### TC-STM-023 — Reminders de-duplication windows
- **Requirement:** NFR-STT-003
- **Type / Priority:** Data · P2
- **Preconditions:** Items that qualify.
- **Test data:** Run each job twice in a row.
- **Steps:**
  1. Run class reminders twice; assignment reminders twice; group-task twice.
- **Expected result:** The second run adds nothing.
- **Automation:** `pg_study_test` (jobs run; second run not asserted).

#### TC-STT-032 — The eight tabs fit on a laptop-sized window
- **Requirement:** NFR-STT-002
- **Type / Priority:** Responsive · P2
- **Preconditions:** Study Sam with the Study add-on.
- **Steps:**
  1. Open Study in a browser window 1100 px wide, then 1360 px, then 1400 px.
  2. Click through the tabs.
  3. Hover over a tab that shows only an icon.
- **Expected result:** At 1100 and 1360 px all eight tabs (Overview, Timetable, Assignments, Subjects, Semesters, Notes, Cards, Groups) are visible; only the open tab shows its name, the others show an icon with the name as a tooltip. At 1400 px every tab shows its name. Nothing is cut off or needs sideways scrolling.
- **Automation:** Manual (checked once in headless Chrome at 1100 px).

#### TC-STS-038 — A missing newer migration degrades instead of breaking
- **Requirement:** NFR-STS-001
- **Type / Priority:** Compatibility · P3
- **Preconditions:** A test database that lacks one late Study column (for example `target_percent`, migration 049) — use a throw-away project.
- **Steps:**
  1. Open Study → Subjects and add a subject.
  2. Edit it and save.
- **Expected result:** The subject is created and saved with the older columns; the page does not crash. Where a feature really needs the missing migration, the message names the migration to run.
- **Automation:** Manual.

#### TC-STM-024 — Study data is reused for 60 seconds
- **Requirement:** NFR-STM-003
- **Type / Priority:** Performance · P3
- **Preconditions:** Study Sam with subjects and assignments; browser developer tools open on the Network tab.
- **Steps:**
  1. Open the Calendar (it loads Study data), then within 60 seconds open the Dashboard and Focus Mode.
  2. Wait over 60 seconds and open the Calendar again.
- **Expected result:** In the first minute the Study tables are not requested again; after 60 seconds they are fetched once more. Changes made on the Study page itself appear at once.
- **Automation:** Manual.

## Findings

| # | Finding | Where |
|---|---|---|
| F-01 | Assignment weights of a subject are not checked to add up to 100 %. With more than 100 % the "need" line says "All marked" even if an item is unscored; the What-if calculator treats the unassigned rest as 0. No warning is shown. | `app/modules/study/study.js` `sdNeeded`, `study.extras.js` `sdWifPaint` |
| F-02 | Deleting a semester with the Delete button on its edit form says "Its subjects stay…" but also deletes its flashcard decks and cards (`study_decks.semester_id … on delete cascade`); other items only lose the link. It can delete the active semester (no DELETE-typing). | `study.js` `sdSemDelete`, migration 067 |
| F-03 | "Delete permanently" for "Archived subjects" counts notes in the confirmation but does not delete them (notes and decks keep living without a subject; assignments, subjects and classes are deleted). | `study.archive.js` `saDeleteForever` |
| F-04 | Restoring a semester un-archives every subject in it, including subjects archived by hand earlier, and switches on every Personal reminder of that semester even if the person had switched it off. | migration 056 `restore_study_semester` |
| F-05 | Message "The end date must be after the start date." appears for a class, but an end date equal to the start date is accepted (database `end_date >= start_date`). Semesters use the true "after" rule. | `study.js` `sdClassSave`, migrations 047, 049 |
| F-06 | "Start from a previous semester" reuses a subject with the same name and code but copies its classes and assignments again, so running it twice duplicates them. The hint "notes are not copied" refers to Study notes; the notes text of each assignment is copied. | `study.js` `sdCopyGo` |
| F-07 | When the add-on ends, the Study tabs are hidden (the person is treated as a guest) and "Export my data" leaves out Study data, although the data is kept and readable in the database. There is no way to see or export it until the add-on is renewed. | `study.js` `sdGuest`, `settings.js` line 328 |
| F-08 | The account grade scale (profile preference) has no 2 to 20 row limit in the database (only semester / subject scales have); the page only enforces a minimum of two rows (`sdValidScale`) and 20 on adding rows. | migration 061, `study.js` |
| F-09 | The Attendance popup lists at most the newest 120 sessions, so older sessions of long-running classes cannot be marked. | `study.extras.js` `sdAttPaint` |
| F-10 | A failed save of a flashcard rating is only logged to the console; the person is not told and the card stays due. | `study.cards.js` `sdRunRate` |
| F-11 | The "trial is off on production" rule exists only in the page (`live: window.LUMA_ENV !== 'production'`); `start_addon_trial` works for anyone in any environment. | `modes.js`, migration 044 |
| F-12 | Study mode has no Contacts menu entry (`MODE_MENUS.study`), yet group projects and note sharing need contacts and the picker says "Add people on the Contacts page first". The person must switch to Personal. | `modes.js` line 21, `study.js` `sdPickContacts` |
| F-13 | The server busy-day count (`busy_day_stats`, migration 082) counts every class on the weekday, ignoring class dates, cancelled dates, breaks and archived subjects, and counts deadlines of archived semesters; the page applies those rules, so the push and the on-screen notice can disagree. | migration 082, `study.js` `sdClassOn` |
| F-14 | The `luma-plan-expiry` job's comment says "daily" but is scheduled hourly (minute 5); behaviour is guarded by de-duplication, so harmless. | migration 062 |
| F-15 | Classes, cancelled dates and breaks have no semester link and are not covered by the "Activate a semester first" trigger: only the page stops adding classes without an active semester. Breaks are account-wide, not per semester. | migrations 045, 052, 056 |
| F-16 | A person who owns group projects but whose add-on has ended cannot reach them: Study mode stays locked unless invited to someone else's project. Their own projects are still reachable by members. | `modes.js` `sdCheckGuest` |
| F-17 | A score above "Out of" is accepted (e.g. 60/50); the grade can exceed 100 %. TBC whether extra credit is intended. | `study.js` `sdTaskSave`, migration 045 |
| F-18 | The existing automated suites do not cover form messages, timetable rules, attendance maths, scale validation, GPA, the SRS scheduling formula, or any responsive layout; `v41_test` and `v49_test` are smoke checks only (no hard assertion for the Study busy box). | `docs/test-automation/` |
