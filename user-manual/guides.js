window.LUMA_GUIDES = [
  {
    "id": "login",
    "group": "Getting started",
    "title": "Sign in to LUMA",
    "summary": "Access your account and pick up where you left off.",
    "where": "Sign-in page",
    "steps": [
      "Enter the email address you used to create your account and your password.",
      "Use the eye icon if you need to check the password you entered.",
      "Leave Remember me selected on your own device. Clear it when you do not want the session remembered.",
      "Select Sign in. A verified account opens the application dashboard.",
      "If your email is not verified, follow the prompt to enter your verification code."
    ],
    "tips": [
      "LUMA uses email and password sign-in.",
      "Use Forgot password? if you cannot remember your password; creating another account is not necessary."
    ],
    "related": [
      "register",
      "verify-email",
      "reset-password"
    ],
    "sections": []
  },
  {
    "id": "register",
    "group": "Getting started",
    "title": "Create an account",
    "summary": "Set up your profile and verify your email before getting started.",
    "where": "Sign in → Create one",
    "steps": [
      "Enter your first and last name.",
      "Choose your country and check the suggested time zone. Your time zone affects dates and reminders.",
      "Optionally enter your birthday. You can change or remove it later in Settings.",
      "Enter an email address you can access. Enter a password of at least six characters and repeat it in Confirm password.",
      "Select the Terms of Service and Privacy Policy checkbox to enable Create account.",
      "Select Create account, then open your email and enter the six-digit verification code."
    ],
    "tips": [
      "If the form reports mismatched passwords, enter the same password in both fields.",
      "Use your existing account if you have already registered. If registration is refused, try signing in or resetting your password."
    ],
    "related": [
      "verify-email",
      "login",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "verify-email",
    "group": "Getting started",
    "title": "Verify your email",
    "summary": "Confirm that you own the email address used for your account.",
    "where": "After registration, or the verification prompt at sign-in",
    "steps": [
      "Check the email address shown on the verification page. If the page asks for an email, enter the address you registered.",
      "Open the verification email and copy its six-digit code.",
      "Enter the code and submit the verification form.",
      "After successful verification, LUMA signs you in.",
      "If you do not receive the message, check spam or junk, then use Send a new code after the displayed countdown ends."
    ],
    "tips": [
      "Use the most recent code. If it is rejected or expired, request another one.",
      "If you mistyped your address, use Wrong email? Start over."
    ],
    "related": [
      "register",
      "login"
    ],
    "sections": []
  },
  {
    "id": "reset-password",
    "group": "Getting started",
    "title": "Reset your password",
    "summary": "Recover access through the reset link sent to your email.",
    "where": "Sign in → Forgot password?",
    "steps": [
      "On the sign-in page, enter your account email and select Forgot password?.",
      "Open the password-reset email and follow its link to LUMA.",
      "Enter a new password and repeat it in the confirmation field.",
      "Select Update password and wait for the save to finish.",
      "When redirected to sign-in, use the new password."
    ],
    "tips": [
      "Opening the reset page without a valid reset link may show a missing or expired session message. Request a fresh email and use that link.",
      "If you are already signed in, you can request the same reset email under Settings → Account & data."
    ],
    "related": [
      "login",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "dashboard",
    "group": "Getting started",
    "title": "Find your way around",
    "summary": "Use your dashboard to decide what needs attention today.",
    "where": "Side menu → Dashboard",
    "steps": [
      "Read the summary under the greeting for overdue tasks, events, spending and habit progress.",
      "Use Quick actions to add a task, log an expense, create an event or write a note.",
      "Check Today’s Schedule, Today’s Priorities and Upcoming Reminders. Scroll inside a list to see more entries.",
      "Open a card’s page link to manage the underlying items.",
      "Use the mode switcher at the top of the menu to move between Personal, Work and Study.",
      "Use the search icon, or Ctrl+K / Command+K, to find a page or an item."
    ],
    "tips": [
      "Items belong to the mode in which you create them. Settings → Preferences controls whether Work or Study items also appear in Personal.",
      "A locked mode means the corresponding add-on is not available on your account. Dashboard cards fill up as you add data."
    ],
    "related": [
      "tasks",
      "calendar",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "tasks",
    "group": "Personal",
    "title": "Tasks & checklists",
    "summary": "Break work into clear actions and move each task towards completion.",
    "where": "Personal → Tasks & Work",
    "steps": [
      "Choose the add-task control in the appropriate status column.",
      "Enter a title. Set the priority, tag and due date when needed.",
      "Add notes and checklist steps for smaller actions within the task.",
      "Choose a repeat schedule if this task should recur, then save.",
      "Open a task to edit its details or tick checklist steps.",
      "Use the status chip to choose To do, In progress or Done. The forward action advances its status.",
      "For a repeating task, completing it creates the next occurrence. Check its next due date."
    ],
    "tips": [
      "Overdue tasks are highlighted so you can find them quickly.",
      "If an Undo message appears after deletion, use it immediately to restore the task."
    ],
    "related": [
      "dashboard",
      "reminders",
      "calendar"
    ],
    "sections": []
  },
  {
    "id": "calendar",
    "group": "Personal",
    "title": "Calendar & events",
    "summary": "Plan appointments, review deadlines and invite your contacts.",
    "where": "Side menu → Calendar",
    "steps": [
      "Navigate to the date you want to plan and choose the new-event control.",
      "Enter an event title, category and date.",
      "Choose all-day or set the start and end time. Set a repeat schedule if needed.",
      "Add notes. Use Add from contacts if other people should receive an invitation.",
      "Save the event. Open it again to edit the details or review invitation responses.",
      "Use Export to download an .ics calendar copy for another calendar application."
    ],
    "tips": [
      "An exported calendar is a snapshot; later edits in LUMA do not automatically update it.",
      "Amber and red busy-day indicators reflect workload and overlapping activities. Adjust their sensitivity in Settings → Preferences."
    ],
    "related": [
      "contacts",
      "reminders",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "reminders",
    "group": "Personal",
    "title": "Reminders",
    "summary": "Create a reminder for a one-off action or a regular routine.",
    "where": "Side menu → Reminders",
    "steps": [
      "Open the add-reminder form and enter a title.",
      "Add a note describing what you need to do.",
      "Choose the starting date, reminder time and recurrence option.",
      "For a recurring reminder, review the selected weekdays or monthly rule before saving.",
      "Save and check that the reminder appears in the list.",
      "Edit or pause a reminder when your schedule changes."
    ],
    "tips": [
      "One-off and repeating reminders on this page are separate from built-in task, bill and class reminder preferences.",
      "Your profile time zone and notification permissions affect when and how you receive alerts."
    ],
    "related": [
      "notifications",
      "settings",
      "calendar"
    ],
    "sections": []
  },
  {
    "id": "money",
    "group": "Personal",
    "title": "Money & budgets",
    "summary": "Keep track of spending and compare it with your monthly budget.",
    "where": "Personal → Money",
    "steps": [
      "Select Income to review or enter the income information available on your plan.",
      "Select Budget and set your monthly budget.",
      "Select Log expense. Enter the amount, category, date and description, then save.",
      "Review the selected month’s spending and remaining budget.",
      "Open an existing expense when you need to correct its details.",
      "Check bill-generated entries before recording another expense for the same payment."
    ],
    "tips": [
      "Marking a bill as paid records spending in Money, so manually adding it again can double-count it.",
      "Available income options depend on your country and plan. Use your own payslip figures when entering payroll information."
    ],
    "related": [
      "bills",
      "subscriptions",
      "analytics"
    ],
    "sections": []
  },
  {
    "id": "bills",
    "group": "Personal",
    "title": "Bills & payments",
    "summary": "Track recurring payments and record when you have paid them.",
    "where": "Personal → Bills",
    "steps": [
      "Create a bill with its name, amount, category and due date.",
      "Choose the recurrence that matches how often you pay.",
      "Save the bill and review the upcoming due dates.",
      "When you pay it, use the paid control for that occurrence.",
      "Check Money to see the recorded expense.",
      "Edit the bill when its amount or schedule changes."
    ],
    "tips": [
      "Subscriptions and bills share underlying entries: a subscription is a bill in the Subscription category.",
      "Check the occurrence and payment date before marking it paid."
    ],
    "related": [
      "money",
      "subscriptions",
      "reminders"
    ],
    "sections": []
  },
  {
    "id": "subscriptions",
    "group": "Personal",
    "title": "Subscriptions",
    "summary": "See your recurring services and upcoming renewals in one place.",
    "where": "Personal → Subscriptions",
    "steps": [
      "Add a subscription with its service name, amount and next payment date.",
      "Select its recurrence and save.",
      "Review upcoming renewals and the recurring cost summary.",
      "Mark the relevant occurrence paid after paying the service.",
      "Pause a subscription when you want it excluded from the active bill list and totals."
    ],
    "tips": [
      "Pausing a subscription in LUMA does not cancel the service with its provider.",
      "You do not need to enter the same subscription separately in Bills."
    ],
    "related": [
      "bills",
      "money"
    ],
    "sections": []
  },
  {
    "id": "split",
    "group": "Personal",
    "title": "Split expenses",
    "summary": "Record a shared expense and track who has paid back their share.",
    "where": "Personal → Split expenses",
    "steps": [
      "Choose New split and enter the description and total amount.",
      "Select participants from your contacts and choose who paid.",
      "Choose equal shares, exact amounts, percentages or shares, then review each person’s amount.",
      "Save the split. Participants receive a notification and your share is recorded in Money.",
      "If you paid, open the split to mark repayments and send reminders."
    ],
    "tips": [
      "Creating splits requires Zenith. Participants on other plans can still see splits that include them.",
      "A repayment status is a record in LUMA; it does not transfer money."
    ],
    "related": [
      "contacts",
      "money",
      "notifications"
    ],
    "sections": []
  },
  {
    "id": "goals",
    "group": "Personal",
    "title": "Goals",
    "summary": "Set a measurable target and keep your progress up to date.",
    "where": "Personal → Goals",
    "steps": [
      "Select New goal or start from one of the suggested ideas.",
      "Enter the goal title, category, target amount and unit.",
      "Set a deadline and add a note if useful.",
      "Save the goal and update your current progress as you work towards it.",
      "Review completed and active goals to decide what to focus on next."
    ],
    "tips": [
      "Choose a unit you can measure consistently, such as books, kilometres or an amount saved."
    ],
    "related": [
      "habits",
      "dashboard"
    ],
    "sections": []
  },
  {
    "id": "habits",
    "group": "Personal",
    "title": "Habits & streaks",
    "summary": "Build a routine and record each time you complete it.",
    "where": "Personal → Habits",
    "steps": [
      "Select New habit or choose a starter habit.",
      "Enter its name and choose the schedule and target shown in the form.",
      "Set a reminder time if you want a prompt.",
      "Save, then use the habit’s completion control as you finish it.",
      "Review the history and streak to see how consistently you are following your routine."
    ],
    "tips": [
      "A habit’s own reminder time is managed with the habit. General reminder preferences are in Settings.",
      "Check the selected date before recording past completions."
    ],
    "related": [
      "goals",
      "health",
      "dashboard"
    ],
    "sections": []
  },
  {
    "id": "health",
    "group": "Personal",
    "title": "Health & daily logs",
    "summary": "Record your daily sleep, water, steps, activity and mood.",
    "where": "Personal → Health",
    "steps": [
      "Select Log entry and choose the date you are recording.",
      "Enter the measurements you want to track and add a note if helpful.",
      "Save and review the overview cards and history.",
      "Use the quick plus and minus controls for supported daily measurements.",
      "Open Goals to adjust your targets and Reminders to adjust prompts.",
      "Use the diary view to find previous notes."
    ],
    "tips": [
      "Check units before entering a value, especially water volume and sleep hours.",
      "You can correct an existing day’s entry instead of creating a second record for the same day."
    ],
    "related": [
      "habits",
      "analytics"
    ],
    "sections": []
  },
  {
    "id": "notes",
    "group": "Personal",
    "title": "Notes & attachments",
    "summary": "Save ideas, lists and reference material you want to find again.",
    "where": "Side menu → Notes & Docs",
    "steps": [
      "Create a note and enter its title and content.",
      "Add a tag to help organise it, then save.",
      "Use the available attachment control when a file belongs with the note.",
      "Open the note to edit it or use search to locate it later.",
      "Check the active mode before creating a note so it is filed in the right workspace."
    ],
    "tips": [
      "If you undo a deleted note, attached files are not restored with it.",
      "Study has its own Notes tab with contact-sharing controls."
    ],
    "related": [
      "documents",
      "study",
      "dashboard"
    ],
    "sections": []
  },
  {
    "id": "documents",
    "group": "Personal",
    "title": "Documents & categories",
    "summary": "Upload files, organise them and open or download them later.",
    "where": "Side menu → Documents",
    "steps": [
      "Choose the upload action and select your files.",
      "Choose a category when needed and finish the upload.",
      "Open a document to preview it. Use Download when the file type cannot be previewed.",
      "Use category management to create, rename or nest categories.",
      "Review the sharing controls carefully before granting another person access."
    ],
    "tips": [
      "File size and total storage limits depend on your plan; review the current limits in Settings.",
      "Account-data export lists document details but does not include the uploaded files themselves. Download important files separately."
    ],
    "related": [
      "notes",
      "contacts",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "contacts",
    "group": "Personal",
    "title": "Contacts & messages",
    "summary": "Connect with other LUMA users to chat and collaborate.",
    "where": "Side menu → Contacts",
    "steps": [
      "Select Add contact and enter the other person’s registered email.",
      "Send the request and wait for it to be accepted.",
      "Review incoming requests and accept the people you want to connect with.",
      "Use Message on an accepted contact to open the conversation.",
      "Use accepted contacts when inviting people to events, projects or shared notes.",
      "Use Nudge when available to send a notification that needs their attention."
    ],
    "tips": [
      "Adding a contact does not automatically give them access to all your data. Share or invite them to the specific item.",
      "Contact and daily message limits may vary by account and plan."
    ],
    "related": [
      "calendar",
      "work",
      "study"
    ],
    "sections": []
  },
  {
    "id": "assistant",
    "group": "Personal",
    "title": "Ask Lumi",
    "summary": "Ask questions about your information and request supported actions.",
    "where": "Side menu → Lumi, or the floating assistant button",
    "steps": [
      "Open Lumi and describe what you need in plain language.",
      "Include relevant dates, amounts or item names. For example: “What tasks should I focus on today?”",
      "Review the answer and ask a follow-up if you need a more specific result.",
      "On a plan with actions, try a request such as “Add a reminder to submit my timesheet tomorrow at 9 am.”",
      "Review any proposed deletion and confirm only when the listed items are correct.",
      "Open the relevant page to check the result of an action."
    ],
    "tips": [
      "Chats clear when you refresh or sign out. Copy any answer you want to keep.",
      "Lumi uses an external AI service to respond using relevant account information. Review important answers and changes.",
      "Daily question limits and available actions depend on your plan."
    ],
    "related": [
      "tasks",
      "reminders",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "analytics",
    "group": "Personal",
    "title": "Analytics",
    "summary": "Review patterns across your tasks, habits, health and spending.",
    "where": "Personal → Analytics",
    "steps": [
      "Open Analytics and review the available summary cards and charts.",
      "Use the period or filter controls shown on the page.",
      "Compare the results with the records in the relevant module.",
      "If a chart is empty, add or check your records for the selected period.",
      "Use what you learn to adjust a budget, habit or goal."
    ],
    "tips": [
      "Charts reflect recorded data. Missing entries can make a trend incomplete."
    ],
    "related": [
      "money",
      "health",
      "habits"
    ],
    "sections": []
  },
  {
    "id": "work",
    "group": "Work",
    "title": "Projects, tasks & time",
    "summary": "Organise company work, collaborate with your team and record your hours.",
    "where": "Mode switcher → Work → Work",
    "steps": [
      "If prompted, create your first company. Confirm the active company before adding work.",
      "Choose New project. Use Project for the standard phases, or General for your own folders.",
      "Enter the project details and save. Invite collaborators from your contacts when needed.",
      "Create a task within the project, with dates, priority and assignees.",
      "Use the task checklist, comments and files to keep the work together. Use @ in a comment to mention a project member.",
      "Move tasks through To do, Doing, Review and Done. Switch between the available Board, List, Gantt and Timeline views.",
      "Open Time to start a timer or Log time manually. Choose the company and month before exporting a timesheet."
    ],
    "tips": [
      "Work and Work Pro offer the same features with different capacity limits. Shared-project limits follow the project owner.",
      "A viewer cannot edit a project. If an action is unavailable, check your project role and add-on access.",
      "Your project time can be visible to the project owner. General time entries are private to you."
    ],
    "related": [
      "company",
      "contacts",
      "settings"
    ],
    "sections": [
      {
        "title": "Use teams for assignments",
        "text": "Open Teams and create a team within a company. Add contacts as members. In a task, choose a team to select its people, then adjust individual assignees. People must also belong to the project before they can be assigned its tasks."
      },
      {
        "title": "Dependencies and time budgets",
        "text": "Use Waits for to identify tasks that must finish first. Review dependency warnings when changing dates. Set a time budget to compare the planned hours with time recorded against the task."
      },
      {
        "title": "Export a timesheet",
        "text": "In Time, select the month and company, then choose CSV or the printable timesheet. Check the recorded entries before exporting. A running timer is capped at 12 hours and a day cannot contain more than 24 logged hours."
      }
    ],
    "gallery": [
      {
        "id": "work-projects",
        "title": "Projects"
      },
      {
        "id": "work-tasks",
        "title": "Task board"
      },
      {
        "id": "work-teams",
        "title": "Teams"
      },
      {
        "id": "work-time",
        "title": "Time and timesheets"
      }
    ]
  },
  {
    "id": "company",
    "group": "Work",
    "title": "Manage companies",
    "summary": "Keep projects organised across different companies.",
    "where": "Work mode → Company",
    "steps": [
      "Open Company to see the companies available to you.",
      "Add a company and enter its details.",
      "Switch to a company before creating its projects or recording general time.",
      "Edit a company when its details change.",
      "Archive a company when you want to retain its records but stop changing them. Restore it to resume editing."
    ],
    "tips": [
      "Archived companies still count towards your company limit.",
      "Use the project Edit window to move a project to another company. Read deletion confirmations carefully before permanently removing records."
    ],
    "related": [
      "work",
      "settings"
    ],
    "sections": []
  },
  {
    "id": "study",
    "group": "Study",
    "title": "Set up your study workspace",
    "summary": "Build a semester, add subjects and plan your academic work.",
    "where": "Mode switcher → Study → Study",
    "steps": [
      "Open Semesters and create a semester with its name and dates. Make it active.",
      "Open Subjects and add each subject, including its code and credit hours where relevant.",
      "Open Timetable and select Add class. Choose the subject, weekdays, start and end time, and room.",
      "Choose how long the class repeats and save it.",
      "Add assignments, quizzes, tests or exams with their subject and due date. Set a due time when there is a specific deadline.",
      "Update each item’s status as you work, and record scores and weights when results arrive.",
      "Return to Overview to review upcoming classes and deadlines."
    ],
    "tips": [
      "Create or activate a semester before adding Study items. Only one semester is active at a time.",
      "Cancelled class dates and semester breaks help keep your timetable accurate.",
      "An exported timetable is a calendar copy, not a live sync."
    ],
    "related": [
      "studyarchive",
      "contacts",
      "settings"
    ],
    "sections": [
      {
        "title": "Attendance",
        "text": "After a class starts, use Present, Late or Absent on the overview. Select the same status again to clear it. In Subjects, open Attendance to review the percentage, change your goal and fill in previous classes."
      },
      {
        "title": "Grades and What if?",
        "text": "Record a score, maximum score and final-mark weight for assessed work. Credit hours affect GPA. Review the grade scale under Semesters and enter a final subject mark when appropriate. What if? lets you explore expected future scores without saving those simulated marks."
      },
      {
        "title": "Flashcards",
        "text": "Open Cards, create a subject deck and add question-and-answer cards. Bulk entry uses front | back on each line. During review, choose Again, Hard, Good or Easy to indicate how well you remembered the answer."
      },
      {
        "title": "Group projects and shared notes",
        "text": "In Groups, create a project and invite classmates from your contacts. Add tasks and due dates, assign the work, and use the shared notes, discussion and files. In Notes, choose contacts and Can read or Can edit when sharing a note."
      },
      {
        "title": "Breaks and reminders",
        "text": "Use Semesters → Breaks & holidays to record dates without classes. Assignment and class reminder preferences are in Settings → Reminders → Study. Check an item’s own reminder fields for additional reminders."
      }
    ],
    "gallery": [
      {
        "id": "study-timetable",
        "title": "Timetable"
      },
      {
        "id": "study-assignments",
        "title": "Assignments"
      },
      {
        "id": "study-subjects",
        "title": "Subjects and grades"
      },
      {
        "id": "study-semesters",
        "title": "Semesters"
      },
      {
        "id": "study-notes",
        "title": "Study notes"
      },
      {
        "id": "study-cards",
        "title": "Flashcards"
      },
      {
        "id": "study-groups",
        "title": "Group projects"
      }
    ]
  },
  {
    "id": "studyarchive",
    "group": "Study",
    "title": "Finish & archive a semester",
    "summary": "Keep previous academic work available while moving to the next semester.",
    "where": "Study → Semesters / Study archive",
    "steps": [
      "Before finishing, review outstanding assignments and any final grades you want to enter.",
      "In Semesters, choose Done with this semester and add a remark if useful.",
      "Open Study archive to find the completed semester and inspect its records.",
      "Create or activate the next semester.",
      "Use Start from a previous semester when you want to copy subjects, timetable information and unfinished assignments.",
      "Use Restore when you need to bring archived work back."
    ],
    "tips": [
      "Archiving and deleting are different. Delete permanently removes records; read the confirmation before continuing."
    ],
    "related": [
      "study"
    ],
    "sections": []
  },
  {
    "id": "settings",
    "group": "Account & support",
    "title": "Settings, plans & your data",
    "summary": "Manage your profile, preferences, subscription access and account.",
    "where": "Side menu → Settings",
    "steps": [
      "Open Profile → Edit to review your name, country, time zone and optional birthday.",
      "Use Preferences to control notifications, busy-day alerts and whether Work or Study appears in Personal.",
      "Open Reminders to review built-in reminder categories and times.",
      "Choose Background and Theme to personalise the app within your plan’s options.",
      "Select your plan name to compare plans and add-ons or start a renewal request.",
      "Open Account & data to export records, request a password reset, install LUMA or review your devices."
    ],
    "tips": [
      "Plan and add-on requests open WhatsApp. Send the message to arrange the change; selecting a plan does not complete an online payment.",
      "Prices, quotas and available features can change. Use the current plan comparison in your account.",
      "Deleting your account is permanent. Export records and download important files first.",
      "Don’t recognise a device in Your devices? Sign out other devices, then change your password."
    ],
    "related": [
      "purchases",
      "notifications",
      "reset-password"
    ],
    "sections": [
      {
        "title": "Export your records",
        "text": "Choose Export my data to download a JSON file. Uploaded file contents are not included, and this is not a complete backup of every collaboration feature. Download important documents separately and use module-specific exports such as Work timesheets or the Study export when needed."
      },
      {
        "title": "Install on your device",
        "text": "Use Account & data → Install LUMA when offered. On iPhone or iPad, open LUMA in Safari, choose Share and Add to Home Screen. The installed experience still needs an internet connection for account data."
      },
      {
        "title": "See where you are signed in",
        "text": "In Account & data, choose Your devices (View). The list shows every phone and computer signed in to your account: its name, such as “iPhone · LUMA app” or “Mac · Chrome”, when it was last active and when it first signed in. The device you are using is tagged “This device”. A device appears the first time it opens LUMA and its time is refreshed while LUMA stays open. When you log out on a device it leaves the list."
      },
      {
        "title": "Sign out your other devices",
        "text": "At the bottom of Your devices, choose Sign out other devices and confirm. Every other phone and computer is logged out and removed from the list; you stay signed in on this one. This is all-or-nothing: you cannot sign out one device on its own. If you see a device you do not recognise, sign out the others and then change your password from Account & data → Change password."
      },
      {
        "title": "Delete your account",
        "text": "In Account & data, choose Delete account. Read the list of affected data, use the export option if needed, then type your account email to enable the final confirmation. This action cannot be undone."
      }
    ]
  },
  {
    "id": "notifications",
    "group": "Account & support",
    "title": "Notifications & focus",
    "summary": "Review alerts and choose how you want to be interrupted.",
    "where": "Top bar → Bell / Notifications",
    "steps": [
      "Open the bell to review recent alerts or open the Notifications page for the full list.",
      "Use All or Unread to find alerts that still need attention.",
      "Open an alert to go to the related item where a link is available.",
      "Scroll to load older notifications.",
      "In Settings → Preferences, enable notifications and allow the browser permission prompt."
    ],
    "tips": [
      "On iPhone, install LUMA on the Home Screen before enabling push notifications.",
      "Check your device notification settings if in-app alerts arrive but push alerts do not."
    ],
    "related": [
      "settings",
      "reminders"
    ],
    "sections": [
      {
        "title": "Use Focus Mode",
        "text": "Open Focus Mode from the menu. Choose a focus session, short break or long break, adjust the durations if needed, and start the timer. You can choose an ambience sound and volume. Focus mode keeps chat and nudges quiet while allowing reminders and budget alerts."
      }
    ]
  },
  {
    "id": "purchases",
    "group": "Account & support",
    "title": "Purchase history",
    "summary": "Review plan and add-on activations, trials and renewals.",
    "where": "Settings → Purchase history",
    "steps": [
      "Open Purchase history from Settings.",
      "Use All, Plans, Add-ons or Trials to narrow the list.",
      "Review each entry’s activation, extension, removal or ending date.",
      "Choose Show older to load earlier entries.",
      "For a question about access or renewal, contact support with the relevant entry details."
    ],
    "tips": [
      "This page records changes to plan access. Do not assume an entry is a payment receipt."
    ],
    "related": [
      "settings",
      "support"
    ],
    "sections": []
  },
  {
    "id": "feedback",
    "group": "Account & support",
    "title": "Send feedback",
    "summary": "Report a bug or share an idea with enough detail to investigate it.",
    "where": "Side menu → Feedback",
    "steps": [
      "Choose the module and, when available, the part of the module involved.",
      "Choose whether your message is a bug, idea, question or praise.",
      "Describe what you did, what you expected and what happened instead.",
      "Attach a screenshot if it helps. Hide passwords and private details before sharing it.",
      "Select Send and review your submitted message in the history.",
      "Return to check its status; updates may also appear in Notifications."
    ],
    "tips": [
      "Include your device and browser when reporting a display or notification problem.",
      "The current feedback limit is 10 submissions per day."
    ],
    "related": [
      "support",
      "notifications"
    ],
    "sections": []
  },
  {
    "id": "support",
    "group": "Account & support",
    "title": "Help & troubleshooting",
    "summary": "Find answers and contact the LUMA team when you need assistance.",
    "where": "Side menu → Support",
    "steps": [
      "Read the FAQ relevant to the page or issue.",
      "For a reproducible bug, use Feedback and include the steps and a screenshot.",
      "For account or billing help, use the Email us or WhatsApp contact link on Support.",
      "Include your account email and a clear description, but never send your password or verification code."
    ],
    "tips": [
      "Use the direct email or WhatsApp links for a support request. The current Send us a message form shows a confirmation but does not send the message."
    ],
    "related": [
      "feedback",
      "settings",
      "login"
    ],
    "sections": [
      {
        "title": "A page looks empty",
        "text": "Check the selected mode, company, semester, date range and filters. Refresh the page. If it still fails to load, note the error and report it through Feedback."
      },
      {
        "title": "An action is locked",
        "text": "Check your plan, Work or Study add-on, project role and any usage limit shown. Archived companies and semesters may also restrict changes."
      },
      {
        "title": "An email or alert is missing",
        "text": "For account emails, check junk mail and the address you entered. For push notifications, check browser and device permissions and your profile time zone. Request a fresh verification code or reset link if the previous one expired."
      }
    ]
  }
];
