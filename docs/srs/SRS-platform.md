# SRS — Platform and cross-cutting features

Version of the product described: LUMA 0.26.4 (staging), migrations 001 to 085. Everything below was taken from the code, the migrations and `CHANGELOG.md`. Where the code could not settle a point, the text says "TBC" (to be confirmed).

## 1. Scope

This document covers the shared platform of LUMA that is not specific to Personal, Work or Study mode: signing up and signing in, the app shell, Settings, plans and add-ons, notifications and push, busy-day alerts, feedback, support, the administrator tools, the account (export and delete) and the non-functional requirements of the whole product.

Out of scope here (other documents): the Personal modules (Tasks, Calendar, Money, ...), the Work module and the Study module, and the Lumi assistant. They are mentioned only where the platform touches them (for example the mode menu, the plan limits that they obey, or the reminder jobs that they feed).

Terms: **Dawn**, **Glow**, **Zenith** are the plans (free, RM9 / month, RM19 / month). **Work**, **Work Pro** and **Study** are add-ons (RM15, RM25 and RM7 / month; Work + Study bundle RM19 / month). A **mode** (space) is Personal, Work or Study. An **administrator** is a person listed in `luma.admin_users`. "The database" means Supabase Postgres with Row Level Security (RLS).

## 2. Area codes

| Code | Area | Section |
|---|---|---|
| AUTH | Registration, e-mail confirmation, login, remember me, logout, forgot / reset password, verify-email page, session handling, sign out other devices, deactivated accounts | 3.1 |
| SHL | App shell: boot, menus per mode, mode switcher, routing, top bar, global search, undo toast, dialogs, custom controls, PWA install, service worker | 3.2 |
| SET | Settings: profile, background, theme, preferences, reminder settings, time zone | 3.3 |
| PLN | Plans, limits, add-ons, trials, WhatsApp requests, expiry, gifts, purchase history | 3.4 |
| NTF | Notifications: bell, panel, page, live toast, push, click-through, reminder engines, focus mode | 3.5 |
| BSY | Busy-day alerts | 3.6 |
| FBK | Feedback page and administrator feedback inbox | 3.7 |
| SUP | Support page, FAQ, contact form | 3.8 |
| ADM | Administrator tools | 3.9 |
| ACC | Account: export data, delete account | 3.10 |
| NFR | Non-functional requirements (NFR-SEC, PRF, AVL, RSP, AXS, BRW, PRV, OBS, MNT) | 4 |

Priority: **Must** (the product breaks without it), **Should**, **Could**.

## 3. Functional requirements

### 3.1 AUTH — Authentication and session

#### Registration

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-AUTH-001 | The register page shall ask for first name, last name, country (required, 38 choices ending in "Other"), time zone (required, 28 choices shown as "GMT+08:00 · Kuala Lumpur, Singapore ..."), e-mail, password (minimum 6 characters in the form) and a repeated password. | Must | register/index.html, shared/luma-auth.js |
| FR-AUTH-002 | The time zone shall start as the browser's zone when it is one of the 28 offered, otherwise Asia/Kuala_Lumpur; the country shall start as the one that goes with the time zone and shall stop following the time zone once the person has chosen a country themselves. | Should | register/register.js, shared/luma-auth.js |
| FR-AUTH-003 | The "Create account" button shall stay disabled (with the tooltip "Tick the box to agree to the Terms of Service and Privacy Policy first") until the Terms and Privacy Policy box is ticked. | Must | register/register.js |
| FR-AUTH-004 | If the two passwords differ, the page shall show "Passwords don't match." and shall not call the server. | Must | register/register.js |
| FR-AUTH-005 | On submit the page shall send first name, last name, country and time zone as sign-up data; the database shall create the person's profile (plan Dawn, plan end empty) and a "Welcome to LUMA" notification. | Must | shared/luma-auth.js, 001, 008, 028, 033 |
| FR-AUTH-006 | If sign-up returns a session the page shall open `/app/`; otherwise it shall open `/verify-email/?sent=1&email=<address>`; a server error shall be shown in the red message box. | Must | register/register.js |
| FR-AUTH-007 | The Google and Apple buttons on the register and login pages shall show "<name> sign-up isn't connected yet — create an account with email for now." and "<name> sign-in isn't connected yet — use email for now." and do nothing else. | Could | register.js, login.js |

Notes: the "Terms of Service" and "Privacy Policy" links on the register page point to `#` (no pages exist yet).

#### E-mail confirmation (verify-email page)

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-AUTH-008 | The verify-email page shall show "We sent a 6-digit code to <email>." when the address is in the URL; otherwise it shall show an e-mail field and "Enter your email and the code we sent you."; with `?sent=1` it shall show "Account created. We emailed you a code." | Must | verify-email/verify-email.js |
| FR-AUTH-009 | The code box shall accept digits only; pressing "Verify and continue" with fewer than 6 digits shall show "Enter the full code from the email."; with no e-mail it shall show "Enter your email first." | Must | verify-email.js |
| FR-AUTH-010 | A correct code shall verify the address, create a session that is remembered (remember-me on) and open `/app/` after "Email verified. Taking you in..."; a wrong or expired code shall show "That code is wrong or has expired. Check it, or send a new code." | Must | verify-email.js, shared/luma-auth.js |
| FR-AUTH-011 | "Send a new code" shall be disabled for 45 seconds after arriving from sign-up and for 60 seconds after each send, with a countdown label "Send a new code in Ns"; a failed send shall show the server message and release the button at once. | Should | verify-email.js |

#### Login

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-AUTH-012 | The login page shall sign in with e-mail and password; while waiting the button shall read "Signing in..." and be disabled; on success it shall open `/app/`; on failure it shall show the server's message and re-enable the button. | Must | login/login.js |
| FR-AUTH-013 | If the server says the e-mail is "not confirmed", the login page shall send a fresh code and open `/verify-email/?sent=1&email=<address>`. | Must | login.js |
| FR-AUTH-014 | "Remember me" shall be ticked by default. Ticked: the session is kept in localStorage (survives closing the browser) and the e-mail is remembered in `luma.rememberedEmail` and pre-filled next time. Unticked: the session is kept in sessionStorage (ends when the tab or browser closes) and the remembered e-mail is erased. | Must | login.js, shared/luma-auth.js |
| FR-AUTH-015 | A visitor who already has a session and opens the login or register page shall be sent to `/app/`. | Should | shared/luma-auth.js |
| FR-AUTH-016 | An error that says banned, deactivated or disabled shall be shown as "This account has been deactivated. Please contact support if you think this is a mistake."; the same text shall be shown when the login page is opened with `?disabled=1`. | Must | login.js |
| FR-AUTH-017 | The login page opened with `?deleted=1` shall show "Your account and all its data have been deleted. Thank you for trying LUMA." in green. | Should | login.js |
| FR-AUTH-018 | The password box on the login and reset pages shall have an eye icon that shows or hides the typed password. | Could | login/index.html, reset-password/index.html |

#### Forgot and reset password

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-AUTH-019 | "Forgot password?" shall require an e-mail typed first (otherwise "Enter your email above first, then click "Forgot password?""), then ask Supabase to send a reset link that returns to `/reset-password/`, and show "Password reset link sent to <email>."; a server error shall be shown, with a clearer text for blocked @example.com addresses. | Must | login.js, shared/luma-auth.js |
| FR-AUTH-020 | The reset page shall wait up to 8 tries of 350 ms for the temporary session made from the link. With no session it shall show "This link is invalid or has expired.", disable the form, and explain why: an expired or used link (error code otp_expired, with the advice that mail programs may open links automatically), the error text from the address, or "No reset link was found in this address". | Must | reset-password/reset-password.js |
| FR-AUTH-021 | While a new password is being saved (the loading lock) the reset form shall be locked: all inputs and buttons disabled, a spinner and "Updating your password..." shown, and a second click or Enter shall not send a second request. On error the form shall unlock and show the message; on success it shall stay locked, show "Redirecting to sign in...", sign the person out and open `/login/` after 1.2 seconds. | Must | reset-password.js, edge/reset_test.js |
| FR-AUTH-022 | If the two new passwords differ the reset page shall show "Passwords don't match." and not call the server; the first password box has a minimum of 6 characters. | Must | reset-password.js, index.html |
| FR-AUTH-023 | A password-recovery link that lands on another page (the address contains `type=recovery`) shall be sent on to `/reset-password/` with its tokens. | Should | shared/recovery-redirect.js |

#### Session handling, logout and device control

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-AUTH-024 | The app (`/app/`) shall send a visitor with no session to `/login/` before showing anything. | Must | core/start.js, shared/luma-auth.js |
| FR-AUTH-025 | Log out (top-bar icon or Settings → Log out) shall ask "Log out" / "Cancel"; confirming shall disable the button ("Logging out..."), end the session and open `/login/`. | Must | core/shell.js, shell.html |
| FR-AUTH-026 | "Sign out other devices" (Settings → Account and data) shall ask for confirmation, then end every other session (Supabase scope "others") and keep this one; it shall show "Signed out of your other devices." or the error. | Should | settings.js |
| FR-AUTH-027 | At start-up, if the person's profile says the account was deactivated, the app shall sign out and open `/login/?disabled=1`. | Must | core/start.js |
| FR-AUTH-028 | The user's display name shall be the profile first name, else the sign-up first name, else the part of the e-mail before "@", else "there". | Should | shared/luma-auth.js, core/session.js |
| FR-AUTH-029 | A person shall be able to change their password from Settings by "Send link" (a reset e-mail to their own address, confirmed with "Check your email, <address>, for the link to set a new password.") or from Edit profile (see FR-SET-004). | Should | settings.js |

### 3.2 SHL — App shell

#### Boot and start-up

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SHL-001 | The boot script shall fetch the 24 markup files together (no browser cache), put the shell, the 28 page containers and all popups in the page, then load 52 scripts one after another in a fixed order; a script that cannot be loaded shall be logged and skipped without stopping the others. | Must | core/boot.js |
| FR-SHL-002 | If the markup cannot be loaded the loading cover shall stay up (reason "boot-failed") and the 3-minute message shall explain what to do. | Must | boot.js, shared/luma-loader.js |
| FR-SHL-003 | A loading cover shall show at once, stay at least 1 second, wait for the page and anything it holds, cover each move between pages while the page loads its data, and after 3 minutes still loading show "Something went wrong — Please refresh the page or try again later." with a "Refresh page" button. | Must | shared/luma-loader.js |
| FR-SHL-004 | After sign-in the start sequence shall run in this order: flush unsaved profile changes, load profile (sign out if deactivated), load plan and limits, show the Admin menu for administrators, set the time zone, find out whether the database has spaces, apply the person's look, restore the mode, register the service worker, start notifications and reminders, load the dashboard, re-save the push subscription, then offer the plan popup and afterwards the push popup. | Must | core/start.js |
| FR-SHL-005 | The staging site shall show "Version <n> · STAGING" under the LUMA name; production shall show only the version; production keys shall be used only on a production host and only when filled in, otherwise staging keys are used. | Should | shared/supabase-config.js |

#### Menus and modes

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SHL-006 | In Personal mode the menu shall list Dashboard, Calendar, Reminders, Tasks and Work (Personal), Money, Split expenses, Subscriptions, Bills, Goals, Habits, Health, Notes and Docs, Documents, Contacts, Lumi, Analytics, Settings, Support, Feedback, and Admin (only for administrators). | Must | core/shell.html, core/modes.js |
| FR-SHL-007 | In Work mode the menu shall show Work, Company, Calendar, Reminders, Documents, Contacts, Lumi, plus Settings, Support and Feedback; Company only when the person has the Work add-on; a person in Work mode without the add-on shall see only Work. | Must | core/modes.js |
| FR-SHL-008 | In Study mode the menu shall show Study, Study archive, Calendar, Reminders, Notes, Documents, Lumi, plus Settings, Support and Feedback. | Must | core/modes.js |
| FR-SHL-009 | Settings, Support, Feedback, Admin, Plan report, Feedback inbox and Notifications shall be reachable in every mode; Notifications has no menu item and is opened from the bell. | Must | core/modes.js |
| FR-SHL-010 | The mode switcher (Personal / Work / Study) shall show a lock on a mode whose add-on is not on; pressing a locked mode shall open its add-on popup; pressing an open mode shall switch to it and open its home page (Dashboard, Work, Study). | Must | core/modes.js |
| FR-SHL-011 | The chosen mode shall be saved in the profile preferences and in localStorage (`luma_mode`) and restored at the next sign-in only if the person still has that add-on; a fresh start without a page in the address shall open the mode's home. | Should | core/modes.js |
| FR-SHL-012 | Opening a page that belongs to another mode (from search, a link or a notification) shall switch the menu to that mode (work, company to Work; study, studyarchive to Study; others to Personal when not in the current mode's list). | Should | core/modes.js |
| FR-SHL-013 | Someone invited to another person's Study group project, or to a Work project, shall be able to open Study (Groups) or Work without the add-on; owning projects of their own shall not be enough. | Should | core/modes.js |
| FR-SHL-014 | When the plan or add-ons are found changed (re-checked when the app becomes visible again after 2 minutes), a person who no longer has the add-on of the mode or page they are on shall be moved to Personal / Dashboard and the mode shall lock again. | Must | core/modes.js |

#### Routing and top bar

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SHL-015 | Opening a page shall mark its menu item active, show its title in the top bar, scroll it to the top, and write `#<page>` in the address so a refresh returns to it; a fresh launch (new tab, app reopened) shall open the Dashboard; a tapped push notification (`?from=push`) shall open its page. | Must | core/router.js, core/start.js |
| FR-SHL-016 | Work, Study, Company and Study archive without the add-on (and not as a guest) shall open the add-on popup instead of the page. | Must | core/router.js |
| FR-SHL-017 | The top bar shall show the date in the person's time zone (updated every second and when the tab becomes visible), a search button, the notification bell with a badge, and a log-out icon; the greeting shall be "Good morning" before 12:00, "Good afternoon" before 18:00, otherwise "Good evening", with the first name. | Must | core/shell.js, core/session.js, core/time.js |
| FR-SHL-018 | On a screen up to 768 px wide the menu shall be hidden behind a hamburger button, open over the page with a dimmed overlay, close when the overlay or a menu item is pressed, and reset when the window becomes wider. | Must | core/shell.js, core/responsive.css |

#### Global search

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SHL-019 | The magnifier (or Ctrl / Cmd + K, which also closes it) shall open a search box listing all pages when empty ("Start typing to search."), and when typing, pages plus the person's tasks, events, notes, documents, habits, goals, bills, subscriptions, reminders, contacts and money entries (24 months), and Study and Work items when those add-ons give any. | Must | core/search.js |
| FR-SHL-020 | Search shall match all typed words, rank titles that start with the text first, show at most 5 hits per group when typing, highlight the matches, say "Nothing found for ..." when empty, support Arrow Up / Down / Enter, and reuse data fetched in the last minute. | Should | core/search.js |
| FR-SHL-021 | Choosing a hit shall open the item (task, event, reminder, money entry, Study or Work item) or its page (notes, documents, habits, goals, bills, subscriptions, contacts, pages). | Must | core/search.js |

#### Dialogs, toasts and controls

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SHL-022 | Themed dialogs shall replace the browser's confirm, alert and prompt: Enter accepts, Escape or a click outside cancels; a dialog with a text box keeps its OK button disabled until something is typed; number boxes keep only digits, commas and one decimal point. | Must | core/dialogs.js |
| FR-SHL-023 | After deleting a task, event, reminder or note a bar "<thing> deleted" with "Undo" shall show for 9 seconds; Undo restores the item and shows "Restored"; a failed undo shall show "Could not undo: ...". | Should | core/ui.js |
| FR-SHL-024 | A confirmation toast (flashToast) shall disappear after 3.5 seconds or when pressed. | Should | core/ui.js |
| FR-SHL-025 | Select boxes shall be drawn as themed dropdowns that keep the real select as the source of truth, open upward when there is no room below, support Arrow keys, Enter, Space and Escape, and close on outside click, scroll or resize. | Should | core/ui.js, core/skins.js |
| FR-SHL-026 | The date picker (luDatePopup) shall show a month with arrows; pressing the month name shall show a month-and-year view where the year can be typed (limits 1900 to 2100 unless min / max are set); a box shall accept a typed date as DD/MM/YYYY, DD-MM-YYYY, DD.MM.YY or YYYY-MM-DD and show an error for an impossible or out-of-range date; "Today" shall be disabled when today is beyond the maximum; "Close" closes it. | Must | core/skins.js, ui/v49_test.js |
| FR-SHL-027 | The time picker shall offer hours 1 to 12, minutes in 5-minute steps (plus the current minute) and AM / PM, with "Clear" where a time is optional; number boxes shall have up and down buttons that hold-repeat and respect min, max and step. | Should | core/skins.js |
| FR-SHL-028 | In edit popups (event, task, money entry, bill, goal, habit, reminder, profile, note, Study items) the Save button shall stay disabled with the tooltip "Nothing has changed yet" until something has changed. | Should | core/dirtywatch.js |

#### PWA and service worker

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SHL-029 | The web manifest shall make LUMA installable as "LUMA — Your Personal OS" (short name LUMA, standalone, portrait, start `/app/?source=pwa`, scope `/`, three icons, shortcuts Tasks, Calendar, Reminders). | Should | manifest.webmanifest |
| FR-SHL-030 | "Install LUMA" (Settings → Account and data) shall hide when LUMA already runs installed; use the browser's own install box where offered (Chrome, Edge, Android); otherwise show the written steps for iPhone / iPad (Share, Add to Home Screen, Add), Android (menu, Install app) or desktop (install icon in the address bar). | Should | shared/luma-install.js, core/ui.js, settings.js |
| FR-SHL-031 | The service worker shall install and take control at once, shall not cache or alter any request, and shall show Web Push notifications (see FR-NTF-019). | Must | sw.js |
| FR-SHL-032 | The host shall serve `sw.js` and all `.html` files with `Cache-Control: no-cache`, allow the worker scope `/`, and use trailing slashes in addresses. | Should | vercel.json |
| FR-SHL-033 | All dates and times in the app (greeting, calendar, reminders, "today") shall use the time zone saved in the profile, falling back to the sign-up time zone and then Asia/Kuala_Lumpur. | Must | core/time.js, core/start.js |

### 3.3 SET — Settings

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SET-001 | Settings shall show, in order: Background, Profile, Theme, Preferences, Account and data, Your plan and add-ons, Reminders. | Must | settings.js |
| FR-SET-002 | The Profile card shall show the avatar initial, full name, e-mail, a plan pill (opens the plan card) and one pill per active add-on (with "(trial)" for a trial and a red outline when 7 days or less remain), an "Edit" button and a "Log out" button. | Should | settings.js |
| FR-SET-003 | "Edit" shall open a popup with first name, last name, e-mail, country ("Not set" allowed), time zone, new password and repeat password; "Save changes" shall stay disabled until something changes. | Must | settings.js, core/dirtywatch.js |
| FR-SET-004 | A new password shall need at least 6 characters ("New password must be at least 6 characters.") and a matching repeat ("New passwords don't match."). | Must | settings.js |
| FR-SET-005 | Changing the e-mail shall ask Supabase for the change; if it applies at once the message is "email updated", otherwise "check your inbox to confirm the new email"; the profile copy of the e-mail shall be kept in step. | Should | settings.js |
| FR-SET-006 | Saving a changed time zone shall reload the app after 1.2 seconds ("Applying your new time zone...") so every date and time follows the new zone. | Must | settings.js |
| FR-SET-007 | A failed profile save shall show "Couldn't save name: ..." (with the hint about migration 001), an e-mail failure "Couldn't update email: ...", and a password failure "Couldn't update password: ..."; country and time zone shall be left out and a notice shown when migrations 023 / 028 are missing. | Should | settings.js |
| FR-SET-008 | The Background card shall offer 11 wallpapers; the first N allowed by the plan (Dawn 4, Glow 8, Zenith 11, key `wallpapers`) shall be usable and the rest shall show a lock; pressing a locked one shall say that more wallpapers are on the Glow and Zenith plans (Dawn) or the Zenith plan (Glow). | Must | settings.js, 033, 043 |
| FR-SET-009 | "Upload your own" shall be available only with limit `own_wallpaper` (Zenith); otherwise it shall say it is on the Zenith plan. An upload shall be an image of at most 15 MB, shrunk to at most 1920 px as JPEG, saved to the private bucket `luma-backgrounds/<user id>/wallpaper-<time>.jpg` (bucket limit 5 MB), shall replace and delete the previous upload, and shall be shown from a signed address valid 7 days. | Must | settings.js, core/appearance.js, 042 |
| FR-SET-010 | The Theme card shall offer Slate, Midnight Navy and Obsidian; the number allowed follows limit `themes` (Dawn 1, Glow 3, Zenith 3); a locked theme shall say "More themes" are on the Glow and Zenith plans; the choice shall be saved as `profiles.theme` and applied as a tint over the wallpaper. | Must | settings.js, core/appearance.js |
| FR-SET-011 | Theme, wallpaper and preferences shall be saved in the account so they follow the person to any device; when a save fails the change shall be kept in the browser (`luma_profile_pending`), a toast "Couldn't save that to your account" shall show, and it shall be sent at the next start. | Must | core/appearance.js |
| FR-SET-012 | Preferences shall contain these switches (default): Focus mode (off), Notifications (reflects this device), Proactive AI suggestions (on), Weekly review (on), Interface sounds (off), Busy-day alerts (on), Tell me the evening before (on); each is saved in `profiles.preferences`. | Must | settings.js |
| FR-SET-013 | "Show Work in Personal" and "Show Study in Personal" (default off) shall appear only while the person has that add-on; turning one on shall show that mode's items in Personal, turning it off shall hide them again without deleting anything. | Must | settings.js, shared/luma-space.js |
| FR-SET-014 | The Notifications switch shall turn Web Push on or off for this device (FR-NTF-015), showing the text for the device state and an error such as "Notifications are blocked. Allow them for LUMA in your browser or device settings, then try again." | Must | settings.js, core/push.js |
| FR-SET-015 | Interface sounds shall play soft tones on taps, switches and new notifications (rate-limited to one per 60 ms) and a short preview when the switch is turned on. | Could | core/appearance.js |
| FR-SET-016 | "How easily a day counts as busy" shall offer Sensitive, Normal (default) and Relaxed and show the amber and red thresholds of the choice as a hint (see FR-BSY-002). | Should | settings.js |
| FR-SET-017 | The Reminders card shall have one card with a switch for each of: Calendar events, Tasks, Bills, Subscriptions, Goals, Study (only with Study), Work (only with Work), Classes (only with Study), Habits, Health and Budget alerts; Habits and Health link to the page where their times are set. | Must | settings.js |
| FR-SET-018 | Reminder times shall be chosen from: hours 5 AM to 10 PM; event lead 5, 10, 15, 30, 60 minutes; bill, subscription, goal, Study and Work days 1, 2, 3, 5, 7 ("before"); Study items with a time 15, 30, 60, 90, 120, 180, 240 minutes; class lead 5, 10, 15, 30, 60 minutes; budget warning 50 to 95 percent. | Must | settings.js |
| FR-SET-019 | Defaults when no row exists: events on, 15 min, all-day 8:00; tasks 9:00; bills 3 days, 9:00; subscriptions 3 days, 9:00; goals 3 days, 9:00; Study 3 days, 9:00, 60 min, classes 15 min; Work 1 day, 9:00; budget 80 percent; habits and health on. | Must | settings.js, 031, 035, 077 |
| FR-SET-020 | Without limit `timing` (Dawn) the reminder time selects shall be disabled and show the standard values with the note "These are the standard times and levels ... Choosing your own is available on Glow and Zenith."; the on / off switches shall still work. | Must | settings.js, 033 |
| FR-SET-021 | Each change in the Reminders card shall be saved at once to `luma.reminder_prefs` (one row per person), show the toast "Reminder saved", dim an off card, and show the error text (or "Reminder settings aren't set up yet ...") on failure. | Must | settings.js, 031 |
| FR-SET-022 | The Account and data card shall list Install LUMA, Change password, Export my data, Sign out other devices and Delete my account. | Must | settings.js |

### 3.4 PLN — Plans, add-ons, limits, gifts

#### Plans and limits

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-PLN-001 | New accounts shall start on Dawn; the plan values are dawn, glow, zenith; at migration 033 every account that already existed was moved to Zenith. | Must | 033 |
| FR-PLN-002 | A signed-in person shall not be able to set or change their own plan, plan end date or deactivation; only an administrator function or the server can. | Must | 033, 036, 062, 065 |
| FR-PLN-003 | The limits shall live in `luma.plan_limits` (empty value = unlimited), readable by every signed-in person and changeable only by an administrator, with these starting values (Dawn / Glow / Zenith): Lumi questions a day 3 / 10 / 15; Lumi actions 0 / 1 / 1; insights a day 0 / 3 / 10; storage 50 / 300 / 1000 MB; file size 5 / 20 / 50 MB; custom reminders 5 / 25 / unlimited; habits 5 / 10 / unlimited; goals 3 / 5 / unlimited; bills 5 / 12 / unlimited; contacts 3 / 12 / unlimited; reminder timing 0 / 1 / 1; payroll 0 / 1 / 1; own wallpaper 0 / 0 / 1; wallpapers 4 / 8 / 11; themes 1 / 3 / 3; chat messages a day 50 / 50 / 50. | Must | 033, 037, 043 |
| FR-PLN-004 | The database shall refuse to add one more habit (not archived), goal (not completed), bill or subscription, custom reminder or contact (accepted plus requests you sent) beyond the plan limit with "Plan limit: the <Plan> plan allows up to <n> <things>. Upgrade your plan in Settings to add more." | Must | 033 |
| FR-PLN-005 | The database shall refuse a document larger than the file limit ("... allows files up to <n> MB ...") or one that fills the storage limit ("... includes <n> MB of file storage and it is full ..."). | Must | 033 |
| FR-PLN-006 | The database shall refuse changed reminder times for a plan whose `timing` limit is 0 ("Plan limit: choosing reminder times is available on Glow and Zenith ...") while still allowing the on / off switches. | Must | 033 |
| FR-PLN-007 | The app shall ask for the person's plan, limits, add-ons and trials in one call (`my_limits`), remember the last answer in the browser, retry up to 3 times, and fall back to the strictest plan (Dawn limits) and never to a larger one when the answer cannot be fetched; if plans were never set up it shall behave as Zenith without limits. | Must | shared/luma-plan.js |
| FR-PLN-008 | When adding would pass a limit the app shall show "Plan limit reached — Your <Plan> plan includes up to <n> <things>. Upgrade to add more." with "See plans"; for a feature a lower plan lacks it shall show "Not in your plan — <feature> is available on <plan>. Want to see the plans?". The database stays the final guard. | Must | core/plans.js |
| FR-PLN-009 | The plans popup shall show three cards (Dawn "Free forever", Glow RM9 / month, Zenith RM19 / month) with their perks, a "Your plan" badge on the current one, the end line on a paid current plan, and buttons: "Upgrade to <Plan>" (higher), "Current plan" or "Renew <Plan>" (current), "Included" (lower). | Must | core/plans.js |
| FR-PLN-010 | The first time a Dawn person signs in the plans popup shall open once as "Welcome to LUMA! Pick your plan" with "Stay on Dawn"; whatever is chosen it shall not open again (`preferences.plan_prompted`). | Should | core/plans.js |
| FR-PLN-011 | "Upgrade to <Plan>" shall open WhatsApp (number in `shared/plan-config.js`) with a message holding name, e-mail, current plan, "Upgrade to" and price; if no number is set it shall say to e-mail aeinscape@gmail.com. | Must | core/plans.js, shared/plan-config.js |
| FR-PLN-012 | The end of a plan or add-on shall be shown as "Until <date> · <n> days left" (red when 7 days or less, "ends today" on the last day, "Ended <date>" when past) and in Settings as "Last day: <date> · <n> days left", "No end date", or "Free forever" for Dawn. | Must | core/plans.js, settings.js |
| FR-PLN-013 | The plan limits editor may change a limit at any time; the plan popup and FAQ perk texts are fixed text and are not generated from the table. | Should | core/plans.js, support.js |

#### Add-ons and trials

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-PLN-014 | The add-ons shall be Work (RM15 / month), Work Pro (RM25 / month) and Study (RM7 / month), bundle Work + Study RM19 / month ("Save RM3 a month"), usable on every plan; the bundle shall be offered only to a person with neither add-on. | Must | core/modes.js |
| FR-PLN-015 | The Work add-on, not the plan, shall set the Work limits: Work 5 companies, 20 projects, 8 people on a project, 600 tasks in a project, 5 teams; Work Pro 20, 60, 15, 1500, 20; the numbers live in `plan_limits` under the plans `work` and `work_pro`; a person without the add-on gets the Work size; free trials and gifts are Work size; limits follow the person who owns the project or company. | Must | 083, core/modes.js |
| FR-PLN-016 | The add-on popup shall show the perks, price, both Work sizes with their limits (marking "yours"), the note that the size does not depend on the plan, and the buttons: "Start 7-day free trial" (when allowed), "Get <Add-on> · <price>", "Get Work Pro", "Upgrade to Work Pro" (on Work), and "Get both" (bundle). | Must | core/modes.js |
| FR-PLN-017 | A person shall be able to start a free trial of an add-on once per add-on, for 7 days, only if they do not already have it; a second attempt shall say "The free trial was already used" and an active add-on "You already have this add-on"; on success the mode shall open and a toast "<Add-on> trial started — Free for 7 days" shall show. | Must | 044, core/modes.js |
| FR-PLN-018 | The Study free-trial button shall be offered only while the site is not production; the Work trial shall be offered everywhere. | Should | core/modes.js |
| FR-PLN-019 | "Get <Add-on>" shall open WhatsApp with name, e-mail, current plan, add-on (and "(bundle: Work and Study together)" or a note about upgrading from Work to Work Pro) and price. | Must | core/modes.js |
| FR-PLN-020 | "Renew" shall open WhatsApp with name, e-mail, current plan, what is renewed, the end date (or "no end date") and the price; a Work Pro holder may renew as Work instead, with the note that nothing is deleted but nothing more can be added until under the Work limits. | Must | core/plans.js, settings.js |
| FR-PLN-021 | The Settings card "Your plan and add-ons" shall show a row for the plan, Work and Study with their end text or "Not switched on", a "free trial" tag, the buttons See plans / Renew / Get / Upgrade to Work Pro, and the explanation that after the last day the person returns to Dawn (or the add-on switches off), everything made is kept, and a reminder comes 7 days and 1 day before. | Must | settings.js |

#### Expiry

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-PLN-022 | An hourly job (minute 5) shall return a paid plan whose end date has passed to Dawn (plan end cleared) and notify "Your <Plan> plan has ended — You are back on the free Dawn plan and everything you made is kept ...". | Must | 062 |
| FR-PLN-023 | The same job shall warn about a plan or add-on that ends in exactly 7 days or 1 day ("Your <Plan> plan ends in 7 days" / "tomorrow"), no more than once per 20 hours per title, and shall notify once within 3 days when an add-on has ended ("Everything you made is kept, but you can not add new <Add-on> items until it is switched on again."). | Must | 062 |
| FR-PLN-024 | When an add-on ends, the person shall keep their data and be able to open and export it, but the database shall refuse new items of that mode (`has_my_addon`), the mode shall lock, and a person on that mode shall be moved to Personal. | Must | 044, 046, 050, core/modes.js |

#### Gifts

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-PLN-025 | An administrator may send a gift of an add-on (days 1 to 366 or months 1 to 24, a note up to 120 characters, a use-by date of 30 / 60 / 90 days or none); nothing starts and no time is lost until the person presses "Use now"; a person may hold at most 3 unused gifts, and deactivated people are skipped. | Must | 069 |
| FR-PLN-026 | The Settings card shall list waiting gifts ("A free gift is waiting for you" / "<n> free gifts are waiting for you"), with "Use by <date> · <n> days left" or "No deadline", and earlier gifts ("Used on <date>", "Expired <date>", up to 3); the Settings menu item shall show a dot while a gift waits. | Should | settings.js, shared/luma-plan.js |
| FR-PLN-027 | "Use now" shall ask for confirmation showing the new last day, start the add-on (adding the length after what is left when the add-on is already on, or from now), mark the gift used once, never use the free trial up, and refuse a gift that was used, expired or belongs to someone else, or when the add-on has no end date ("You already have <Add-on> with no end date, so there is nothing to add"). | Must | settings.js, 069 |
| FR-PLN-028 | The person shall be told when a gift arrives (opening the notification points at the gift) and shall be reminded 7 days and 1 day before an unused gift with a use-by date expires, not twice in 20 hours. | Should | 069 |

#### Purchase history

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-PLN-029 | Every plan and add-on change (trial, switched on, time added, switched off, plan ended) shall be written to `purchase_history` by database triggers, including changes by the administrator, trials and the expiry job; existing plans and add-ons were added once at migration time. | Must | 063 |
| FR-PLN-030 | Settings → Purchase history shall show the person's own rows only, newest first, 40 at a time with "Show older", filters All / Plans / Add-ons / Trials, the verb (Free trial started, Switched on, Time added, Switched off, Ended), the date and time and an "until <last day>" line. | Should | purchases.js, 063 |
| FR-PLN-031 | When an administrator changes a person's plan or add-on, that person (if not the administrator) shall be notified with the new plan or add-on and its end date. | Should | 062, 083 |

### 3.5 NTF — Notifications, push and reminder engines

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-NTF-001 | Notification rows shall be created only by the database (triggers and jobs); a person shall be able to read, mark read and delete only their own, and nobody shall be able to insert one from the app. | Must | 008 |
| FR-NTF-002 | The notification types shown with their own icon and colour shall be: welcome, share, contact_request, contact_accepted, nudge, message, reminder_water, reminder_steps, reminder_active, reminder_sleep, reminder_habit, reminder_task, reminder_event, reminder_bill, reminder_subscription, reminder_goal, reminder_custom, reminder_study, reminder_class, reminder_project, reminder_work, weekly_review, budget_warn, budget_over, event_invite, event_invite_reply, note_share, project_invite, project_reply, project_task, project_comment, split, split_nudge, work_invite, work_reply, work_task, work_comment, work_mention, work_budget, work_team, feedback, feedback_reply, gift, busy_day and system (the fallback for any other type). | Must | notifications.js |
| FR-NTF-003 | The bell shall show a badge with the number of unread notifications (9+ above 9) and hide it at zero. | Must | notifications.js |
| FR-NTF-004 | The bell panel shall list today's notifications (in the person's time zone), show "<n> unread" or "You're all caught up", "<n> earlier unread" for older unread ones, "No notifications today" when empty, a "Mark all as read" button (disabled at zero unread) and "See all"; it shall close on outside click or Escape. | Must | notifications.js |
| FR-NTF-005 | The Notifications page shall show "<n> notification(s) · <n> unread", filters All and Unread (n), groups headed Today, Yesterday or the date, a delete cross on each row, "Mark all as read", and the empty texts "No notifications yet." and "No unread notifications.". | Must | notifications.js |
| FR-NTF-006 | The app shall load the 200 newest notifications; the badge and counts are of those loaded. | Should | notifications.data.js |
| FR-NTF-007 | New, changed and deleted notifications shall appear live (realtime) without a refresh, and the list shall be reloaded when the tab becomes visible again. | Must | notifications.js, notifications.data.js |
| FR-NTF-008 | A new notification shall slide in as a toast for 6 seconds with sound (if sounds are on); pressing it opens its target; when the tab is in the background and browser permission is granted a browser notification shall also be raised. | Must | notifications.js |
| FR-NTF-009 | A new chat message notification shall replace the previous unread message notification of the same chat; if that chat is open, no toast shall show and its message and nudge notifications shall be marked read. | Should | notifications.js |
| FR-NTF-010 | Focus mode (Settings) shall let only notifications whose type starts with reminder_ or budget_ pop up as a toast, and the push sender shall skip every other type for that person; there are no quiet hours or schedule for Focus mode. | Must | notifications.js, functions/send-push |
| FR-NTF-011 | Opening a notification shall mark it read, close the panel, and go to its page; "Mark all as read" shall mark all unread read and, if saving fails, show "Could not mark as read: ..." and reload; deleting shall show "Could not delete: ..." on failure. | Must | notifications.js |
| FR-NTF-012 | Opening a notification shall also find the thing it is about (by its reference, or by the page-specific rule for tasks, health rings, budget, shared notes, project invites, contact requests, plan or add-on rows in Settings), scroll its list to it and flash it, looking for up to about 5 seconds while the page loads; a chat message or nudge shall open that chat. | Must | core/ui.js, notifications.js |
| FR-NTF-013 | If the thing belongs to another mode than the one shown (event, task, bill, habit, goal or reminder in Work, Study or Personal) and the person may open that mode, the app shall switch to that mode first. A reminder for a repeating event shall highlight today's occurrence. | Should | core/ui.js |
| FR-NTF-014 | Study notifications shall open the Study tab that holds the item (assignments, timetable or groups). | Should | core/ui.js |
| FR-NTF-015 | Turning on push shall ask the browser's permission, subscribe with the VAPID public key, and save the device's endpoint and keys (one row per endpoint, replacing an older row for the same device) with the first 200 characters of the user agent; turning it off shall delete the row, unsubscribe, and remember "never ask again" on this device; at every sign-in the subscription shall be saved again if permission is granted. | Must | core/push.js, notifications.data.js, 014 |
| FR-NTF-016 | After sign-in (and after the plan popup) a "Turn on notifications?" popup shall be offered once per device while push is off and not blocked; "No thanks" shall remember not to ask again; "Enable" shall subscribe or show the error. | Should | core/session.js, shell.html |
| FR-NTF-017 | The push state text shall be one of: not supported (on iPhone, add LUMA to the Home Screen first), blocked, on, off, tab-only (no VAPID key or no https), on while open in a tab. | Should | core/push.js |
| FR-NTF-018 | The `send-push` function shall accept only calls carrying the correct `x-webhook-secret`, ignore rows without a user, skip a chat message when the same sender already sent one in that conversation in the previous minute, skip non-urgent types for people in Focus mode, send the title, body, link, reference and type to every subscribed device with a 1-hour lifetime, and delete a subscription answered with 404 or 410. | Must | functions/send-push |
| FR-NTF-019 | The service worker shall show every push as a notification (silent and removed after 0.4 seconds when a LUMA window is visible, because iOS cancels subscriptions that show nothing); pressing it shall focus an open LUMA window and tell it to open the page, or open `/app/?from=push` with the reference. | Must | sw.js |
| FR-NTF-020 | The reminder engines shall run on the server as pg_cron jobs, in each person's own time zone, creating notifications that also reach the phone as push: health (every minute), habits (every minute), events (every minute), custom reminders (every minute), class (every minute), morning tasks, bills, goals (hourly), subscriptions (hourly), Study (hourly), group tasks (hourly), Work tasks (hourly), budget alerts (minute 30), weekly review (minute 5), plan expiry (minute 5), gift reminders (minute 10), busy-day alerts (minute 5). | Must | 014, 018, 025, 028, 030, 032, 034, 045, 052, 058, 062, 069, 077, 082 |
| FR-NTF-021 | A reminder of one type shall not be created twice within 10 minutes for the same person (health reminders), and reminders of a switched-off kind (habits, health) shall never reach the inbox or push. | Must | 014, 035 |
| FR-NTF-022 | The weekly review shall arrive on Sunday at 18:xx in the person's time zone unless "Weekly review" is off, at most once in 5 days, with the tasks done, tasks overdue and money spent. | Should | 034 |
| FR-NTF-023 | A "Welcome to LUMA" notification shall be created when a profile is created. | Could | 008 |
| FR-NTF-024 | A person shall be able to read, create and delete only their own push subscriptions. | Must | 014 |

### 3.6 BSY — Busy-day alerts

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-BSY-001 | The load of a day shall be counted from everything the Calendar shows for the current mode (events with repeats, tasks and bills due, Work tasks in Work mode, Study deadlines and classes in Study mode), ignoring the Calendar's category filters; a class counts as half a thing; booked hours are the sum of timed items (an item without an end counts 60 minutes, minimum 15); a clash is a timed item that starts before an earlier one ends. | Must | core/busy.js |
| FR-BSY-002 | The level of a day shall be "busy" (amber) or "packed" (red) when things, hours or clashes reach: Sensitive 4 / 6 things, 4 / 6 hours, 1 / 2 clashes; Normal 6 / 9, 6 / 9, 1 / 3 (default); Relaxed 8 / 12, 8 / 12, 2 / 4. | Must | core/busy.js, 082 |
| FR-BSY-003 | With "Busy-day alerts" off, no tint, strip, notice or evening push shall be produced. | Must | core/busy.js, 082 |
| FR-BSY-004 | The Calendar shall tint busy and packed days in the month, week and day views and show an inline notice with the reason ("<n> things · <h> h booked · <n> clashes") on the day view. | Must | calendar.js |
| FR-BSY-005 | The Dashboard, Work overview, Study overview and Calendar shall show a notice for the first busy day among today and the next 6 days ("Today is busy", "Tomorrow is packed", or the date, with "Think about moving something." when packed), with "Open <day>" and up to 4 "Also:" days; its cross shall hide it for the rest of the day. | Must | core/busy.js |
| FR-BSY-006 | The Dashboard shall show a strip of the next 7 days as squares (Light, Busy, Packed) with a key and "Tap a day to open it"; pressing a day shall open the Calendar day view on that date. | Should | core/busy.js |
| FR-BSY-007 | An hourly job shall, for each person with both "Busy-day alerts" and "Tell me the evening before" on, run only when the hour in their time zone is 18, look at tomorrow, and notify "Tomorrow is packed" or "Tomorrow is busy" using the person's level, at most once in 20 hours; the notification opens the Calendar. | Must | 082 |
| FR-BSY-008 | The server count shall include events (with daily, weekly, monthly, yearly repeats), open tasks and bills due, open Work tasks the person owns or is assigned to (spanning tasks on every day, active companies only, only with the Work add-on) and, with the Study add-on, open Study tasks due and classes of that weekday at half a thing each. | Must | 082 |
| FR-BSY-009 | The body of the evening notification shall read "<n> things[ · <h> h booked][ · <n> clash(es)]" followed by "Think about moving something." (packed) or "Open your calendar to plan it." (busy). | Should | 082 |

Notes: the server count does not look at the mode (space) of an event, while the on-screen tint counts only what the current mode shows (see Findings).

### 3.7 FBK — Feedback

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-FBK-001 | A "Feedback" menu item shall be present in every mode for every signed-in person. | Must | core/shell.html, core/modes.js |
| FR-FBK-002 | The form shall ask for a module (required, 28 choices; "Admin (administrators)" only for administrators), an optional part of it (shown only when the module has parts), a kind (Bug, Idea, Question, Praise; default Idea), comments (required, up to 4000 characters with a counter) and an optional picture. | Must | feedback.js |
| FR-FBK-003 | The module shall start as the page the person came from (Study archive maps to Study, Purchase history to Settings, admin pages to Admin, others to "Something else / the whole app"). | Should | feedback.js, core/router.js |
| FR-FBK-004 | Comments shorter than 3 characters shall show "Write a few words about it first." and not be sent (the database also requires 3 to 4000 characters). | Must | feedback.js, 081 |
| FR-FBK-005 | A picture shall be PNG, JPEG, WEBP or GIF, chosen or pasted (Ctrl / Cmd + V); a non-image shall show "Please choose a picture (PNG, JPG, WEBP or GIF)."; a picture over 1800 px or 1.5 MB shall be shrunk to JPEG (quality 0.86); a result or a GIF over 5 MB shall be refused ("That picture is bigger than 5 MB." / "too large even after shrinking it"); the person shall be able to remove it before sending. | Must | feedback.js |
| FR-FBK-006 | Sending shall upload the picture to the private bucket `luma-feedback/<user id>/...` (5 MB, images only), then add the message with the kind, module, part, comments, picture path and context (page, mode, version, screen size, language, first 160 characters of the user agent); on failure the picture shall be removed and the error shown. | Must | feedback.js, 081 |
| FR-FBK-007 | A person shall be able to send at most 10 messages in any 24 hours; the 11th shall fail with "You can send up to 10 messages a day. Please try again tomorrow." | Must | 081 |
| FR-FBK-008 | The database shall store the person's name and e-mail as a snapshot ("Name <email>"), force the status to New and the note empty on insert, refuse a picture outside the sender's own folder ("That picture is not yours"), refuse unknown kinds and a module over 60 or part over 80 characters, and a context over 2000 characters. | Must | 081 |
| FR-FBK-009 | After sending, the form shall clear and show "Thank you! Your message was sent to the developer." and a toast; "Your messages" shall list the person's last 30 messages with kind, module, part, status chip (New, Seen, Planned, Done, Won't do), note from the developer, "with a picture" and date. | Must | feedback.js |
| FR-FBK-010 | A person shall be able to read only their own feedback (administrators all) and shall not be able to change or delete it. | Must | 081 |
| FR-FBK-011 | Every administrator other than the sender (up to 20) shall be notified "New feedback: <module> › <part>" with the first 120 characters, opening the inbox. | Should | 081 |
| FR-FBK-012 | The Feedback inbox shall be for administrators only ("This page is only for administrators." otherwise), show "<n> new · <n> in total", start filtered to New, with chips All / New / Seen / Planned / Done / Won't do with counts, a module filter and a text search over message, sender and part; each card shall show kind, module, date, sender ("Deleted account" when unknown), message, picture thumbnail, context line and the controls below. | Must | feedback.js |
| FR-FBK-013 | An administrator shall set a status and a note (up to 1000 characters) and Save; the person shall be notified only when the status changes to Planned ("Your feedback is planned") or Done ("Your feedback was done") with the note, and not for New, Seen or Won't do. | Must | feedback.js, 081 |
| FR-FBK-014 | An administrator shall delete a message after confirmation "It is removed for good, with its picture."; only administrators may change a status or delete. | Must | feedback.js, 081 |
| FR-FBK-015 | Administrators shall open any picture from signed addresses valid 1 hour (thumbnails for the first 60); a person shall read and delete only pictures in their own folder. | Must | feedback.js, 081 |
| FR-FBK-016 | Deleting an account shall keep that person's feedback with no owner (user_id empty) so the developer's records stay. | Should | 081 |

### 3.8 SUP — Support

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-SUP-001 | The Support page shall show two channels: "Email us" (aeinscape@gmail.com, replies in 24h, opens the mail program) and "WhatsApp" (+60 12-210 8459, Mon–Fri 9–6, opens wa.me in a new tab), and the line "Support hours: Mon–Fri, 9am–6pm (MYT)". | Must | support.js |
| FR-SUP-002 | The contact form shall have a Subject (Billing and plans, Technical issue, Feature request, Account and privacy, Other) and a Message; an empty message shall turn the box border red and send nothing. | Should | support.js |
| FR-SUP-003 | Pressing "Send message" with text shall empty the box and show "Thanks! Our team will reply to your account email shortly."; as built, no request is made and the message is not stored or delivered anywhere. | Must | support.js |
| FR-SUP-004 | The FAQ shall list 41 questions as an accordion with one answer open at a time; the answers shall describe the current prices, limits and rules (getting started, plans, upgrades and add-ons, splits, install, Work, Work Pro, teams, companies, time, feedback, busy days, task features, Undo, calendar export, Study topics, plan end and renewal, modes, spaces, push, time zone, payroll, bills, storage, wallpapers, add-on end, password and data, delete account). | Must | support.js |
| FR-SUP-005 | The FAQ shall tell the person how to delete the account themselves (Settings → Account and data → Delete my account) and that downgrades go through WhatsApp or e-mail. | Should | support.js |
| FR-SUP-006 | The Support page shall be reachable in every mode. | Must | core/modes.js |

### 3.9 ADM — Administrator tools

#### Access and overview

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ADM-001 | An administrator is a row in `luma.admin_users`, which nobody can read or write from the app; every admin function shall refuse a caller who is not one with "Not allowed". | Must | 036 |
| FR-ADM-002 | The Admin menu item shall show only when `is_admin()` is true; the Admin, Plan report and Feedback inbox pages shall show "This page is only for administrators." to anyone else. | Must | core/start.js, admin.js |
| FR-ADM-003 | The Admin page shall show tiles Accounts, Dawn, Glow, Zenith and New in 7 days, and the subtitle "<n> accounts · <n> new this week". | Should | admin.js, 036 |
| FR-ADM-004 | The account list shall show up to 500 accounts, newest first, with a search box (name or e-mail, 300 ms after typing), and for each: initial, name or e-mail, badges Admin, You, Unverified, Deactivated, e-mail and country, "Joined <ago> · Seen <ago>", a plan tile and a tile for Work (or Work Pro) and Study with their end text or "tap to give", and a menu for account actions. | Must | admin.js, 036, 062, 065, 083 |

#### Plan, add-on and trial changes

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ADM-005 | "Change plan" shall offer Dawn, Glow, Zenith (the current one marked "(now)") and, for a paid plan, a duration of 1, 3, 6 or 12 months, until a date, or no end; Dawn has no end; for the same plan with time left a choice "Add to it" or "Start from today"; and a preview line of when it will end; Apply shall call `admin_set_plan`. | Must | admin.js, 062 |
| FR-ADM-006 | The add-on popup shall offer On / Off, Normal (set the length) or Free trial 7 days, for Work the size Work or Work Pro, the same durations and extension choice, a note whether the free trial was already used with "reset" when it was, and Apply shall call `admin_set_addon` (or `admin_give_trial`). | Must | admin.js, 062, 065, 083 |
| FR-ADM-007 | A duration in months shall be added from now or, when extending the same plan or active add-on, from its current end, with the day clamped to the end of a shorter month; "until a date" shall end at the end of that day in the person's own time zone; "no end" shall leave the end date empty; switching an add-on off shall end it now. | Must | admin.js, 062 |
| FR-ADM-008 | A free trial given by hand shall count as the person's one trial, be refused if the person already has the add-on ("They already have this add-on switched on"), and last 7 days from the screen (the function accepts 1 to 60); "Reset" shall let the person start the trial again. | Must | 065, admin.js |
| FR-ADM-009 | Changing one's own plan or add-ons shall be allowed, shall reload the plan, clear the cached pages, enforce mode access and show "Your own plan or add-ons changed"; the person shall not get a notification for their own change. | Should | admin.js, 062 |
| FR-ADM-010 | A missing migration shall show "Run supabase/migrations/<file>.sql in the SQL Editor first." instead of a technical error. | Could | admin.js |

#### Bulk free access and gifts

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ADM-011 | The list shall have a checkbox per row, "Select all shown", "Clear", the count "<n> selected", and "Pick <n> people who do not have <Study or Work>" (n from 1 to 500; skips administrators, deactivated accounts and people who already have the add-on) with "Nobody to pick ..." or "Only <n> found" notes. | Should | admin.js |
| FR-ADM-012 | "Give free access" with "Start now" shall give Study or Work for 7 days, 14 days, 1 month, 3 months or until a date to up to 500 people, skipping people who already have it or adding time to theirs (and skipping anyone who has it with no end date), without using their free trial, with a note up to 120 characters, and shall notify each person "Free <Add-on> access"; the result toast shall show given, extended and skipped counts. | Must | admin.js, 065 |
| FR-ADM-013 | "They choose when" shall send a gift instead (FR-PLN-025): length 7 days to 3 months, use-by 30 / 60 / 90 days or none, people with 3 unused gifts or deactivated skipped; the toast shall show sent and skipped counts. | Must | admin.js, 069 |
| FR-ADM-014 | Giving free access shall require a length (and a date when "until a date" is chosen: "Pick the last day.") and at least one person ("Pick at least one person"); more than 500 people shall be refused ("Up to 500 people at a time"). | Must | admin.js, 065, 069 |

#### Account actions

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ADM-015 | An administrator shall be able to deactivate an account with an optional reason (up to 200 characters): the profile is marked, sign-in is refused (banned until "infinity"), every open session is deleted, the data is kept; "Reactivate" shall clear both; deactivating oneself or another administrator shall be refused. | Must | 065, admin.js |
| FR-ADM-016 | An administrator shall be able to make another person an administrator (not a deactivated account) or remove that access (never their own), after a confirmation, notifying the person on promotion. | Must | 068, admin.js |
| FR-ADM-017 | An administrator shall be able to delete a non-administrator account by typing the account's e-mail and confirming "Delete <name> forever?"; the `account` function removes the files and the sign-in (FR-ACC-006). | Must | admin.js, functions/account |
| FR-ADM-018 | The account popup for oneself or another administrator shall hide deactivate and delete and explain "This is your own account." or "Remove their administrator access first to deactivate or delete them." | Should | admin.js |
| FR-ADM-019 | The page shall list the 15 most recent admin actions (function allows up to 200) with the kind (Started a free trial, Reset a free trial, Gave free access, Sent a gift to start later, Deactivated, Reactivated, Deleted an account, Made an administrator, Removed an administrator), the target or counts, the administrator's name and the time; only administrators shall read the log. | Must | admin.js, 065, 068 |

#### Reports and limits

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ADM-020 | The Plan report page shall show, for up to 36 months, a stacked chart of people on each plan at the end of each month, month tiles (Accounts, New sign-ups, Dawn, Glow, Zenith, Upgrades, Downgrades), a month-by-month table, chips Last 3 / 6 / 12 months and All, From and To selectors, "(so far)" for the current month, and a "Download CSV" named `luma-plan-report-<from>-to-<to>.csv`. | Should | adminreport.js, 040 |
| FR-ADM-021 | The Work report shall show Have Work now, On a free trial, Paid or given, Trials ever started, Active in 30 days, companies, projects and other counts, and a table of new Work users, projects, tasks and hours by month. | Should | adminreport.js, 080 |
| FR-ADM-022 | The Plan limits editor shall show every limit for Dawn, Glow, Zenith, Work and Work Pro as number boxes (empty = unlimited, whole numbers from 0), light up changed boxes, offer "Save <n> changes" and "Undo changes", save the changes one by one (stopping at the first error with "<n> saved, then it stopped: ..."), and say "Saved <n> changes. They apply straight away."; the function shall refuse negative numbers and keys that do not exist. | Must | admin.js, 082 |
| FR-ADM-023 | The Admin page shall show a Feedback inbox card with the count of new messages and links to the Plan report, the inbox and the limits editor. | Should | admin.js |

### 3.10 ACC — Account, export and delete

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-ACC-001 | "Export" (Settings → Account and data) shall build one JSON file `luma-export-<date>.json` with the export time, account (e-mail, name, plan, time zone), tasks, events, notes (title, body, tag, date), habits and habit logs, goals, bills and subscriptions with payments, money entries, Study data (with the Study add-on), reminders, health logs and document names and sizes, and show "Your data was downloaded. Uploaded files are not included, only their names." | Must | settings.js |
| FR-ACC-002 | While the file is prepared the button shall read "Preparing..." and be disabled; a failure shall show "Could not export: ...". | Should | settings.js |
| FR-ACC-003 | "Delete my account" shall open a popup that lists what is removed, offers "download my data first", and enables the final button only when the typed e-mail equals the person's e-mail (not case-sensitive); pressing it shall ask once more "Delete your account forever?". | Must | settings.js, settings.html |
| FR-ACC-004 | An administrator shall see a note instead of the delete form (an administrator account can not be deleted here, the function also refuses). | Must | settings.js, functions/account |
| FR-ACC-005 | The `account` function shall need a valid sign-in ("Please sign in again." 401), accept only POST with action "delete", reject a malformed user id, and answer 404 "No such account." for an unknown id. | Must | functions/account |
| FR-ACC-006 | A person deleting their own account shall have to send their e-mail ("Type your email address to confirm."); an administrator may delete another person who is not an administrator; anyone else asking to delete another account shall get "Not allowed." (403); nobody may delete an administrator. | Must | functions/account |
| FR-ACC-007 | Deletion shall remove every file under the person's folder in the buckets `luma-documents`, `luma-backgrounds` and `luma-feedback` (up to 4 levels, in batches of 100) and then delete the sign-in, so that every row linked to it is removed by cascade. | Must | functions/account, 003, 042, 081 |
| FR-ACC-008 | A deletion shall be written to the admin audit as "delete_account" with whether it was by the person and the number of files removed; audit rows are kept after the account is gone. | Must | functions/account, 065 |
| FR-ACC-009 | After a successful self-deletion the app shall sign out, clear localStorage and sessionStorage, and open `/login/?deleted=1`; if the function is not deployed it shall say "Account deletion is not switched on yet. Please contact support to delete your account." | Must | settings.js |
| FR-ACC-010 | Deleting an account shall not change other people's data (shared items owned by the deleted person go with the person). | Must | 036, tests |
| FR-ACC-011 | Feedback already sent shall remain without an owner (FR-FBK-016) and gifts, history and other personal rows shall be removed. | Should | 081, 063, 069 |

## 4. Non-functional requirements

### 4.1 NFR-SEC — Security

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-SEC-001 | Every table in schema `luma` that holds personal data shall have RLS on, with policies that allow a person only their own rows (profiles, notifications, push_subscriptions, reminder_prefs, feedback, purchase_history, addon_gifts, user_addons), and tables with no policy (admin_users, admin_audit, plan_changes) shall be unreachable from the app. | Must | 001, 008, 014, 031, 036, 044, 063, 065, 069, 081 |
| NFR-SEC-002 | Functions that run with the owner's rights (security definer) shall fix `search_path` to empty so objects cannot be hijacked. | Must | all migrations |
| NFR-SEC-003 | Every `admin_*` function shall check `luma.is_admin()` first and have execute removed from public and anon. | Must | 036, 062, 065, 068, 069, 081, 082, 083 |
| NFR-SEC-004 | Internal helpers (`notify`, `plan_of`, `limit_of`, `has_addon`, `admin_log`, `run_*` jobs, `busy_day_stats`) shall not be callable by signed-in people; `has_my_addon` answers only about the caller. | Must | 008, 033, 044, 046, 065 |
| NFR-SEC-005 | Plan, plan end, deactivation and the fields of other people shall be protected by triggers that reset them for the "authenticated" and "anon" roles unless an administrator function sets a switch for its own statement. | Must | 033, 036, 062, 065 |
| NFR-SEC-006 | The storage buckets luma-documents, luma-backgrounds and luma-feedback shall be private, with policies that allow a person only the folder named after their own id (administrators may also read and delete feedback pictures); signed addresses shall be time-limited (7 days for wallpapers, 1 hour for feedback pictures). | Must | 003, 042, 081 |
| NFR-SEC-007 | The `account` function shall keep JWT verification on, confirm the caller with the access token, use the service role only inside the function, and allow cross-origin calls (CORS `*`) only because the call is authenticated. | Must | functions/account |
| NFR-SEC-008 | The `send-push` function shall reject calls without the shared secret, and the VAPID private key and webhook secret shall exist only as function secrets; the browser shall hold only the public VAPID key and the publishable Supabase key. | Must | functions/send-push, shared/push-config.js, shared/supabase-config.js |
| NFR-SEC-009 | Text from people (notification titles and bodies, feedback, names, search results) shall be HTML-escaped before it is drawn. | Must | core/ui.js, notifications.js, feedback.js, admin.js |
| NFR-SEC-010 | A deactivated account shall be refused at sign-in at the authentication layer (ban) and have its sessions deleted, not only hidden in the app. | Must | 065 |
| NFR-SEC-011 | Input limits shall be enforced in the database as well as in the form (feedback length, kind, module, part, context, image path and folder; gifts length and note; limits non-negative). | Should | 081, 069, 082 |
| NFR-SEC-012 | Scripts loaded from a content network (supabase-js, Font Awesome, Google Fonts) should be pinned to a version and carry integrity hashes; at present supabase-js is loaded as `@2` without an integrity attribute. | Should | app/index.html, login/index.html |

### 4.2 NFR-PRF — Performance

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-PRF-001 | The app shall fetch its 24 markup files in parallel and show the loading cover immediately; on staging scripts are fetched fresh, on production they are cached per version. | Should | boot.js |
| NFR-PRF-002 | The loading cover shall never be shown for less than 1 second nor stay without an error message for more than 3 minutes. | Must | luma-loader.js |
| NFR-PRF-003 | Global search shall reuse its data for 60 seconds and fetch money entries for at most the last 24 months. | Should | search.js |
| NFR-PRF-004 | Lists shall be bounded: 200 notifications, 500 accounts in Admin, 500 feedback rows (60 thumbnails), 30 own feedback messages, 40 purchase-history rows per page. | Should | notifications.data.js, admin.js, feedback.js, purchases.js |
| NFR-PRF-005 | Pictures shall be shrunk in the browser before upload (wallpaper 1920 px JPEG 0.85; feedback 1800 px JPEG 0.86). | Should | appearance.js, feedback.js |
| NFR-PRF-006 | The minute-by-minute reminder jobs shall touch only people who have the feature switched on. | Should | 014, 018, 030, 032, 052 |
| NFR-PRF-007 | Time-to-interactive and page-load targets: TBC (none are written in the code). | Could | TBC |

### 4.3 NFR-AVL — Availability and resilience

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-AVL-001 | If the plan cannot be fetched the app shall retry 3 times (0.5, 1, 1.5 s) and then use Dawn limits. | Must | luma-plan.js |
| NFR-AVL-002 | A failed save of theme, wallpaper or preferences shall be kept and re-sent at the next start. | Should | appearance.js |
| NFR-AVL-003 | The notification list shall resync when a sleeping tab wakes, because realtime may miss events. | Should | notifications.js |
| NFR-AVL-004 | The service worker does not cache anything, so LUMA needs a connection to open; offline use is not supported. | Should | sw.js |
| NFR-AVL-005 | Reminder, expiry and busy-day jobs depend on the pg_cron extension; if it cannot be enabled, the migration shall raise a notice and the jobs are not scheduled. | Must | 014 and later |
| NFR-AVL-006 | Production shall use staging keys until production keys are filled in, so a missing key never leaves the site without a database. | Should | supabase-config.js |
| NFR-AVL-007 | Hosting is Vercel (static) plus Supabase; availability targets: TBC. | Could | vercel.json |

### 4.4 NFR-RSP — Responsiveness

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-RSP-001 | Every page and popup shall fit without horizontal page scrolling at widths 320, 360 and 390 px (phone) and 1180 px (laptop). | Must | responsive.css, rig/audit.js |
| NFR-RSP-002 | The layout shall change at 1024, 768, 560, 480, 420 and 360 px; at 768 px and below the menu becomes a drawer. | Must | responsive.css, shell.js |
| NFR-RSP-003 | The app shall use the full screen on notched phones (`viewport-fit=cover`) and install in standalone mode. | Should | app/index.html, manifest |
| NFR-RSP-004 | Popups shall have a fixed header and action bar with only the fields scrolling. | Should | skins.js |
| NFR-RSP-005 | The authentication pages shall be usable at 320 px width. | Must | login.css, register.css |

### 4.5 NFR-AXS — Accessibility

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-AXS-001 | Dialogs, dropdowns, pickers and panels shall close with Escape; dialogs accept Enter. | Should | dialogs.js, ui.js, skins.js |
| NFR-AXS-002 | The search button shall be reachable and operable by keyboard (role button, tabindex, Enter and Space); the bell and log-out icons should also be. | Should | shell.html |
| NFR-AXS-003 | Icon-only buttons should carry an accessible name (the feedback picture remove, busy-notice cross and inbox delete do). | Should | feedback.js, busy.js |
| NFR-AXS-004 | The loading cover and the undo bar shall be announced as status messages. | Could | luma-loader.js, ui.js |
| NFR-AXS-005 | Colour contrast, reduced-motion handling and screen-reader testing: TBC. | Could | TBC |

### 4.6 NFR-BRW — Browser support

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-BRW-001 | LUMA shall work in current Chrome, Edge, Firefox and Safari on desktop, and in Safari on iPhone and Chrome on Android. | Must | convention |
| NFR-BRW-002 | On iPhone and iPad, notifications shall need LUMA to be added to the Home Screen first; the app shall say so. | Must | push.js, luma-install.js |
| NFR-BRW-003 | Features that need a newer browser (time zone offset names, Web Push, service worker) shall degrade: the offset text falls back to "GMT", push falls back to tab-only notifications, "unsupported" is shown. | Should | luma-auth.js, push.js |
| NFR-BRW-004 | The code shall run as classic scripts without a build step. | Should | boot.js |

### 4.7 NFR-PRV — Privacy

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-PRV-001 | A person's data shall be visible only to them, to people they shared it with, and (for the listed fields) to administrators. | Must | RLS |
| NFR-PRV-002 | A person shall be able to export their data and delete their account and all its files themselves. | Must | settings.js, account |
| NFR-PRV-003 | The browser shall store only these keys: `luma.remember`, `luma.rememberedEmail` (only when remembered), `luma_plan_cache`, `luma_mode`, `luma_push_declined`, `luma_profile_pending`, `luma_installed`, the Supabase session, and the busy-notice and booted flags in session storage; all are cleared on account deletion. | Should | luma-auth.js and others |
| NFR-PRV-004 | Feedback shall send only the person's name and e-mail and the context listed in FR-FBK-006. | Must | feedback.js |
| NFR-PRV-005 | Lumi sends a message and the data it needs to an AI service (Google Gemini or Groq); the FAQ shall say so. | Must | support.js |
| NFR-PRV-006 | The Terms of Service and Privacy Policy pages shall exist and be linked at registration; at present the links are placeholders. | Should | register/index.html |

### 4.8 NFR-OBS — Observability

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-OBS-001 | Administrator actions on trials, gifts, free access, deactivation, administrator roles and account deletion shall be logged with who, whom and when. | Must | 065, 068 |
| NFR-OBS-002 | Plan and add-on changes shall be recorded per person in the purchase history. | Must | 063 |
| NFR-OBS-003 | The app version shall be shown in the sidebar and staging shall be marked. | Should | supabase-config.js |
| NFR-OBS-004 | Client failures shall be written to the browser console with a "LUMA:" prefix; `send-push` and `account` shall log failures to the function logs. | Should | boot.js, functions |
| NFR-OBS-005 | Monitoring and alerting of the cron jobs and push delivery: TBC. | Could | TBC |

### 4.9 NFR-MNT — Maintainability

| ID | Requirement | Priority | Source |
|---|---|---|---|
| NFR-MNT-001 | Each module shall live in `app/modules/<name>/` with its own html, css and js, listed in `boot.js` and `app/index.html`. | Should | boot.js |
| NFR-MNT-002 | Every change shall bump `LUMA_VERSION` and add a `CHANGELOG.md` entry. | Should | CHANGELOG.md |
| NFR-MNT-003 | Migrations shall be safe to re-run and apply cleanly in order (tested by `pg_boot`). | Must | sql/pg_boot.js |
| NFR-MNT-004 | Plan numbers shall be kept in one table (`plan_limits`) and editable without SQL. | Should | 033, 082 |
| NFR-MNT-005 | Automated suites for admin, gifts, feedback, busy-day, page rendering and phone-width audits shall exist and pass. | Should | docs/test-automation |
