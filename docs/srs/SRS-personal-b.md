# SRS — Personal mode (part B)

| | |
|---|---|
| Product | LUMA — a personal operating system |
| Document | SRS, Personal mode part B (money, subscriptions, bills, goals, habits, health, analytics, split expenses, purchase history, Lumi) |
| Software version described | 0.26.x (staging); see `CHANGELOG.md` |
| Status | Draft for review. Written from the code, the migrations and `CHANGELOG.md`; "TBC" marks anything that could not be confirmed there. |

## 1. Scope

This part states the functional requirements of ten Personal-mode features: **Money** (income, expenses, budget, categories, all transactions, month navigation, budget alerts), **Subscriptions** (renewal tracking and renewal reminders), **Bills** (recurrence, payments, overdue handling, reminders), **Goals** (progress, deadlines, reminders), **Habits** (schedules, ticking, streaks, heat-map, back-filling, reminders), **Health** (daily log, goals and rings, quick add, mood, sleep, charts, reminders), **Analytics** (scores, charts, insights, AI insights and the weekly review), **Split expenses** (Zenith only), **Purchase history**, and the **Lumi** assistant (chat, daily limits, actions, Personal tools, the overview tool, dashboard suggestions). It also holds the non-functional requirements that belong to these features. Task, calendar, reminders, notes, documents, contacts, settings, Work and Study are described in other parts and are mentioned here only where they touch these features.

### 1.1 Area codes

| Code | Feature | Main source |
|---|---|---|
| MON | Money | `app/modules/money/`, migrations 023, 024, 031, 035, 038 |
| SUB | Subscriptions | `app/modules/subscriptions/`, migrations 020, 021, 022, 025, 031 |
| BILL | Bills | `app/modules/bills/`, migrations 020, 021, 022, 030, 031, 060 |
| GOAL | Goals | `app/modules/goals/`, migrations 019, 030, 060 |
| HAB | Habits | `app/modules/habits/`, migrations 016, 017, 018, 028 |
| HLTH | Health | `app/modules/health/`, migrations 011, 012, 013, 014, 015, 028, 039 |
| ANA | Analytics and insights | `app/modules/analytics/insights.js`, migrations 029, 034, 060 |
| SPL | Split expenses | `app/modules/split/`, migration 064 |
| PUR | Purchase history | `app/modules/purchases/`, migration 063 |
| LUMI | Lumi assistant | `app/modules/assistant/`, `supabase/functions/lumi/index.ts`, migrations 029, 037, 051 |

### 1.2 Plan limits that matter to this part

Values come from `luma.plan_limits` (migrations 033 and 064; no later migration changes these keys). Empty = unlimited. An administrator can edit the values under Admin → Plan limits.

| Limit key | Meaning | Dawn | Glow | Zenith |
|---|---|---|---|---|
| bills | Bills and subscriptions together | 5 | 12 | unlimited |
| goals | Active (not completed) goals | 3 | 5 | unlimited |
| habits | Habits that are not deleted | 5 | 10 | unlimited |
| lumi_questions | Lumi questions a day | 3 | 10 | 15 |
| lumi_actions | Lumi may add or change things (1 = yes) | 0 | 1 | 1 |
| insights | AI insights a day in Analytics | 0 | 3 | 10 |
| payroll | Malaysian payroll helper in Money (1 = yes) | 0 | 1 | 1 |
| timing | Choose reminder times and the budget warning level (1 = yes) | 0 | 1 | 1 |
| split | Split expenses (1 = yes) | 0 | 0 | 1 |

### 1.3 Conventions

- Money is shown as `RM1,234.50` (no decimals when the amount is whole).
- "Today" and "this month" follow the Malaysia time zone in the screens (`mytDayKey`) and the person's own time zone (Edit profile) in the server jobs.
- Items created in Personal mode belong to the Personal space; Work and Study items appear in these pages only when the person turns on "Show Work in Personal" / "Show Study in Personal" (migration 050, `shared/luma-space.js`).
- Priority: Must, Should, Could. Each feature ends with its non-functional requirements (NFR) and notes.

---

## 2. Money (MON)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-MON-001 | The system shall show a Money page titled "Money" with the buttons Income, Budget and Log expense, and a sub-title of the form "<Month> · RMx spent" followed by " of RMy" when a monthly budget is set. | Must | money.js |
| FR-MON-002 | The system shall show four summary cards for the month shown: Income, Spent (with the number of transactions), Saved (income minus spending, with the percentage of income; a negative value is shown red with a minus sign) and Budget left. | Must | money.js |
| FR-MON-003 | The system shall let the person move between months with the previous and next buttons or by choosing a month from the month picker opened by tapping the month name, within the range from 24 months before to 12 months after the current month; choosing the current month returns to "this month"; a month outside the range falls back to the current month. | Must | money.js |
| FR-MON-004 | The system shall open the "Log expense" window from the Log expense button, with the fields Amount (RM), What was it for? (up to 80 characters), Category and Date (default today) and an Expense / Income switch; the title changes to "Log income" when Income is chosen and to "Edit expense" / "Edit income" when an entry is edited. | Must | money.js, money.html |
| FR-MON-005 | The system shall offer 13 expense categories (Housing, Food & dining, Groceries, Transport, Bills & utilities, Subscriptions, Shopping, Health, Entertainment, Education, Insurance, Debt, Other) and 5 income categories (Bonus, Freelance, Investment, Gift, Other income); the default is "Other" for an expense and "Other income" for income, and switching the kind resets a category that does not exist for the new kind. | Must | money.js |
| FR-MON-006 | The system shall refuse to save an entry when the amount is not a number above 0 ("Enter the amount (a number above 0).") or the date is empty ("Pick the date."), and shall accept only digits and one decimal separator in the amount box. | Must | money.js, money_entries check `amount > 0` |
| FR-MON-007 | The system shall let the person edit an entry with the pencil button on its row (on the page or in All transactions); saving replaces the entry and updates every total. | Must | money.js |
| FR-MON-008 | The system shall show the Delete button only while an existing entry is edited, ask "Delete this entry?" ("It will be removed from your totals. This can't be undone.") and remove the entry only after the person confirms. | Must | money.js |
| FR-MON-009 | The system shall build the transactions of a month from three sources: logged entries dated in that month, bill and subscription payments marked paid in that month (dated by the day they were marked paid, shown as expenses with a "Bill" or "Subscription" tag) and the monthly salary. | Must | money.js |
| FR-MON-010 | The system shall file a paid bill under a Money category taken from the bill's category: Internet, Electricity, Water and Phone under "Bills & utilities"; Insurance under "Insurance"; Credit card and Loan under "Debt"; Rent under "Housing"; Subscription under "Subscriptions"; Other under "Other". | Must | money.js (M_BILLCAT) |
| FR-MON-011 | The system shall count the take-home salary as income on the pay day of each month from the month in which the income settings were first saved onwards, only when the take-home amount is above 0, using the last day of a short month when the pay day is later (for example 31 in February), and shall tag it "Expected" while that day is still in the future. | Must | money.js (mTxns) |
| FR-MON-012 | The system shall open an "Income & salary" window from the Income button or the Income card with the fields Country, Gross monthly salary, EPF (11% standard, 9% reduced, 0% none), PCB (optional) and Pay day, and shall save them with "Save income". | Must | money.js, money.html |
| FR-MON-013 | The system shall validate the income window: salary must be a number ("Enter your salary as a number."), pay day must be a whole number from 1 to 31 ("Pay day must be between 1 and 31."), PCB must be empty or 0 or more ("PCB must be a number (0 or more), or left blank."). | Must | money.js, money_settings checks (023, 024) |
| FR-MON-014 | For a person in Malaysia with the payroll feature (Glow or Zenith), the system shall work out take-home pay from the gross salary: EPF at the chosen rate rounded up to the next ringgit; SOCSO 0.5%, EIS 0.2% and LINDUNG 24 Jam 0.75% (new from 1 June 2026) on wages up to RM6,000, calculated on the midpoint of each RM100 wage band and rounded to the nearest 5 sen; PCB only as typed from the payslip (blank = RM0); take-home = gross minus all deductions. | Must | money.js (myPayroll) |
| FR-MON-015 | For a country other than Malaysia, or when the payroll feature is not in the plan, the system shall count the monthly income exactly as entered and show the note that deductions are worked out only for Malaysia. | Must | money.js (mIsMY, mPay) |
| FR-MON-016 | The system shall update the person's profile country when a different country is chosen in the income window. | Should | money.js |
| FR-MON-017 | The system shall let the person set the monthly budget from the Budget button or the Budget left card in a "Monthly budget" prompt: a number of 0 or more; 0 turns the budget off; anything else shows "Please enter a number (0 or more)." with the title "Invalid amount". | Must | money.js |
| FR-MON-018 | The Budget left card shall show the remaining amount with "of RMx", or the overspend in red with "over budget", or "Set budget" when no budget is set. | Must | money.js |
| FR-MON-019 | The system shall show "Spending by category" as bars sorted from the largest category, using the category colour, and the text "No spending logged this month yet. Log an expense, or mark a bill as paid." when the month has no spending. | Must | money.js |
| FR-MON-020 | The system shall show "Recent transactions" with only the 5 latest rows (newest day first) and a "View all" button; an empty month shows "Nothing yet this month."; an expected salary row is tagged "Expected". | Must | money.js |
| FR-MON-021 | The system shall open an "All transactions" window from "View all", starting at the month on the page, with previous / next month buttons (disabled at the ends of the allowed range), a month picker, a day selector ("All days" or one day of the month) and the totals Transactions, Spent and Income for the rows shown; empty results say "Nothing this month." or "Nothing on this day."; tapping the pencil on a row closes the window and opens the entry for editing. | Must | money.js, money.html |
| FR-MON-022 | The system shall load the entries of the last 24 months (at most 5,000, newest first) together with the bills data and the money settings. | Should | money.data.js, money.js |
| FR-MON-023 | The system shall show the share created by a split expense as an expense named after the split with the category "Split" (see FR-SPL-016); because "Split" is not one of the expense categories it is drawn with the "Other" icon and a grey bar. | Should | money.js, migration 064 |
| FR-MON-024 | The system shall run an hourly job (at minute 30) that, for each person with a monthly budget above 0 and budget alerts on, adds up this month's expense entries and bill payments (by the day marked paid) and creates one notification "💸 You have used N% of your monthly budget" when spending reaches the warning level (default 80%) and one "⚠️ You are over your monthly budget" when it reaches the budget, each at most once a month, with the body "Spent RMx of RMy this month." that opens Money and highlights the Budget left card. | Must | migrations 030, 031, 035; ui.js |
| FR-MON-025 | The system shall let a Glow or Zenith person choose the budget warning level (the Settings → Reminders list offers 50, 60, 70, 75, 80, 85, 90 and 95%; the database accepts 50 to 100) and shall keep it at 80% on Dawn; the database refuses a different level on Dawn with "Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off." | Must | migrations 035, 038; settings.js |
| FR-MON-026 | The system shall allow each person to read and change only their own money entries and money settings (row-level security). | Must | migration 023 |
| FR-MON-027 | If the money tables cannot be read, the system shall show "Could not load money" and a hint to run migration 023 instead of the page; a save error caused by missing tables shows "Money isn't set up yet — run supabase/migrations/023_money_country.sql in the SQL Editor." | Should | money.js |
| FR-MON-028 | The system shall store income settings with these rules: gross salary 0 or more, EPF rate 0 to 11, pay day 1 to 31, monthly budget 0 or more, PCB empty or 0 or more; entry amount above 0, name up to 80 characters, kind "expense" or "income". | Must | migrations 023, 024 |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-MON-001 | The Money page shall paint at once from data already in memory and refresh when the load finishes; a failed bills load shall only remove bill payments from the totals, not break the page. | Should | money.js |
| NFR-MON-002 | The Money page and its three windows shall fit phone widths from 320 px without sideways scrolling; the four cards shall stack and the two panels shall fold into one column. | Must | responsive.css, money.css |

Notes: the take-home salary appears in a month only when the Malaysian payroll calculation applies; otherwise the entered income is used. The salary is a calculated row, not an entry, so it has no pencil button.

---

## 3. Subscriptions (SUB)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SUB-001 | The system shall treat a subscription as a bill whose category is "Subscription": it shows on the Subscriptions page and on the Bills page, shares the bills plan limit and its payments follow the bill rules. | Must | subscriptions.js, bills.js |
| FR-SUB-002 | The system shall show a Subscriptions page titled "Subscriptions" with a sub-title "<n> active · RMx/mo" (or "Keep track of what renews" when there are none) and an "Add subscription" button. | Must | subscriptions.js |
| FR-SUB-003 | When there are no subscriptions the system shall show "Add your first subscription" with eight one-tap presets (Netflix, Spotify, YouTube Premium, iCloud+, ChatGPT Plus, Adobe CC, Notion, Disney+); choosing one opens the add window filled with its name and type. | Should | subscriptions.js |
| FR-SUB-004 | The system shall open "Add subscription" with the fields Subscription name (required, up to 80 characters), Type chips (Streaming, Music, Storage, Creative, AI, Productivity, Gaming, Other), Amount, Repeats (Weekly, Monthly or Yearly — "Once" is not offered), "Next renewal date" and Note, and shall save the type in the note. | Must | bills.js, bills.html |
| FR-SUB-005 | The system shall validate a subscription as it validates a bill (FR-BILL-004): name required "Give the bill a name.", amount above 0, date required. | Must | bills.js |
| FR-SUB-006 | The system shall let the person edit a subscription (title "Edit subscription") and delete it after the confirmation "Delete “<name>”?", which also removes its payment history. | Must | bills.js |
| FR-SUB-007 | The system shall show four figures for active subscriptions: Monthly total (yearly amounts divided by 12, weekly amounts times 52 divided by 12), Yearly est. (monthly total times 12), Active (count) and Renews soon (count renewing within 7 days). | Must | subscriptions.js |
| FR-SUB-008 | The system shall give each card a status pill: "Renews today", "Renews N day(s)" (amber for 7 days or fewer, blue otherwise), "Paused" for a paused subscription, or "Ended" when no later renewal exists. | Must | subscriptions.js |
| FR-SUB-009 | The system shall work out the next renewal as the first date on or after today: the stored date for a one-off or weekly date still ahead, the next 7-day step for a weekly one, and for monthly and yearly the same day of the month (or year), using the last day of shorter months. | Must | subscriptions.js (bNext), bills.js (bCycle) |
| FR-SUB-010 | The system shall list the subscriptions under two tabs, "Active (n)" and "Inactive (n)"; Active is sorted by the next renewal date, Inactive by name; empty tabs say "No active subscriptions." and "No inactive subscriptions — paused ones will show up here." | Must | subscriptions.js |
| FR-SUB-011 | The system shall pause or resume a subscription with the switch on its card; a paused subscription leaves the totals, the reminders and the Bills page; the change is shown at once and undone with a message if saving fails. | Must | subscriptions.js |
| FR-SUB-012 | The "Renews soon" card shall, when tapped, switch to the Active tab, highlight the cards renewing within 7 days, dim the others and scroll to the first; a tap anywhere else on the page clears the highlight. | Should | subscriptions.js |
| FR-SUB-013 | The system shall refuse a new subscription once the plan's bills limit is reached (Dawn 5, Glow 12, Zenith unlimited, counted together with bills), showing "Plan limit reached" and "Your <Plan> plan includes up to N bills and subscriptions. Upgrade to add more." with a "See plans" button; the database also refuses with "Plan limit: …". | Must | bills.js, plans.js, migration 033 |
| FR-SUB-014 | The system shall run an hourly job that creates a notification "🔔 <name> renews in N day(s)" with the body "RMx on DD Mon. Pause it in Subscriptions if you no longer need it." for each active subscription whose next renewal is exactly N days ahead (N = the person's choice, default 3, from 1 to 14), at the person's chosen hour (default 9) in the person's time zone. | Must | migration 031 |
| FR-SUB-015 | The renewal reminder shall not be sent when that renewal is already marked paid, when the subscription is paused, when subscription reminders are switched off, or when the same reminder was sent in the last 12 hours; it shall open Subscriptions and highlight the card. | Must | migration 031, ui.js |
| FR-SUB-016 | On Dawn the system shall keep the subscription reminder hour and days at the standard values (9 and 3) and refuse other values in the database; the on/off switch works on every plan. | Should | migrations 033, 038 |
| FR-SUB-017 | The system shall show a subscription as a row on the Bills page where it can be ticked paid; a paid subscription counts as spending in the "Subscriptions" category of Money. | Should | bills.js, money.js |
| FR-SUB-018 | The system shall pick a card's icon and colour from the type kept in the note (case-insensitive) and use the "Other" look for an unknown type. | Could | subscriptions.js |
| FR-SUB-019 | If bills cannot be read the system shall show "Could not load subscriptions" with a hint to run migration 020. | Should | subscriptions.js |
| FR-SUB-020 | The system shall allow each person to read and change only their own subscriptions (row-level security on bills). | Must | migration 020 |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-SUB-001 | The subscription cards shall reflow from three columns to one on a phone (320 px) with no text cut off. | Must | subscriptions.css |

---

## 4. Bills (BILL)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-BILL-001 | The system shall show a Bills page titled "Bills" whose sub-title reads "RMx to pay this month" (or "in <Month Year>"), "All paid — nice!", "Nothing due this month" or, with no bills at all, "Never miss a payment". | Must | bills.js |
| FR-BILL-002 | When there are no bills the system shall show "Add your first bill" with seven quick picks (Internet, Electricity, Water, Phone, Rent, Car insurance (yearly), Credit card); choosing one opens the add window filled in. | Should | bills.js |
| FR-BILL-003 | The system shall open "Add bill" with Quick start chips, Bill name (required, up to 80 characters), Amount (RM), Category (Internet, Electricity, Water, Phone, Insurance, Credit card, Rent, Subscription, Loan, Other), Repeats (Once, Weekly, Monthly, Yearly), the due-date field and an optional Note (up to 120 characters); the due date defaults to today and the repeat to Monthly. | Must | bills.js, bills.html |
| FR-BILL-004 | The system shall refuse to save a bill without a name ("Give the bill a name."), with an amount that is not above 0 ("Enter the amount (a number above 0)."), or without a due date ("Pick the due date."); Enter in the name box saves. | Must | bills.js |
| FR-BILL-005 | The system shall label the date field by repeat: "Due date" (once), "First due date (repeats every 7 days)", "First due date (repeats on this day each month)", "First due date (repeats on this day each year)". | Should | bills.js |
| FR-BILL-006 | The system shall let the person edit a bill and delete it after the confirmation "Delete “<name>”?" ("The bill and its payment history are removed. This can't be undone."). | Must | bills.js |
| FR-BILL-007 | The system shall place a bill's due dates as follows: a one-off on its date; weekly every 7 days from the first date; monthly on the same day of each month starting with the month of the first date, using the last day of shorter months; yearly on the same day and month each year from the first date. | Must | bills.js (bCycle, bCycles) |
| FR-BILL-008 | The system shall show for the chosen month the cycles due in that month and, for the current month only, earlier unpaid cycles of one-off bills (up to 24 months back) and of monthly or yearly bills (up to 6 months back, and only from the month the bill was added); weekly bills are not carried over. | Must | bills.js (bRows) |
| FR-BILL-009 | The system shall give each cycle a status and pill: "Paid"; "Overdue Nd" (due date before today); "Due today"; or "N day(s)" until due (amber for 7 days or fewer, blue otherwise); a repeating bill also shows its repeat after the date. | Must | bills.js |
| FR-BILL-010 | The system shall sort the cycles with unpaid before paid, then by distance of the due date from today (on a tie the overdue one first). | Should | bills.js |
| FR-BILL-011 | The summary card shall show "Due this month" (or "Due in <Month>"), the total still to pay, "across N unpaid bill(s)" or "everything is paid" or "no bills this month", a red alert "N bill(s) is/are overdue (RMx)." when any, and the Paid total. | Must | bills.js |
| FR-BILL-012 | The system shall mark one cycle paid or unpaid with the tick button on its row, record the amount (the bill amount at that moment) and the time, show the change at once and undo it with "Could not save: …" if the save fails; tapping a paid row again removes the payment. | Must | bills.js, bills.data.js |
| FR-BILL-013 | The system shall keep one payment per bill per due date; a paid cycle keeps the amount it was paid with even if the bill amount is edited later. | Must | migration 020, bills.js |
| FR-BILL-014 | The "Mark all as paid" button shall be disabled when nothing is unpaid, otherwise list the unpaid bills and the total in a confirmation ("Mark N bill(s) as paid?") and record them all paid on confirmation. | Must | bills.js |
| FR-BILL-015 | The system shall let the person move between months with previous / next buttons or the month picker within 24 months back and 12 months ahead; the current month is the default; paid cycles of other months stay visible as paid. | Must | bills.js |
| FR-BILL-016 | The system shall keep a history of payments (bill, due date, amount, paid time) that feeds Money and Analytics; a payment is for the whole bill amount — partial payments are not supported (see Findings in the test document). | Must | migration 020, bills.js |
| FR-BILL-017 | A bill marked paid shall appear in Money as an expense on the day it was marked paid and count toward the budget and the budget alert. | Must | money.js, migration 035 |
| FR-BILL-018 | The system shall hide bills that are paused (active = false) from the Bills page and from reminders; pausing is done from the Subscriptions page. | Should | bills.js, migration 021 |
| FR-BILL-019 | The system shall refuse a new bill once the plan limit is reached (Dawn 5, Glow 12, Zenith unlimited; subscriptions count too) with the "Plan limit reached" dialog and "See plans"; the database refuses with "Plan limit: the <Plan> plan allows up to N bills and subscriptions. Upgrade your plan in Settings to add more." | Must | bills.js, migration 033 |
| FR-BILL-020 | The system shall run an hourly job that, for each active bill that is not a subscription and is not paid for that cycle, creates "🧾 <name> is due in N day(s)", "🧾 <name> is due today" or "🧾 <name> is overdue" (N = the person's choice from 1 to 14, default 3; "overdue" is sent the day after the due date) at the chosen hour (default 9) in the person's time zone, with the body "RMx · DD Mon. Tick it off in Bills once paid.", at most once per 12 hours per message. | Must | migration 060 (run_morning_reminders) |
| FR-BILL-021 | Opening a bill reminder shall go to Bills and highlight the bill; when its due date is in the next month the page moves to that month first. | Should | bills.js (LU_FOCUS_HOOKS) |
| FR-BILL-022 | On Dawn the bill reminder hour and days stay at 9 and 3 and the database refuses other values; the on/off switch works on every plan. | Should | migrations 033, 038 |
| FR-BILL-023 | When saving fails because of the database the system shall explain: "Weekly needs a database update — run supabase/migrations/022_bill_weekly.sql" for a recurrence error, "Bills aren't set up yet — run supabase/migrations/020_bills.sql" for missing tables, and "Could not load bills" with a hint when the list cannot be read. | Should | bills.js |
| FR-BILL-024 | The system shall allow each person to read and change only their own bills and bill payments; a payment can only be written for a bill the person owns. | Must | migration 020 |
| FR-BILL-025 | The Dashboard shall suggest "N bill(s) is/are overdue. Pay <name> (RMx) first." when no task is overdue but a bill is. | Could | dashboard.js |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-BILL-001 | Each bill row shall keep its name on one line and put the status, amount and buttons on the next line on phones (320 to 390 px); the list shall keep its scroll position when a bill is ticked. | Must | bills.css, bills.js |
| NFR-BILL-002 | Bill amounts shall be positive numbers stored without rounding errors (numeric), shown with up to two decimals. | Should | migration 020, bills.js |

Notes: the quick-start list is not shown when editing or when the window is opened from Subscriptions.

---

## 5. Goals (GOAL)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-GOAL-001 | The system shall show a Goals page titled "Goals" with a "New goal" button and a sub-title "<n> active · on track for <m>" followed by " · <k> completed" when some are completed, or "Set goals and watch your progress" when there are none. | Must | goals.js |
| FR-GOAL-002 | When there are no goals the system shall show "Set your first goal" with four ideas (emergency fund RM12,000; half marathon 21 km; 24 books; side project 100%); choosing one opens the window filled in. | Should | goals.js |
| FR-GOAL-003 | The system shall open "New goal" with Goal (required, up to 120 characters), Category chips (Finance, Health, Learning, Career, Personal, Other; default Personal), Target (required), Unit (optional, up to 20 characters, with chips RM, %, km, kg, books, hours, days), "Progress so far" (default 0), Deadline (optional, with "Remove deadline") and Note (optional, up to 200 characters). | Must | goals.js, goals.html |
| FR-GOAL-004 | The system shall refuse to save a goal without a name ("Give your goal a name."), with a target that is not above 0 ("Enter a target above 0 (use 100 with the unit % if it has no number)."), or with progress below 0 ("Progress must be 0 or more."); the Target and Progress boxes accept only digits and a decimal separator. | Must | goals.js, goals table checks |
| FR-GOAL-005 | The system shall show a hint under "Progress so far" that explains what to type for the unit chosen and gives an example built from the target (for the unit % it asks for the percentage reached). | Should | goals.js |
| FR-GOAL-006 | Each goal card shall show a progress ring with the percentage (current divided by target, rounded, capped at 100), the category, the title, "<current> of <target>" with the unit (RM before the number, % after it, other units after a space), the note, a status pill, the deadline text and an "Update progress" button. | Must | goals.js |
| FR-GOAL-007 | The system shall set the status: "Completed" when progress is at or above the target; "Overdue" when the deadline is before today; "Behind" when the share done is more than 5 percentage points below the share of time used between the day the goal was created and the deadline; otherwise "On track" (also when there is no deadline). | Must | goals.js (gStatus) |
| FR-GOAL-008 | The system shall describe the deadline as "No deadline", "Due <date>" for a completed goal, "N day(s) overdue", "Due today", or "N day(s) left · <date>". | Should | goals.js |
| FR-GOAL-009 | "Update progress" shall ask for the new total in a prompt (a number of 0 or more) and save it; anything else shows "Please enter a number (0 or more)." with the title "Invalid amount". | Must | goals.js |
| FR-GOAL-010 | When progress reaches the target the database shall stamp the goal as completed, the goal shall move to the Completed tab and a toast "Goal reached 🎉" with the goal name shall appear once; when progress is later lowered below the target the completion is cleared and the goal is active again. | Must | migration 019, goals.js |
| FR-GOAL-011 | The system shall list goals under "Active (n)" and "Completed (n)"; the Completed tab falls back to Active when no goal is completed; an empty list says "Nothing here yet." | Must | goals.js |
| FR-GOAL-012 | The system shall let the person edit a goal ("Edit goal") and delete it after the confirmation "Delete “<title>”?" ("This goal and its progress are removed. This can't be undone."). | Must | goals.js |
| FR-GOAL-013 | The system shall refuse a new goal when the number of active goals has reached the plan limit (Dawn 3, Glow 5, Zenith unlimited); completed goals do not count; the message is "Your <Plan> plan includes up to N active goals. Upgrade to add more." and the database refuses with "Plan limit: the <Plan> plan allows up to N active goals. …". | Must | goals.js, migration 033 |
| FR-GOAL-014 | The system shall run an hourly job that, for each goal that is not completed and has a deadline between yesterday and 15 days ahead, creates "🎯 <title> is due in N day(s)" (N = the person's choice from 1 to 14, default 3) or "🎯 <title> is due today" at the chosen hour (default 9), with the body "You are at N% of your goal.", at most once per 12 hours per message. | Must | migration 060 |
| FR-GOAL-015 | Goal reminders shall not be sent when the goal reminders are switched off or the goal is completed; opening one goes to Goals and highlights the goal. | Should | migration 060, ui.js |
| FR-GOAL-016 | On Dawn the goal reminder hour and days stay at 9 and 3; the database refuses other values. | Should | migrations 033, 038 |
| FR-GOAL-017 | The system shall allow each person to read and change only their own goals. | Must | migration 019 |
| FR-GOAL-018 | If goals cannot be read the system shall show "Could not load goals" with a hint to run migration 019; a save error about missing tables shows "Goals aren't set up yet — run supabase/migrations/019_goals.sql in the SQL Editor." | Should | goals.js |
| FR-GOAL-019 | The system shall store goals with these rules: title 1 to 120 characters, category one of the six, unit up to 20 characters, target above 0, progress 0 or more, note up to 200 characters. | Must | migration 019 |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-GOAL-001 | The goal cards shall be one column on phones and two columns on a laptop (1180 px), with no sideways scrolling. | Must | goals.css, responsive.css |

---

## 6. Habits (HAB)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-HAB-001 | The system shall show a Habits page titled "Habits" with a sub-title "<d> of <n> done today" (or "yesterday", or "on <date>" when a past day is shown) followed by " · <w> of <m> weekly & monthly" when such habits exist, or "Build routines that stick" when there are none. | Must | habits.js |
| FR-HAB-002 | When there are no habits the system shall show "Start your first habit" with four starters: "Solat 5 waktu" (five habits Subuh, Zohor, Asar, Maghrib, Isyak), "Baca Al-Quran" (5 pages a day), "Exercise" (30 min a day) and "Tidur 6 jam" (6 hours of sleep read from Health). | Should | habits.js |
| FR-HAB-003 | Choosing a starter shall show a confirmation listing what will be added ("Add N habits?" / "Add “<name>”?"), skip habits whose name already exists (case-insensitive) with a note, and show "Already added" when all exist. | Should | habits.js |
| FR-HAB-004 | The system shall open "New habit" with Name (required, up to 80 characters), an icon (24 choices), a colour, Frequency (Daily, Weekly, Monthly) and an optional reminder time; "Edit habit" opens the same window for an existing habit. | Must | habits.js, habits.html |
| FR-HAB-005 | For a daily habit the system shall let the person choose the weekdays (Monday first) and shall refuse to save with none chosen ("Pick at least one day."). | Must | habits.js, habits table check |
| FR-HAB-006 | For a weekly or monthly habit the system shall ask "Times per week/month" and accept whole numbers 1 to 7 (weekly) or 1 to 31 (monthly), otherwise "Times per week must be between 1 and 7." / "Times per month must be between 1 and 31.". | Must | habits.js, migration 017 |
| FR-HAB-007 | For a daily habit the system shall offer three modes: "Tick off"; "Amount" (a daily amount above 0 and an optional unit up to 20 characters, e.g. 5 pages); "Sleep (Health)" (hours of sleep needed, default 6, read from the Health sleep log); a missing amount shows "Enter the daily amount (a number above 0)." or "Enter how many hours of sleep you need."; weekly and monthly habits are always "Tick off". | Must | habits.js |
| FR-HAB-008 | The system shall keep an optional note ("target", up to 40 characters in the database) for tick-off habits and show it on the row. | Could | habits.js, migration 016 |
| FR-HAB-009 | When the name matches another habit the system shall ask "You already have “<name>”" ("Add another habit with the same name?") before saving. | Should | habits.js |
| FR-HAB-010 | The system shall show on each habit row the icon, the name, the current streak ("N day/week/month streak"), a detail line (amount "x/goal unit", "slept Nh · goal Nh+", "n/times this week", the note, "rest day", the reminder time) and a check button. | Must | habits.js |
| FR-HAB-011 | The check button shall, for a tick-off habit, mark the chosen day done or, when already done, undo it; for an amount habit ask "How many <unit> today? Goal: N. Enter 0 to clear." (0 removes the tick; a negative or non-numeric value shows "Please enter a number." with the title "Invalid amount"); for a sleep habit go to the Health page. | Must | habits.js |
| FR-HAB-012 | The system shall count an amount habit as done on a day when the logged amount is at least the goal, and a sleep habit as done when the Health sleep hours for that day are at least the goal (6 when empty). | Must | habits.js (hLogged) |
| FR-HAB-013 | The system shall measure a weekly habit by calendar week (Monday to Sunday) and a monthly habit by calendar month, counting the days done inside the period; the period is done when the count reaches "times per period"; for a once-a-period habit a tick on any day marks it done and tapping again removes every tick of that period. | Must | habits.js |
| FR-HAB-014 | The system shall show seven small squares for each habit (the last seven days, weeks or months), filled in the habit's colour when that period was done, and shall let a tap on a square toggle that period. | Should | habits.js |
| FR-HAB-015 | The system shall work out the streak as the number of consecutive finished periods ending now: the current period counts once it is done and never breaks the streak while it is still pending; a daily habit's days that are not scheduled (rest days) do not break the streak; the best streak over the loaded history (365 days) is shown beside Consistency. | Must | habits.js (hRuns) |
| FR-HAB-016 | The system shall let the person go back up to 14 days with the previous / next day buttons, a day picker or "Back to today", shall label the view "Yesterday" or the date with "· editing past day", shall not allow future days, and shall apply ticks to the chosen day. | Must | habits.js |
| FR-HAB-017 | The system shall show a "Consistency" calendar for a month: one box per day, shaded blue in proportion to the share of daily habits done that day (grey for 0%, dim for future days, a mark for today), with the tooltip date and percentage, month buttons and a picker limited to the current month and the 11 months before it, and the "Best streak" figure. | Should | habits.js |
| FR-HAB-018 | The system shall show a "This week" bar chart (Monday to Sunday) of the share of daily habits done each day, with future days dimmed. | Should | habits.js |
| FR-HAB-019 | The system shall let the person delete a habit after the confirmation "Delete “<name>”?" ("It moves to your Deleted list (button at the top), stops reminding you and no longer counts in Consistency or best streak. You can restore it from there."); a deleted habit is archived, not erased. | Must | habits.js, habits.data.js |
| FR-HAB-020 | The system shall show a "Deleted (n)" button when habits are archived; its window lists them with the deletion date and the number of days done and a "Restore" button, and "Clear" erases all archived habits and their ticks for good after the confirmation "Clear N deleted habit(s)?"; current habits are not touched. | Should | habits.js, habits.data.js |
| FR-HAB-021 | The "Select" button shall switch to multi-select where rows are picked, "Select all" / "Deselect all" works, and "Delete (N)" archives the picked habits after confirmation; "Cancel" leaves the mode. | Should | habits.js |
| FR-HAB-022 | The system shall refuse a new habit when the number of habits that are not deleted has reached the plan limit (Dawn 5, Glow 10, Zenith unlimited): "Your <Plan> plan includes up to N habits. Upgrade to add more."; the database refuses with "Plan limit: …"; a starter that adds several habits is checked only by the database and shows its message. | Must | habits.js, migration 033 |
| FR-HAB-023 | The system shall run a job every minute that, for each habit with a reminder time that is not deleted, creates "⏰ <name>" at that minute in the person's time zone, only on the habit's scheduled weekdays (daily) and only if the habit is not already done for the day, week or month, with the body "Goal today: N unit.", "Log your sleep in Health to keep your streak going.", "Still to do this week — tick it off when it's done.", "Still to do this month — …" or "Time for your habit — tick it off when it's done."; the same habit is not reminded twice within 10 minutes. | Must | migration 028 |
| FR-HAB-024 | Habit reminders shall stop when "Habits" reminders are switched off in Settings (muted at the database) or the habit is deleted; opening one goes to Habits and highlights the habit. | Should | migration 035, ui.js |
| FR-HAB-025 | The Dashboard shall show the three habits with the longest current streaks, each with seven squares and the streak number. | Could | habits.js (paintDashHabits) |
| FR-HAB-026 | The system shall allow each person to read and change only their own habits and ticks; a tick can only be written for a habit the person owns. | Must | migration 016 |
| FR-HAB-027 | If habits cannot be read the system shall show "Could not load habits" with a hint to run migration 016; a save error about missing columns shows "Habits aren't fully set up — run supabase/migrations/016, 017 and 018 (habit_reminders) in the SQL Editor." | Should | habits.js |
| FR-HAB-028 | The system shall store habits with these rules: name 1 to 80 characters, 1 to 7 weekdays (0 to 6), period daily / weekly / monthly, times per period 1 to 31, goal above 0, unit up to 20 characters, source "manual" or "sleep", icon and colour in the allowed formats. | Must | migrations 016, 017 |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-HAB-001 | A tick shall appear immediately and be undone with an error message if the save fails. | Should | habits.js |
| NFR-HAB-002 | The Habits page shall fit phone widths from 320 px: the list and the Consistency calendar stack in one column. | Must | habits.css |
| NFR-HAB-003 | Streaks shall be computed in the browser from at most the last 365 days of ticks (10,000 rows); older history is not used. | Should | habits.data.js |

---

## 7. Health (HLTH)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-HLTH-001 | The system shall show a Health page titled "Health" with the buttons Reminders, Goals and Log entry, a sub-title with today's date and either "· last updated <time>" or "· nothing logged yet", and the tabs "Overview" and "Diary (n)". | Must | health.js |
| FR-HLTH-002 | The Overview shall show four rings for today — Sleep, Water, Steps, Active — each with the value ("—" when nothing is logged), the goal and the percentage of the goal (capped at 100). | Must | health.js |
| FR-HLTH-003 | The default daily goals shall be Sleep 8 h, Water 2,500 ml (shown as litres), Steps 10,000 and Active 45 min, and the default quick-add amounts 0.5 h, 250 ml, 500 steps and 10 min, until the person saves their own. | Must | health.data.js, migrations 011, 012 |
| FR-HLTH-004 | Each ring shall have a "+" button that adds the quick amount to today's total and a "−" button that takes it away, writing only that metric; "−" does nothing when the total is 0; a result above the daily maximum shows "That would go over the daily limit for this metric." with the title "Too much". | Must | health.js |
| FR-HLTH-005 | Tapping a ring (not its quick buttons) shall open the Log entry window for today with the cursor in that metric. | Should | health.js |
| FR-HLTH-006 | The Log entry window ("Log health entry", or "Edit entry" when that day has an entry) shall have a Date (required, not after today), optional Bedtime and Wake-up time, Sleep (hours), Water (ml), Steps, Active (minutes), a Mood choice of five faces (Low, Meh, Okay, Good, Great; tapping the chosen face again clears it) and an optional Note; choosing another date loads that day's entry. | Must | health.js, health.html |
| FR-HLTH-007 | When both bedtime and wake-up time are set the system shall fill Sleep with the hours between them (wake-up may be after midnight), to one decimal. | Should | health.js |
| FR-HLTH-008 | The system shall check values as they are typed: sleep 0 to 24 hours; water 0 to 20,000 ml, steps 0 to 200,000 and active 0 to 1,440 minutes, all whole numbers; a wrong value gets a red box and a message ("Enter a number.", "Must be between X and Y <unit>.", "Whole numbers only.") and Save stays disabled. | Must | health.js, migration 011 checks |
| FR-HLTH-009 | "Save entry" shall be enabled only after something was changed and the date is set, and shall save only the changed fields: a field not touched keeps its stored value; clearing a box stores empty. | Must | health.js, health.data.js |
| FR-HLTH-010 | The system shall keep one entry per person per day (a second save for the same day updates it) and show an out-of-range server error as "One of the values is out of range — please check the numbers." | Must | migration 011, health.js |
| FR-HLTH-011 | "Mood this week" shall show the faces for Monday to Sunday of the current week, the text "No mood logged" for a past day without mood and dim the days still to come. | Should | health.js |
| FR-HLTH-012 | The system shall show "Sleep · last 7 days" and "Steps · last 7 days" bar charts with the average ("avg / night", "avg / day"), a small dim bar for a day without data and a tooltip with the day and value. | Should | health.js |
| FR-HLTH-013 | "Recent entries" shall show the 3 newest days with the numbers, the mood, a note preview and "Last updated <time>", a pencil to edit and a bin to delete after the confirmation "Delete this entry?" ("Your <date> entry will be removed."). | Must | health.js |
| FR-HLTH-014 | The Diary tab shall list only days that have a note, grouped by month, with a search box ("Search your notes…") that filters by note text; editing opens the entry at the note; the bin removes only the note after "Remove this note?" (the numbers of that day stay); empty states say "No notes yet — add a note when you log an entry and it will appear here." or "No notes match your search.". | Should | health.js |
| FR-HLTH-015 | The Goals window ("Daily goals") shall let the person set Sleep (1 to 24 h), Water (500 to 20,000 ml), Steps (100 to 200,000), Active (5 to 1,440 min) and the four quick-add amounts (sleep 0.5 to 12 h, water 10 to 5,000 ml, steps 10 to 20,000, active 1 to 600 min); every box is required and above zero ("Every goal and quick-add amount needs a number above zero."); a server range error shows "One of the goals is out of range."; saving updates the rings. | Must | health.js, migrations 011, 012 |
| FR-HLTH-016 | The Reminders window ("Health reminders") shall have a switch for each of Water, Steps, Active and Sleep, with "Remind me every" (water 15 to 480 min; steps and active 30 to 720 min), From and Until times, and for Sleep a bedtime, wake-up time and a lead of 0 to 240 minutes; all four are off by default (water 60 min 08:00–22:00; steps and active 180 min 10:00–20:00; bedtime 23:00; wake-up 07:00; lead 30 min). | Must | health.js, migrations 013, 015 |
| FR-HLTH-017 | The system shall refuse to save reminders when an enabled reminder's "Until" is not later than "From" ('Water: "Until" must be later than "From".', same for Steps and Active) or when bedtime equals wake-up time ("Sleep: bedtime and wake-up time can't be the same."), and after saving shall show the toast "Reminders saved" listing what is on. | Must | health.js |
| FR-HLTH-018 | On Dawn the system shall show the standard reminder times (they cannot be changed; a note explains they are available on Glow and Zenith) and the database shall refuse other values with "Plan limit: choosing reminder times is available on Glow and Zenith. You can still switch each reminder on or off."; the on/off switches work on every plan. | Must | health.js, migration 039 |
| FR-HLTH-019 | A job running every minute shall create a notification for each enabled reminder when the minute is on its schedule (From, then every N minutes, up to Until) in the person's time zone, only while the goal is not yet reached, with the titles "💧 Time to drink water", "👟 Time to get some steps in", "🔥 Time to get moving" and "🌙 Time to wind down" and bodies such as "You've had 0.5 L of your 2.5 L goal — time for a glass.", "3,000 of 10,000 steps so far — a short walk will help.", "10 of 45 active minutes so far — a quick workout will help." and "Bedtime is 11:00 PM — wind down now to get about 8h before your 7:00 AM wake-up."; the same kind is not sent twice within 10 minutes. | Must | migrations 015, 028 |
| FR-HLTH-020 | While LUMA is open the page shall also check every 30 seconds and ask the database to create a due reminder (skipping a slot older than 10 minutes and a slot already marked on this device), so that a reminder is not sent twice. | Should | health.js, migrations 013, 015 (push_reminder) |
| FR-HLTH-021 | Health reminders shall stop when the "Health" reminder switch in Settings is off (muted at the database); opening a reminder goes to Health and highlights the matching ring. | Should | migration 035, ui.js |
| FR-HLTH-022 | The system shall let a sleep-type habit read the Health sleep hours (see FR-HAB-012). | Should | habits.js |
| FR-HLTH-023 | The system shall allow each person to read and change only their own health entries, goals and reminder settings. | Must | migrations 011, 013 |
| FR-HLTH-024 | If health data cannot be read the sub-title shows "Health isn't set up yet — run supabase/migrations/011_health.sql in the SQL Editor." | Should | health.js |
| FR-HLTH-025 | The Dashboard shall show today's sleep, water and mood and suggest logging water, sleep or mood when they are missing. | Could | dashboard.js |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-HLTH-001 | The four rings shall show two per row or one per row on phones with the quick buttons still tappable (at least a normal touch target), and the log and goals windows shall fit 320 px wide screens. | Must | health.css, responsive.css |
| NFR-HLTH-002 | Reminder times shall follow the person's time zone (Edit profile); Malaysia time is used when none is set. | Must | migration 028 |

---

## 8. Analytics and insights (ANA)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ANA-001 | The system shall show an Analytics page titled "Analytics" with a range switch "7 days" / "30 days" (default 7) and the sub-title "Last N days compared with the N days before". | Must | insights.js |
| FR-ANA-002 | The system shall show three rings — Productivity score, Task completion and Habit consistency — each with a percentage ("—" when there is no data) and a pill "+N pts vs last" / "-N pts vs last" or "No earlier data". | Must | insights.js |
| FR-ANA-003 | Task completion shall be the share of tasks whose due date falls in the period that are done ("N of M due tasks done", or "No tasks due in this period"). | Must | insights.js (anCalc) |
| FR-ANA-004 | Habit consistency shall be the average over the days of the share of daily habits scheduled that day, created on or before it, that were done; "No habits yet" shows when there are none. | Must | insights.js |
| FR-ANA-005 | Health progress shall be the average of each logged day's goal ratios (sleep, water, steps, active, each capped at 100%) and the Productivity score shall be the average of task completion, habit consistency and health progress that have data. | Must | insights.js |
| FR-ANA-006 | The system shall show two bar charts per period: "Tasks completed by day" (by completion date, with the total) and "Habit consistency by day", labelled by weekday for 7 days and by date every fifth day for 30 days. | Should | insights.js |
| FR-ANA-007 | "Completed tasks by tag" shall list the tags of tasks completed in the period with count and percentage, or "No tasks completed in this period." | Should | insights.js |
| FR-ANA-008 | "Spending by category" shall add up expenses and bills paid in the period (dated by the day paid; subscriptions as "Subscriptions", other bills as "Bills & utilities"), show the six largest categories, the total and, when there is any, the income of the period; an empty period says "No spending recorded in this period." | Must | insights.js |
| FR-ANA-009 | The system shall load tasks, habits (last 365 days), health (last 70 days), health goals, money (24 months) and bills for the page, and treat a failed load of any as empty. | Should | insights.js |
| FR-ANA-010 | The system shall write rule-based insights only where the data supports them, at most six: the weekday with most completed tasks, the number of overdue tasks (or "Nothing is overdue. Nice work keeping up."), the change in habit consistency, the change in spending, the health goal percentage, and a prompt to log more data when fewer than three exist. | Should | insights.js |
| FR-ANA-011 | The "Lumi's insights" card shall have a button "Get AI insights" ("Refresh with AI" once insights exist) that sends only the computed numbers (period, scores, task counts, spending, income, the top five categories, overdue count) to Lumi and shows the 3 or 4 short lines returned (each under 140 characters, "Written by Lumi (AI) from your numbers."); the result is kept in the browser for the same day and range. | Must | insights.js, lumi/index.ts |
| FR-ANA-012 | The AI insights allowance shall follow the plan: Dawn 0 (the card says "AI insights are on the Glow and Zenith plans" and the button opens "Not in your plan … available on the Glow and Zenith plans"), Glow 3 a day, Zenith 10 a day; the card shows "N of M AI insights left today" (amber at 2 or fewer, red at 0), the button is disabled at 0 with the title "You have used all your AI insights for today", and the allowance renews at midnight in the person's time zone. | Must | insights.js, lumi/index.ts, migrations 029, 033 |
| FR-ANA-013 | The server shall refuse an insights request with "AI insights are available on the Glow and Zenith plans. Upgrade in Settings → Plans." (status 403) when the plan allowance is 0 and with "Insight limit reached for today." (status 429) when it is used up; checking the allowance shall not use one. | Must | lumi/index.ts |
| FR-ANA-014 | When Lumi cannot produce insights the page shall show the error (and its detail, up to 600 characters) in an alert and keep the button usable; a failed request shall not cost one of the day's insights. | Should | insights.js, lumi/index.ts |
| FR-ANA-015 | The insights counter shall be separate from the chat counter. | Must | migration 029 (assistant_usage kind) |
| FR-ANA-016 | A weekly review job shall run hourly and, for each person who has not turned "Weekly review" off, at Sunday 18:00 in their time zone, create "📊 Your week in review" with the body "You finished N task(s)[, with M still overdue] and spent RMx. Open Analytics for the full picture." (tasks completed in 7 days; expenses and bills paid in 7 days), at most once in 5 days; it opens Analytics. | Should | migration 060, settings.js |
| FR-ANA-017 | The Dashboard productivity widget shall use the same calculation for the last 7 days against the 7 before. | Could | dashboard.js |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-ANA-001 | Insight requests shall send at most 6,000 characters of metrics and never personal text such as task titles or note contents. | Must | lumi/index.ts, insights.js |
| NFR-ANA-002 | The charts shall fit 320 px wide screens without sideways scrolling (three rings become one column). | Must | insights.css |

---

## 9. Split expenses (SPL)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SPL-001 | The system shall let only Zenith people create and edit splits; a Dawn or Glow person who has no splits sees "Split expenses is a Zenith feature" with a "See plans" button, and "New split" or "Edit" opens the plans window instead of the form. | Must | split.js, migration 064 |
| FR-SPL-002 | A person who is in a split made by someone else (or whose plan was lowered) shall still see and use the splits they are in. | Must | split.js, migration 064 |
| FR-SPL-003 | The page "Split expenses" shall show "Owed to you" and "You owe" totals and, per person, who owes whom after netting open shares ("<First name> owes you RMx" / "You owe <First name> RMx"). | Must | split.js |
| FR-SPL-004 | The system shall list splits under the filters "Open", "Settled" and "All"; a split is settled when every member other than the payer is marked paid; an empty list says "No splits yet. Tap “New split” to add your first one." or "Nothing here.". | Must | split.js |
| FR-SPL-005 | Each split row shall show the title, the date, who paid, the number of people, the tax label with the amount before tax, the total, the person's own share ("You owe RMx" / "You paid your RMx") and an "Open" or "Settled" tag; tapping the row shows each person's share, status ("paid the bill", "paid back", "not paid yet") and the note. | Must | split.js |
| FR-SPL-006 | The "New split" window shall have: What was it for? (required, up to 80 characters), Tax chips (No tax, SST 6%, SST 8%, Service charge 10% + SST 6%, Sales tax 5%, Sales tax 10%, Other with a typed percentage), Total before tax and Total after tax, Date, Split with (the person and their accepted contacts as ticks), How to split (Equally, Exact amounts, By percent, By shares), Who paid? and Note (up to 300 characters). | Must | split.js, split.html |
| FR-SPL-007 | The money boxes shall fill from the right (typing 1, 2, 3 shows 0.01, 0.12, 1.23, up to 10 digits). | Should | split.js |
| FR-SPL-008 | When a tax is chosen, typing either total shall work out the other (service charge then tax are applied to the amount, rounded to cents); with "No tax", typing both makes the difference the tax; the after-tax total is never below the before-tax total. | Must | split.js (spTotals) |
| FR-SPL-009 | "Equally" shall divide the amount before tax by the people ticked, giving the extra cents to the first people; tax is then added to each person's part and leftover cents are given out so the shares add up exactly to the final total. | Must | split.js (spCalc) |
| FR-SPL-010 | "Exact amounts" shall require the amounts to add up to the total before tax (the summary shows "RMx still to assign" or "RMx over the amount", and "Adds up" when correct). | Must | split.js |
| FR-SPL-011 | "By percent" shall start with equal percentages and require 100% (within 0.05; otherwise "Percentages add up to N%, they should be 100%"); "By shares" shall start with 1 share each (up to three digits) and require at least one positive share ("Enter the shares for each person."). | Must | split.js |
| FR-SPL-012 | Saving shall be refused with a message when the name is empty ("Give the split a name."), the total is not above 0 ("Enter a total, either before or after tax."), nobody but the person is ticked ("Pick at least one person to split with.") or the amounts are not complete. | Must | split.js |
| FR-SPL-013 | The database shall accept a split only when: the person is Zenith ("Plan limit: splitting expenses is a Zenith feature. Upgrade your plan in Settings."); the name is 1 to 80 characters; the total is above 0; the way is equal, exact, percent or shares; 2 to 13 members ("Pick between 1 and 12 people to split with"); every other member is in the person's contacts ("You can only split with people in your contacts"); no one appears twice; no share is negative; the shares add up to the total within RM0.01 ("The shares add up to RM x, but the total is RM y"); and the payer is a member ("The person who paid must be in the split"). | Must | migration 064 |
| FR-SPL-014 | The payer shall be the person or any other ticked member ("Who paid?"); when the person pays but is not sharing the cost they are kept in the split with a share of 0. | Must | split.js |
| FR-SPL-015 | Saving shall show the toast "Split saved" or "Split updated" and notify every other member "🧾 <Name> split "<title>" with you" (or "updated the split") with their share and who paid. | Must | split.js, migration 064 |
| FR-SPL-016 | The creator's own share shall be added to Money as an expense with the category "Split", named after the split and dated like it (none when the share is 0), and shall follow later edits and be removed when the split is deleted; other members get no Money entry. | Must | migration 064 |
| FR-SPL-017 | Only the person who paid shall be able to mark a share as paid back ("Mark as paid") or undo it ("Undo"); the member is notified "✅ <Name> marked your share as paid"; anyone else is refused with "Only the person who paid can mark shares as paid"; the payer cannot mark their own share. | Must | split.js, migration 064 |
| FR-SPL-018 | The payer shall be able to send a reminder ("Remind") to a member who has not paid, at most once every 6 hours: the toast says "Reminder sent", or "Already reminded — You can remind again after 6 hours.", or "Nothing to remind"; the member gets "👋 <Name> is waiting for your share". | Should | split.js, migration 064 |
| FR-SPL-019 | Only the creator shall be able to edit a split; the edit window shows the saved amounts as exact amounts; a member whose share did not change keeps the "paid" mark when the payer is unchanged; others get the "updated" notice; anyone else is refused with "Only the person who created this split can change it". | Must | split.js, migration 064 |
| FR-SPL-020 | Only the creator shall be able to delete a split, after the confirmation "Delete “<title>”?" ("Everyone in it is told, and your share is removed from Money. This can't be undone."); members are told "🗑️ <Name> deleted the split"; members and the Money entry go with it; others are refused with "Only the person who created this split can delete it". | Must | split.js, migration 064 |
| FR-SPL-021 | A person shall see only splits they created or are a member of; the split tables cannot be read or written directly, only through the database functions. | Must | migration 064 |
| FR-SPL-022 | Marking paid, reminding and deleting shall not require the Zenith plan (a Glow person who paid can mark shares paid); creating and editing shall. | Must | migration 064 |
| FR-SPL-023 | The list shall show at most the 300 newest splits (by split date, then creation). | Could | migration 064 |
| FR-SPL-024 | A split notification shall open Split expenses with the split expanded. | Should | ui.js, migration 070 |
| FR-SPL-025 | If the database functions are missing the page shows "Split expenses will work once your database is up to date." | Should | split.js |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-SPL-001 | Amounts shall be calculated in whole cents so that the shares always add up to the total with no rounding gap. | Must | split.js, migration 064 |
| NFR-SPL-002 | The New split window shall scroll inside itself and fit 320 px wide screens with all buttons reachable. | Must | split.css |

Notes: the way a split was divided (percent, shares) is not kept for editing; only the amounts are, so Edit always starts in "Exact amounts".

---

## 10. Purchase history (PUR)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-PUR-001 | The system shall provide a page "Purchase history" opened from Settings, with a "Settings" button that returns to Settings. | Must | purchases.js |
| FR-PUR-002 | Each row shall show the item ("<Plan> plan" or "<Add-on> add-on" with its icon), the action, the date and time of the change and, for actions that run until a date, "until <date>" (the last day, one second before the stored end). | Must | purchases.js |
| FR-PUR-003 | The actions shall be shown as: "Free trial started", "Switched on", "Time added", "Switched off" and "Ended". | Must | purchases.js |
| FR-PUR-004 | The page shall have filters "All", "Plans", "Add-ons" and "Trials". | Should | purchases.js |
| FR-PUR-005 | The list shall be newest first, 40 rows at a time, with a "Show older" button while a full page was returned. | Should | purchases.js |
| FR-PUR-006 | Empty states shall say "Nothing yet. Trials, plans and add-ons will be listed here." and "Nothing in this filter."; a load error shows "History will appear here once your database is up to date." | Should | purchases.js |
| FR-PUR-007 | The database shall add a history row automatically when an add-on is started, extended, removed or a trial starts, and when a plan starts, is extended, is removed or ends at expiry; a person cannot write history. | Must | migration 063 |
| FR-PUR-008 | A person shall read only their own history. | Must | migration 063 |
| FR-PUR-009 | The migration shall back-fill one "started" or "trial" row for each existing add-on and one "started" row for each existing paid plan that had none. | Could | migration 063 |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-PUR-001 | Rows shall wrap on 320 px wide screens without cutting the date or the "until" line. | Should | purchases.css |

---

## 11. Lumi assistant (LUMI)

Lumi runs in the Edge Function `lumi` (a free-tier AI model, Gemini first and Groq as a fallback). Every tool runs as the signed-in person, so row-level security keeps Lumi inside that person's own data. This section covers the tools used in Personal mode; the Work and Study tools (`create_work_project`, `add_work_tasks`, `update_work_task`, `move_work_task`, `move_work_project`, `log_work_time`, `work_timer`, `add_study_items`, `add_study_subjects`, `add_study_classes`, `update_study_items`, `update_study_subject`, `update_study_class`) belong to the Work and Study parts.

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-LUMI-001 | The system shall offer Lumi in two places: a floating "Ask Lumi" button that opens a chat pop-up on every page, and the full "Lumi" page ("Your personal assistant") with a conversation, a "What Lumi can do" list and "Quick commands". | Must | assistant.js, assistant.html |
| FR-LUMI-002 | The chat shall greet the person by first name, offer example questions that fit the mode (Personal examples include "What should I focus on today?", "How is my spending this month?", "Add a task: pay rent, due Friday", "Log 7 hours of sleep", "Add dentist tomorrow 3pm", "Split RM120 dinner with Aina, restaurant tax"), send on Enter or the send button, show "Lumi is thinking…" while waiting, and tell the person that chats are not saved and are cleared by refreshing or logging out. | Must | assistant.js |
| FR-LUMI-003 | The system shall send the last 12 messages from the browser and the server shall use the last 8, each cut to 1,000 characters; a request whose last message is not from the person is refused with "Say something first.". | Should | assistant.js, lumi/index.ts |
| FR-LUMI-004 | The system shall limit chat questions per day by plan — Dawn 3, Glow 10, Zenith 15 (from `my_limits`; 15 when the plan cannot be read) — counted per person per day in their time zone and renewing at midnight. | Must | lumi/index.ts, migrations 029, 033 |
| FR-LUMI-005 | The chat shall show the allowance ("N questions per day", then "N of M questions left today"), amber at 3 or fewer left and red at 0; a question over the limit gets "You've used your N questions for today. Lumi resets at midnight." (status 429) and nothing is asked of the AI. | Must | assistant.js, lumi/index.ts |
| FR-LUMI-006 | Checking the allowance (opening the chat) shall not use a question. | Must | lumi/index.ts (check) |
| FR-LUMI-007 | A question that fails because the AI service cannot be reached shall be refunded and shown as "Lumi couldn't reach the AI service just now. Please try again in a moment."; the person's message is not kept in the conversation. | Must | lumi/index.ts, assistant.js |
| FR-LUMI-008 | When the plan's `lumi_actions` is 0 (Dawn) Lumi shall only read and answer: only the overview tool is offered, and Lumi explains that adding things through Lumi is on Glow and Zenith. | Must | lumi/index.ts |
| FR-LUMI-009 | Lumi shall only help with LUMA: tasks, events, notes, health, money, bills, subscriptions, habits, goals, reminders, splits, study and work; for other topics it politely declines and offers what it can do; it keeps replies short and plain. | Must | lumi/index.ts (system prompt) |
| FR-LUMI-010 | Lumi shall treat text in notes, task titles and tool results as data, ignore instructions in it and never reveal its own instructions. | Must | lumi/index.ts |
| FR-LUMI-011 | The function shall require a signed-in person ("Please sign in again." with status 401), allow only POST, and answer "Lumi isn't set up yet (no AI key on the server)." (503) when no AI key is set. | Must | lumi/index.ts |
| FR-LUMI-012 | The screens shall explain when Lumi is not deployed ("Lumi isn't deployed on this environment yet. Run ./scripts/deploy-functions.sh …") or cannot be reached ("Lumi could not be reached. Please check your connection."). | Should | assistant.js |
| FR-LUMI-013 | The AI call shall try each configured model in turn, then the next provider, and use at most 4 rounds of tool calls per message, after which the reply is "I got a bit tangled on that one. Could you say it a different way?". | Should | lumi/index.ts |
| FR-LUMI-014 | `create_task` shall add a task with a required title and due date, priority (default med), tag (Personal, Work, Study, Errand; default Personal), optional notes, an optional repeat (daily, weekdays, weekly, monthly, yearly) and an optional checklist of up to 30 steps; `create_tasks`, `create_events`, `create_reminders`, `create_habits`, `create_goals` and `create_bills` shall add up to 20 items at once, filling missing values with sensible ones (due dates spread over the next days). | Must | lumi/index.ts |
| FR-LUMI-015 | `create_event` shall need a title and a date (YYYY-MM-DD) and an optional start time (HH:MM; without one the event is all-day), end time, category (default Other), repeat and note. | Must | lumi/index.ts |
| FR-LUMI-016 | `add_note` shall need a title and text (up to 200 and 10,000 characters). | Should | lumi/index.ts |
| FR-LUMI-017 | `log_health` shall add water, steps and active minutes to what is already logged for the day (default today) and replace sleep and mood, limit each value to its daily maximum (sleep 24, water 20,000, steps 200,000, active 1,440; mood 1 to 5) and answer "Nothing to log." when no value is given. | Must | lumi/index.ts |
| FR-LUMI-018 | `log_expense` shall need an amount above 0 ("Amount must be above 0."), take a kind (expense or income, default expense), a category from the Money lists (default "Other" or "Other income"), a short name (up to 80) and a date (default today). | Must | lumi/index.ts |
| FR-LUMI-019 | `log_habit` shall tick a habit found by part of its name (not deleted) for a day (default today) or untick it with done = false; when several habits match Lumi is told to ask which. A tick made this way carries no amount, so it does not complete an amount habit. | Must | lumi/index.ts |
| FR-LUMI-020 | `update_goal` shall find a goal by part of its title and either add an amount or set a new total (never below 0), set a new deadline, and complete the goal when the target is reached. | Must | lumi/index.ts |
| FR-LUMI-021 | `create_goals` shall use a target of 100 when none valid is given and a category from the six (default Personal); `create_bills` shall use recurrence monthly, category Other and a due date 7 days (plus 1 per extra item) ahead when none is given and skip items without a name or an amount above 0. | Should | lumi/index.ts |
| FR-LUMI-022 | `mark_bill_paid` shall find a bill by part of its name and mark the first unpaid due date within 31 days before to 31 days after today (the bill's amount), or with paid = false remove the latest payment; it answers "<name> has nothing unpaid right now." or "Nothing marked as paid to undo." when there is nothing to change. | Must | lumi/index.ts |
| FR-LUMI-023 | `update_item` shall change one existing task (done, in progress, to do, priority, due date, title), event (date, start and end time, note), reminder (date, time, on or off) or note (text or text added at the end) found by part of its title in the current mode; if several match, nothing is changed and the titles are listed so Lumi can ask which; with no change it answers "Nothing to change.". | Must | lumi/index.ts |
| FR-LUMI-024 | `delete_items` shall delete only the person's own items of an allowed kind (tasks, events, reminders, notes, money entries, habits, goals, bills, and the study kinds) in two steps: first a preview with the count and up to 10 titles (at most 50 found), stored for that person; then, only after a clear "yes" in the person's next message (at most 40 characters and starting with yes, ok, sure, confirm, go ahead, do it, proceed or delete), the deletion of exactly the previewed items; a preview older than 15 minutes, a confirmation in the same message as the preview or without a preview is refused. | Must | lumi/index.ts, migration 051 |
| FR-LUMI-025 | `delete_items` shall need a filter (a word in the title, finished ones, or before a date) or "all" and shall only touch the current mode's items; an unknown kind is refused with "I can't delete that kind of item.". | Must | lumi/index.ts |
| FR-LUMI-026 | `split_expense` shall split an amount (before tax) with people found by name among the person's accepted contacts, with an optional tax (none, SST 6%, SST 8%, service charge 10% + SST 6%, sales tax 5%, sales tax 10%), who paid (default the person), whether the person shares (default yes) and optional exact pre-tax amounts that must add up to the amount; it refuses unknown or ambiguous names ("… is not in the user's contacts. Splits can only include contacts.") and non-Zenith people (the database message about the Zenith plan). | Must | lumi/index.ts, migration 064 |
| FR-LUMI-027 | `mark_split_paid` shall mark (or unmark) one person's share paid in a split the person paid for, found by part of the title and the name; ambiguous matches are listed. | Should | lumi/index.ts |
| FR-LUMI-028 | `get_overview` shall return, for answering questions, the open tasks (25), events of the next 14 days (25), this month's money entries (spent, income, by category), the last 7 days of health and the health goals, bills and subscriptions (30), habits with ticks of the last 7 days, goals (30), active reminders (25), recent notes (15), split totals (open splits, owed to you, you owe, net by person), bills paid this month, and Work and Study data when those exist; lists are capped, so answers about very large data are based on the newest items. | Must | lumi/index.ts |
| FR-LUMI-029 | Everything Lumi creates shall obey the same plan limits (habits, goals, bills, reminders) and the same mode rules as the screens: items are filed under the current mode, and a limit error is reported honestly ("Plan limit: …"). | Must | lumi/index.ts, migrations 033, 050 |
| FR-LUMI-030 | After Lumi has saved something the page shown shall refresh (the dashboard reloads; any other page except the Lumi page is opened again) so the new data is visible. | Should | assistant.js |
| FR-LUMI-031 | When the person asks to add something without saying what, the page they are on decides first (Reminders → reminders, Tasks → tasks, Calendar → events, Health → a health log, Money → an expense, Notes → a note), then the mode. | Should | lumi/index.ts (system prompt) |
| FR-LUMI-032 | Lumi shall not ask follow-up questions about missing details but fill them in sensibly and say what it assumed, asking only when it cannot tell what is wanted. | Could | lumi/index.ts |
| FR-LUMI-033 | The Dashboard "Suggestion" card shall choose one suggestion in this order: overdue tasks (start with the oldest), overdue bills, more than 5 tasks due today, habits still to tick today; it has "Open" and "Not now" buttons ("Not now" hides it until the dashboard is reloaded) and is hidden when "Proactive AI suggestions" is off in Settings or nothing applies. | Should | dashboard.js, settings.js |
| FR-LUMI-034 | The Dashboard "Tip for today" shall show one tip chosen from those that apply to the person's data (for example no budget set, over budget, over 80% of budget, no water logged, no habits, no bills, overdue bills) plus general ones including prompts to try Lumi and AI insights, changing every 20 seconds while the dashboard is open, and be hidden when "Proactive AI suggestions" is off. | Could | dashboard.js |
| FR-LUMI-035 | Lumi shall use the plan limits read from `my_limits` (lumi_questions, insights, lumi_actions) and fall back to 15 questions, 10 insights and actions allowed when they cannot be read. | Should | lumi/index.ts |
| FR-LUMI-036 | Lumi shall know who the person is from their LUMA profile: the name from Settings → Profile (first and last name, falling back to the Google / Apple sign-in name), so it addresses them by first name; their plan and active Study / Work add-ons; and, if their birthday (Settings → Profile) is today, it wishes them a happy birthday once at the start of a conversation. The e-mail address, the birthday date and other people's data are not given to it beyond that; a missing profile or a missing birthday column must not stop Lumi from answering. | Should | supabase/functions/lumi/index.ts |

**NFR**

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-LUMI-001 | Lumi shall never read or change another person's data: every database call uses the person's own token. | Must | lumi/index.ts |
| NFR-LUMI-002 | The AI reply shall be limited to about 700 tokens and the tool result passed back to the model to 8,000 characters. | Should | lumi/index.ts |
| NFR-LUMI-003 | The Lumi page shall be a single column on phones (320 to 390 px) and the floating button shall not cover the last card of a page. | Must | assistant.css, responsive.css |
| NFR-LUMI-004 | Lumi's answers depend on a third-party free AI service; availability and wording are not guaranteed, which is why every action is also checked by the database rules. | Should | lumi/index.ts |
