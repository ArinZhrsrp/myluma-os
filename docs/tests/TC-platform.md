# Test cases — Platform and cross-cutting features

Covers `docs/srs/SRS-platform.md` (LUMA 0.26.4). Areas in order: AUTH, SHL, SET, PLN, NTF, BSY, FBK, SUP, ADM, ACC, then NFR cases (security, responsive, compatibility, performance).

Common test accounts: **A** (Dawn, no add-ons), **B** (Zenith, Work and Study on), **ADMIN** (administrator), **C** (a second Dawn person). Phone widths 320, 360, 390 px; laptop 1180 px. Browsers: Chrome, Safari (incl. iPhone PWA), Firefox, Edge.

Automation names refer to `docs/test-automation/`: `pg_boot` (all migrations apply), `pg_admin_test`, `pg_gift_test`, `pg_feedback_test`, `pg_busy_test` (SQL, PGlite), `v41_test` (every Personal page renders, jsdom), `v49_test` (Work, date picker, busy-day UI, feedback UI, jsdom), `audit` / `audit_modals` (phone-width overflow, Chrome headless), `reset_test` (reset-password lock, jsdom).

## 1. AUTH — Authentication and session

#### TC-AUTH-001 — Register with valid data
- **Requirement:** FR-AUTH-001, FR-AUTH-005, FR-AUTH-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed out; a real mailbox.
- **Test data:** First "Aina", last "Rahman", country Malaysia, time zone GMT+08:00, a new e-mail, password "secret1".
- **Steps:**
  1. Open `/register/`.
  2. Fill every field, repeat the password, tick the Terms box.
  3. Press "Create account".
- **Expected result:** The button reads "Creating account…", then `/verify-email/?sent=1&email=<address>` opens with "Account created. We emailed you a code." A profile on plan Dawn exists after verifying and a "Welcome to LUMA" notification is in the bell.
- **Automation:** `pg_boot` (profile trigger and welcome trigger apply) · otherwise Manual / Device only (real e-mail).

#### TC-AUTH-002 — Create account stays disabled until Terms is ticked
- **Requirement:** FR-AUTH-003
- **Type / Priority:** Negative · P1
- **Preconditions:** Register page open.
- **Test data:** None.
- **Steps:**
  1. Look at the "Create account" button with the box unticked; hover it.
  2. Tick the box, then untick it.
- **Expected result:** Disabled with tooltip "Tick the box to agree to the Terms of Service and Privacy Policy first"; enabled only while ticked.
- **Automation:** Manual.

#### TC-AUTH-003 — Passwords do not match on register
- **Requirement:** FR-AUTH-004
- **Type / Priority:** Negative · P1
- **Preconditions:** Register page filled, Terms ticked.
- **Test data:** Password "secret1", repeat "secret2".
- **Steps:** 1. Press "Create account".
- **Expected result:** "Passwords don't match." is shown; no request is sent (no network call to sign-up).
- **Automation:** Manual.

#### TC-AUTH-004 — Password minimum length on register
- **Requirement:** FR-AUTH-001
- **Type / Priority:** Boundary · P2
- **Preconditions:** Register page.
- **Test data:** Passwords "12345" (5) and "123456" (6).
- **Steps:** 1. Enter 5 characters in both boxes and submit. 2. Repeat with 6.
- **Expected result:** 5 characters: the browser blocks the form (minimum 6). 6 characters: the form is accepted.
- **Automation:** Manual.

#### TC-AUTH-005 — Country and time zone defaults
- **Requirement:** FR-AUTH-002
- **Type / Priority:** Functional · P3
- **Preconditions:** Browser time zone Asia/Singapore (or another offered zone).
- **Test data:** None.
- **Steps:** 1. Open the register page; note the zone and country. 2. Choose country "Japan". 3. Change the time zone to Tokyo. 4. On a fresh load change only the time zone.
- **Expected result:** Zone starts as the browser's zone (else Kuala Lumpur); country follows the zone until the person picks one; after step 2 the country stays "Japan" when the zone changes; the zone list has 28 entries sorted by offset and the country list 38 ending in "Other".
- **Automation:** Manual.

#### TC-AUTH-006 — Duplicate or invalid e-mail on register
- **Requirement:** FR-AUTH-006
- **Type / Priority:** Negative · P2
- **Preconditions:** An already registered, confirmed address.
- **Test data:** That address.
- **Steps:** 1. Fill the form with it and submit.
- **Expected result:** The server's message appears in the red box (or the flow continues to the verify page without revealing the account; TBC which, depends on Supabase settings); the button returns to "Create account".
- **Automation:** Manual.

#### TC-AUTH-007 — Social buttons
- **Requirement:** FR-AUTH-007
- **Type / Priority:** Negative · P3
- **Preconditions:** Login and register pages.
- **Test data:** None.
- **Steps:** 1. Press "Google", then "Apple" on each page.
- **Expected result:** Login: "Google sign-in isn't connected yet — use email for now."; register: "Google sign-up isn't connected yet — create an account with email for now."; nothing else happens.
- **Automation:** Manual.

#### TC-AUTH-008 — Verify e-mail with the correct code
- **Requirement:** FR-AUTH-008, FR-AUTH-010
- **Type / Priority:** Functional · P1
- **Preconditions:** New account waiting for confirmation, code received.
- **Test data:** The 6-digit code.
- **Steps:** 1. Open the verify page from the register redirect. 2. Type letters and digits ("12ab34"). 3. Enter the real code. 4. Press "Verify and continue".
- **Expected result:** Header says "We sent a 6-digit code to <email>."; letters are removed as typed; success shows "Email verified. Taking you in…" and opens `/app/` already signed in; closing and reopening the browser keeps the session.
- **Automation:** Device only (real e-mail).

#### TC-AUTH-009 — Verify with wrong, short or expired code
- **Requirement:** FR-AUTH-009, FR-AUTH-010
- **Type / Priority:** Negative · P1
- **Preconditions:** Verify page.
- **Test data:** "123" ; "000000".
- **Steps:** 1. Submit "123". 2. Submit "000000".
- **Expected result:** "Enter the full code from the email." for the short code; "That code is wrong or has expired. Check it, or send a new code." for the wrong one; button re-enabled each time.
- **Automation:** Manual.

#### TC-AUTH-010 — Verify page without e-mail in the address
- **Requirement:** FR-AUTH-008, FR-AUTH-009
- **Type / Priority:** Functional · P3
- **Preconditions:** None.
- **Test data:** None.
- **Steps:** 1. Open `/verify-email/` with no query. 2. Submit with the e-mail empty.
- **Expected result:** An E-mail field and "Enter your email and the code we sent you." show; submitting empty shows "Enter your email first."
- **Automation:** Manual.

#### TC-AUTH-011 — Resend code timing
- **Requirement:** FR-AUTH-011
- **Type / Priority:** Boundary · P2
- **Preconditions:** Arrive from sign-up (`?sent=1`).
- **Test data:** None.
- **Steps:** 1. Watch the button on arrival. 2. After it enables, press it. 3. Watch again.
- **Expected result:** Starts as "Send a new code in 45s" counting down and disabled; after sending, "A new code is on its way to <email>." and a 60 s countdown. A server error shows its text and enables the button at once.
- **Automation:** Manual.

#### TC-AUTH-012 — Login success and remember me on (default)
- **Requirement:** FR-AUTH-012, FR-AUTH-014
- **Type / Priority:** Functional · P1
- **Preconditions:** Confirmed account.
- **Test data:** Valid e-mail and password.
- **Steps:** 1. Open `/login/`; check "Remember me" is ticked. 2. Sign in. 3. Close the browser completely and reopen `/app/`. 4. Open `/login/` again.
- **Expected result:** Button "Signing in…", then the dashboard; still signed in after restart; the login page redirects to `/app/` (FR-AUTH-015); remembered e-mail is pre-filled after logging out and returning to the login page.
- **Automation:** Manual.

#### TC-AUTH-013 — Remember me off ends the session with the browser
- **Requirement:** FR-AUTH-014
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed out.
- **Test data:** Valid account.
- **Steps:** 1. Untick "Remember me" and sign in. 2. Close the whole browser, reopen `/app/`. 3. Check that the e-mail is not pre-filled on `/login/`.
- **Expected result:** Opening `/app/` sends the person to `/login/`; the e-mail box is empty.
- **Automation:** Manual.

#### TC-AUTH-014 — Wrong password and unknown e-mail
- **Requirement:** FR-AUTH-012
- **Type / Priority:** Negative · P1
- **Preconditions:** Login page.
- **Test data:** Right e-mail, wrong password; unknown e-mail.
- **Steps:** 1. Submit each.
- **Expected result:** The server's message (for example "Invalid login credentials") in the red box; button back to "Sign in"; stay on the login page.
- **Automation:** Manual.

#### TC-AUTH-015 — Login with an unconfirmed e-mail
- **Requirement:** FR-AUTH-013
- **Type / Priority:** Functional · P2
- **Preconditions:** Account that never entered its code.
- **Test data:** Its e-mail and password.
- **Steps:** 1. Sign in.
- **Expected result:** A new code is sent and `/verify-email/?sent=1&email=…` opens.
- **Automation:** Device only (real e-mail).

#### TC-AUTH-016 — Deactivated account cannot sign in
- **Requirement:** FR-AUTH-016, FR-AUTH-027
- **Type / Priority:** Security · P1
- **Preconditions:** Account deactivated by ADMIN.
- **Test data:** That account.
- **Steps:** 1. Try to sign in. 2. Open `/login/?disabled=1`. 3. Deactivate an account that is signed in on another device and reload the app there.
- **Expected result:** "This account has been deactivated. Please contact support if you think this is a mistake." in steps 1 and 2; step 3 returns to `/login/?disabled=1`.
- **Automation:** `pg_admin_test` (profile marked, sign-in banned, sessions deleted) · message text Manual.

#### TC-AUTH-017 — Forgot password flow
- **Requirement:** FR-AUTH-019, FR-AUTH-023
- **Type / Priority:** Functional · P1
- **Preconditions:** Account with a real mailbox.
- **Test data:** Its e-mail.
- **Steps:** 1. Click "Forgot password?" with the e-mail box empty. 2. Type the e-mail and click it again. 3. Open the link from the mail.
- **Expected result:** Step 1: "Enter your email above first, then click "Forgot password?""; step 2: "Password reset link sent to <email>."; step 3: the reset page with the form enabled. A link that lands on another page with `type=recovery` in the address is forwarded to `/reset-password/`.
- **Automation:** Manual / Device only (real e-mail link).

#### TC-AUTH-018 — Forgot password with a blocked address
- **Requirement:** FR-AUTH-019
- **Type / Priority:** Negative · P3
- **Preconditions:** Login page.
- **Test data:** "test@example.com".
- **Steps:** 1. Click "Forgot password?".
- **Expected result:** "This Supabase project blocks @example.com addresses. Use a real email address, such as Gmail, to receive the reset link." (when the server refuses it).
- **Automation:** Manual.

#### TC-AUTH-019 — Reset page: expired or missing link
- **Requirement:** FR-AUTH-020
- **Type / Priority:** Negative · P1
- **Preconditions:** None.
- **Test data:** Open `/reset-password/` with no token; then with `#error_code=otp_expired`.
- **Steps:** 1. Open each address and wait about 3 seconds.
- **Expected result:** "This link is invalid or has expired."; the form is disabled; the first shows "No reset link was found in this address…", the second "This reset link has expired or was already used…".
- **Automation:** Manual.

#### TC-AUTH-020 — Reset password loading lock
- **Requirement:** FR-AUTH-021
- **Type / Priority:** Functional · P1
- **Preconditions:** Valid reset session.
- **Test data:** New password "abcdef" twice.
- **Steps:** 1. Submit, then immediately click the button and press Enter several times. 2. Wait.
- **Expected result:** One request only; inputs and button disabled with a spinner "Updating your password…"; then "Redirecting to sign in…" and `/login/` after about 1.2 s with the person signed out. On a server error (for example weak password) the form unlocks and shows the message.
- **Automation:** `reset_test` (jsdom: 3 submits give 1 call, lock, error path) · real link Manual.

#### TC-AUTH-021 — Reset password mismatch and short password
- **Requirement:** FR-AUTH-022
- **Type / Priority:** Boundary · P2
- **Preconditions:** Valid reset session.
- **Test data:** "abcdef"/"abcdeg"; "abc"/"abc".
- **Steps:** 1. Submit the first pair. 2. Submit the second.
- **Expected result:** "Passwords don't match." with no request; a 3-character password is blocked by the form (minimum 6).
- **Automation:** Manual.

#### TC-AUTH-022 — Logout with confirmation
- **Requirement:** FR-AUTH-025
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in.
- **Test data:** None.
- **Steps:** 1. Press the top-bar log-out icon, then Cancel. 2. Press it again, then "Log out". 3. Repeat from Settings → Log out. 4. Press Back.
- **Expected result:** Cancel closes the dialog; confirming shows "Logging out…" and opens `/login/`; Back does not show the app (opening `/app/` returns to login).
- **Automation:** Manual.

#### TC-AUTH-023 — App gate without a session
- **Requirement:** FR-AUTH-024
- **Type / Priority:** Security · P1
- **Preconditions:** Signed out.
- **Test data:** None.
- **Steps:** 1. Open `/app/#settings` directly.
- **Expected result:** Redirect to `/login/`; no app data is shown.
- **Automation:** Manual.

#### TC-AUTH-024 — Sign out other devices
- **Requirement:** FR-AUTH-026
- **Type / Priority:** Functional · P2
- **Preconditions:** Same account signed in on phone and laptop.
- **Test data:** None.
- **Steps:** 1. On the laptop open Settings → Sign out other devices → confirm. 2. On the phone reload after a few minutes (or wait for token refresh).
- **Expected result:** Laptop: "Signed out of your other devices." and stays signed in; phone is signed out when its token is refreshed (access tokens may live up to their expiry, TBC).
- **Automation:** Device only.

#### TC-AUTH-025 — Change password from Settings
- **Requirement:** FR-AUTH-029
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in.
- **Test data:** None.
- **Steps:** 1. Settings → Account and data → "Send link".
- **Expected result:** Button disabled while sending; "Check your email, <address>, for the link to set a new password."
- **Automation:** Manual.

#### TC-AUTH-026 — Display name fallback
- **Requirement:** FR-AUTH-028
- **Type / Priority:** Data · P3
- **Preconditions:** An account with no first name in profile or sign-up data.
- **Test data:** e-mail "zed@x.com".
- **Steps:** 1. Sign in and read the greeting.
- **Expected result:** "Good <time of day>, zed".
- **Automation:** Manual.

#### TC-AUTH-027 — Login and register at 320 px
- **Requirement:** FR-AUTH-001, FR-AUTH-012, NFR-RSP-005
- **Type / Priority:** Responsive · P2
- **Preconditions:** Browser width 320 px.
- **Test data:** None.
- **Steps:** 1. Open login, register, verify-email and reset-password pages.
- **Expected result:** No horizontal scroll; all fields, the eye icon and buttons fully visible and tappable.
- **Automation:** Manual (`audit` covers `/app/` only).

#### TC-AUTH-028 — Deleted-account banner on login
- **Requirement:** FR-AUTH-017
- **Type / Priority:** Functional · P3
- **Preconditions:** None.
- **Test data:** `/login/?deleted=1`.
- **Steps:** 1. Open the address.
- **Expected result:** Green text "Your account and all its data have been deleted. Thank you for trying LUMA."
- **Automation:** Manual.

#### TC-AUTH-029 — Password eye icon
- **Requirement:** FR-AUTH-018
- **Type / Priority:** Usability · P3
- **Preconditions:** Login page.
- **Test data:** Any text.
- **Steps:** 1. Type in the password box; press the eye icon twice.
- **Expected result:** Text shows plainly, then hides again.
- **Automation:** Manual.

#### TC-AUTH-030 — Signed-in visitors skip login and register
- **Requirement:** FR-AUTH-015
- **Type / Priority:** Functional · P2
- **Preconditions:** Signed in.
- **Test data:** None.
- **Steps:** 1. Open `/login/` and `/register/`.
- **Expected result:** Both redirect to `/app/`.
- **Automation:** Manual.

## 2. SHL — App shell

#### TC-SHL-001 — Boot sequence loads the whole app
- **Requirement:** FR-SHL-001, FR-SHL-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in, Chrome.
- **Test data:** None.
- **Steps:** 1. Open `/app/` with the network tab open. 2. Watch the loading cover.
- **Expected result:** 24 markup files fetched, scripts loaded one after another, the cover shows at least 1 second, then the dashboard; no console error.
- **Automation:** `v41_test` (all Personal pages render, no errors, jsdom) · timing Manual.

#### TC-SHL-002 — A blocked script does not stop the app
- **Requirement:** FR-SHL-001
- **Type / Priority:** Negative · P3
- **Preconditions:** Block one module script (for example `modules/analytics/insights.js`) in dev tools.
- **Test data:** None.
- **Steps:** 1. Reload.
- **Expected result:** Console shows "LUMA: could not load …"; the rest of the app starts.
- **Automation:** Manual.

#### TC-SHL-003 — Markup file missing keeps the cover
- **Requirement:** FR-SHL-002, FR-SHL-003
- **Type / Priority:** Negative · P2
- **Preconditions:** Block `core/shell.html` (returns 404).
- **Test data:** None.
- **Steps:** 1. Reload and wait.
- **Expected result:** Cover stays; after 3 minutes "Something went wrong — Please refresh the page or try again later." with "Refresh page", which reloads.
- **Automation:** Manual.

#### TC-SHL-004 — Start order and plan popup then push popup
- **Requirement:** FR-SHL-004, FR-PLN-010, FR-NTF-016
- **Type / Priority:** Integration · P2
- **Preconditions:** Brand-new Dawn account, notifications not yet decided.
- **Test data:** None.
- **Steps:** 1. Sign in for the first time. 2. Choose "Stay on Dawn". 3. Observe.
- **Expected result:** The plan popup appears first; after closing it, "Turn on notifications?" appears.
- **Automation:** Manual.

#### TC-SHL-005 — Version label and staging marker
- **Requirement:** FR-SHL-005
- **Type / Priority:** Functional · P3
- **Preconditions:** Staging host and production host.
- **Test data:** None.
- **Steps:** 1. Read the line under "Your Personal OS" on both hosts.
- **Expected result:** Staging: "Version 0.26.4 · STAGING" (amber); production: "Version 0.26.4" only. While production keys are blank, production uses the staging database (TBC with the owner).
- **Automation:** Manual.

#### TC-SHL-006 — Personal menu
- **Requirement:** FR-SHL-006
- **Type / Priority:** Functional · P1
- **Preconditions:** Account A (not admin), Personal mode.
- **Test data:** None.
- **Steps:** 1. Read the menu.
- **Expected result:** Dashboard, Calendar, Reminders, Tasks & Work, Money, Split expenses, Subscriptions, Bills, Goals, Habits, Health, Notes & Docs, Documents, Contacts, Lumi, Analytics, Settings, Support, Feedback; no Admin.
- **Automation:** `v41_test` (pages exist) · menu list Manual.

#### TC-SHL-007 — Work and Study menus
- **Requirement:** FR-SHL-007, FR-SHL-008, FR-SHL-009
- **Type / Priority:** Functional · P1
- **Preconditions:** Account B.
- **Test data:** None.
- **Steps:** 1. Switch to Work and read the menu. 2. Switch to Study and read it.
- **Expected result:** Work: Work, Company, Calendar, Reminders, Documents, Contacts, Lumi, Settings, Support, Feedback. Study: Study, Study archive, Calendar, Reminders, Notes, Documents, Lumi, Settings, Support, Feedback. The menu list scrolls from the top after each switch.
- **Automation:** `v49_test` (Work menu for a guest and member) · Study Manual.

#### TC-SHL-008 — Work mode without the add-on
- **Requirement:** FR-SHL-007, FR-SHL-010
- **Type / Priority:** Negative · P1
- **Preconditions:** Account A.
- **Test data:** None.
- **Steps:** 1. Press "Work" on the switcher.
- **Expected result:** The switcher shows a lock on Work and Study; pressing Work opens the "Work mode" add-on popup; the mode does not change.
- **Automation:** Manual.

#### TC-SHL-009 — Mode switch opens the mode home and is remembered
- **Requirement:** FR-SHL-010, FR-SHL-011
- **Type / Priority:** Functional · P2
- **Preconditions:** Account B.
- **Test data:** None.
- **Steps:** 1. Switch to Study (lands on Study). 2. Sign out and in again. 3. Open `/app/#calendar` in Study mode and reload.
- **Expected result:** After sign-in the app returns to Study mode on its home; with a page in the address a reload keeps that page.
- **Automation:** Manual.

#### TC-SHL-010 — Saved mode is dropped when the add-on is gone
- **Requirement:** FR-SHL-011, FR-SHL-014
- **Type / Priority:** Functional · P1
- **Preconditions:** B in Work mode; ADMIN switches B's Work off.
- **Test data:** None.
- **Steps:** 1. Keep the app in the background for over 2 minutes. 2. Bring it forward.
- **Expected result:** The plan is re-checked; B is moved to Personal / Dashboard and Work shows the lock.
- **Automation:** Manual.

#### TC-SHL-011 — Opening a page of another mode switches the menu
- **Requirement:** FR-SHL-012, FR-SHL-021
- **Type / Priority:** Integration · P2
- **Preconditions:** B in Personal mode.
- **Test data:** A Study assignment titled "ER report".
- **Steps:** 1. Search "ER report" and choose it.
- **Expected result:** The mode becomes Study, the Study page opens on the item.
- **Automation:** Manual.

#### TC-SHL-012 — Guest into Work and Study
- **Requirement:** FR-SHL-013
- **Type / Priority:** Functional · P2
- **Preconditions:** C has no add-ons; invited to B's Work project and B's Study group project.
- **Test data:** None.
- **Steps:** 1. As C open the mode switcher.
- **Expected result:** Work and Study open (read only in Work); a project C owns alone does not unlock Study.
- **Automation:** `v49_test` (guest Work view) · Study Manual.

#### TC-SHL-013 — Routing, hash and fresh launch
- **Requirement:** FR-SHL-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in.
- **Test data:** None.
- **Steps:** 1. Open Bills; note the address and title. 2. Press reload. 3. Close the tab, open `/app/#bills` in a new tab.
- **Expected result:** Title "Bills", menu item highlighted, address `#bills`; reload stays on Bills; a new tab opens the Dashboard and clears the hash.
- **Automation:** `v41_test` (goTo for every page).

#### TC-SHL-014 — Locked pages open the add-on popup
- **Requirement:** FR-SHL-016
- **Type / Priority:** Negative · P1
- **Preconditions:** Account A.
- **Test data:** `/app/#study`, `#company`, `#studyarchive`.
- **Steps:** 1. Open each address.
- **Expected result:** The matching add-on popup opens (Work for company); the page does not render.
- **Automation:** Manual.

#### TC-SHL-015 — Top bar date, greeting and clock
- **Requirement:** FR-SHL-017, FR-SHL-033
- **Type / Priority:** Functional · P2
- **Preconditions:** Profile time zone Asia/Tokyo; device zone elsewhere.
- **Test data:** None.
- **Steps:** 1. Read the date and greeting. 2. Watch for a minute. 3. Switch tabs for 2 minutes and return.
- **Expected result:** Date and greeting follow Tokyo time (before 12:00 morning, before 18:00 afternoon, else evening); the time line updates each minute and catches up on return.
- **Automation:** Manual.

#### TC-SHL-016 — Mobile menu drawer
- **Requirement:** FR-SHL-018, NFR-RSP-002
- **Type / Priority:** Responsive · P1
- **Preconditions:** Width 360 px.
- **Test data:** None.
- **Steps:** 1. Tap the hamburger. 2. Tap the dim overlay. 3. Open it, tap "Calendar". 4. Widen the window to 1180 px while it is open.
- **Expected result:** Drawer opens with overlay and page scroll locked; overlay closes it; a menu tap goes to Calendar and closes it; widening resets it with the sidebar always visible.
- **Automation:** `audit` 320 / 360 (overflow only) · interaction Manual.

#### TC-SHL-017 — Global search: open, type, navigate
- **Requirement:** FR-SHL-019, FR-SHL-020, FR-SHL-021
- **Type / Priority:** Functional · P1
- **Preconditions:** Data: task "Pay rent", note "Rent ideas", contact "Rina".
- **Test data:** "rent".
- **Steps:** 1. Press Ctrl / Cmd + K. 2. Type "rent". 3. Arrow Down, Enter. 4. Press Ctrl / Cmd + K twice.
- **Expected result:** Empty box lists pages with "Start typing to search."; results grouped (Tasks, Notes …) with the title that starts with "rent" first and marked text; Enter opens the highlighted hit; the shortcut closes an open search.
- **Automation:** Manual.

#### TC-SHL-018 — Search: empty result and group limit
- **Requirement:** FR-SHL-020
- **Type / Priority:** Boundary · P2
- **Preconditions:** 8 tasks containing "alpha".
- **Test data:** "alpha"; "zzzzqq".
- **Steps:** 1. Search "alpha". 2. Search "zzzzqq".
- **Expected result:** Tasks group shows 5 hits with the count "· 8"; the second shows "Nothing found for "zzzzqq"."
- **Automation:** Manual.

#### TC-SHL-019 — Search respects modes and add-ons
- **Requirement:** FR-SHL-019, FR-SET-013
- **Type / Priority:** Security · P2
- **Preconditions:** B has Study notes; C (no Study) has none.
- **Test data:** A Study task title.
- **Steps:** 1. As B in Personal with "Show Study in Personal" off, search the title. 2. Turn it on and search again. 3. As C search the same word.
- **Expected result:** Study group hits follow the add-on and the mode filter; C never sees B's items.
- **Automation:** Manual.

#### TC-SHL-020 — Undo after delete
- **Requirement:** FR-SHL-023
- **Type / Priority:** Functional · P2
- **Preconditions:** A task exists.
- **Test data:** None.
- **Steps:** 1. Delete the task. 2. Press Undo within 9 s. 3. Delete again and wait 10 s.
- **Expected result:** Bar "<title> deleted · Undo"; Undo restores it and shows "Restored"; the bar disappears after 9 s and the item stays deleted.
- **Automation:** Manual.

#### TC-SHL-021 — Themed dialogs
- **Requirement:** FR-SHL-022
- **Type / Priority:** Functional · P2
- **Preconditions:** Any delete action (confirm) and an action with a text prompt.
- **Test data:** Prompt text "Bills"; numeric prompt "12.3.4,5a".
- **Steps:** 1. Open a confirm; press Esc; open again and click outside; open again and press Enter. 2. Open a prompt; check OK; type text; Enter. 3. Type in the numeric prompt.
- **Expected result:** Esc / outside cancel, Enter accepts; prompt OK disabled while empty; numeric box keeps "12.34,5".
- **Automation:** Manual.

#### TC-SHL-022 — Custom select behaviour
- **Requirement:** FR-SHL-025
- **Type / Priority:** Usability · P3
- **Preconditions:** A page with a themed select (Settings → Edit profile → Country).
- **Test data:** None.
- **Steps:** 1. Open with mouse; pick. 2. Focus, press Arrow Down, Enter. 3. Open near the bottom of the window. 4. Scroll the page while open.
- **Expected result:** The value changes and "change" fires; the menu opens upward when no room below; scroll or resize closes it; Escape closes only the menu.
- **Automation:** Manual.

#### TC-SHL-023 — Date picker: month, year and typed date
- **Requirement:** FR-SHL-026
- **Type / Priority:** Functional · P1
- **Preconditions:** A field using the date picker (Calendar title, Bills, Goal deadline).
- **Test data:** "25/12/2026", "31/02/2026", "2031-03-14", year typed "2031".
- **Steps:** 1. Open the picker; press the month name. 2. Type year 2031, choose March. 3. Pick a day. 4. Reopen; type each typed date and press Go. 5. For a field with a maximum of today, check "Today".
- **Expected result:** Month-and-year view appears with a typed year kept; the chosen date shows in the field; valid typed dates are picked and the popup closes; an impossible date ("31/02/2026") shows an error under the box; beyond max the Today button is disabled.
- **Automation:** `v49_test` (month / year view, typed year, typed date, bad-date message).

#### TC-SHL-024 — Date picker limits
- **Requirement:** FR-SHL-026
- **Type / Priority:** Boundary · P3
- **Preconditions:** Picker with no min / max.
- **Test data:** Years 1899, 1900, 2100, 2101.
- **Steps:** 1. Type each year in the year box.
- **Expected result:** The year is held between 1900 and 2100 (1899 and 2101 are not accepted).
- **Automation:** Manual (TBC exact clamping behaviour).

#### TC-SHL-025 — Time picker
- **Requirement:** FR-SHL-027
- **Type / Priority:** Functional · P3
- **Preconditions:** Event window with a start time.
- **Test data:** 3:45 PM.
- **Steps:** 1. Open the time box. 2. Choose 3, 45 (add via current minute), PM. 3. Press Clear where offered. 4. Use a number box with up / down and hold the button.
- **Expected result:** Stored as 15:45; Clear empties it; number boxes step and repeat respecting min, max and step.
- **Automation:** Manual.

#### TC-SHL-026 — Save disabled until something changes
- **Requirement:** FR-SHL-028
- **Type / Priority:** Usability · P2
- **Preconditions:** An existing task.
- **Test data:** None.
- **Steps:** 1. Open the task. 2. Hover Save. 3. Change the title. 4. Change it back.
- **Expected result:** Save disabled with "Nothing has changed yet"; enabled after a change; disabled again when restored.
- **Automation:** Manual.

#### TC-SHL-027 — Install LUMA (Chrome / Edge, Android)
- **Requirement:** FR-SHL-029, FR-SHL-030
- **Type / Priority:** Functional · P2
- **Preconditions:** HTTPS site, not installed.
- **Test data:** None.
- **Steps:** 1. Settings → Install LUMA → Install. 2. Accept the browser box. 3. Open the installed app; check Settings again.
- **Expected result:** The browser install box shows; installed app opens standalone at `/app/`; the row says "LUMA is installed on this device ✓" and the button is hidden; long-press icon shows Tasks, Calendar, Reminders shortcuts.
- **Automation:** Device only.

#### TC-SHL-028 — Install on iPhone (steps dialog)
- **Requirement:** FR-SHL-030, NFR-BRW-002
- **Type / Priority:** Compatibility · P1
- **Preconditions:** iPhone Safari.
- **Test data:** None.
- **Steps:** 1. Settings → Install → Install. 2. Follow the steps shown. 3. Open from the Home Screen.
- **Expected result:** Dialog "Add LUMA to your home screen" lists Share, Add to Home Screen, Add; the app opens full screen with status-bar style translucent.
- **Automation:** Device only.

#### TC-SHL-029 — Service worker is registered and does not cache
- **Requirement:** FR-SHL-031, FR-SHL-032, NFR-AVL-004
- **Type / Priority:** Functional · P2
- **Preconditions:** Chrome dev tools.
- **Test data:** None.
- **Steps:** 1. Application → Service Workers after sign-in. 2. Check Cache storage. 3. Go offline and reload. 4. Read response headers of `/sw.js` and an `.html` file.
- **Expected result:** `/sw.js` activated, scope `/`; no caches; offline reload fails (no offline mode); headers `Cache-Control: no-cache`.
- **Automation:** Manual.

#### TC-SHL-030 — Time zone drives all dates
- **Requirement:** FR-SHL-033, FR-SET-006
- **Type / Priority:** Integration · P2
- **Preconditions:** Edit profile.
- **Test data:** Change zone from Kuala Lumpur to Los Angeles.
- **Steps:** 1. Save. 2. After reload read the top bar date and an event's "today".
- **Expected result:** "Applying your new time zone…", reload after about 1.2 s; dates use Los Angeles.
- **Automation:** Manual.

#### TC-SHL-031 — Toast lifetime
- **Requirement:** FR-SHL-024
- **Type / Priority:** Functional · P3
- **Preconditions:** Trigger "Reminder saved" in Settings.
- **Test data:** None.
- **Steps:** 1. Watch the toast; 2. press another toast to dismiss.
- **Expected result:** Disappears in 3.5 s or at once when pressed.
- **Automation:** Manual.

#### TC-SHL-032 — Every phone width, every page
- **Requirement:** FR-SHL-018, NFR-RSP-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** `docs/test-automation/rig` running (Chrome).
- **Test data:** Widths 320, 360 (and 390 manual).
- **Steps:** 1. Run `audit.sh 320`, `audit.sh 360` and `audit_modals.sh`.
- **Expected result:** No page scrolls horizontally and no popup box overflows.
- **Automation:** `audit` / `audit_modals` (pages work, company, dashboard, calendar, settings, feedback, adminfeedback, support in Work mode; default list for Personal) · 390 px and 1180 px Manual.

## 3. SET — Settings

#### TC-SET-001 — Settings layout and profile card
- **Requirement:** FR-SET-001, FR-SET-002
- **Type / Priority:** Functional · P2
- **Preconditions:** Account B with Work trial (3 days left).
- **Test data:** None.
- **Steps:** 1. Open Settings.
- **Expected result:** Sections in order Background, Profile, Theme, Preferences, Account and data, Your plan and add-ons, Reminders. Profile shows initial, name, e-mail, "Zenith plan" pill, "Work add-on (trial)" pill with a red outline, Study pill, Edit, Log out. Pressing a pill scrolls to the plan card.
- **Automation:** `v41_test` (Settings renders) · rest Manual.

#### TC-SET-002 — Edit profile: name
- **Requirement:** FR-SET-003, FR-SHL-028
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in.
- **Test data:** First name "Aina Sofea".
- **Steps:** 1. Press Edit; check Save changes. 2. Change the first name; Save.
- **Expected result:** Save disabled until a change; after saving "Saved." shows, the popup closes after about 1.4 s and the name changes in Settings, the greeting and the sidebar.
- **Automation:** Manual.

#### TC-SET-003 — Edit profile: password rules
- **Requirement:** FR-SET-004
- **Type / Priority:** Boundary · P1
- **Preconditions:** Edit popup open.
- **Test data:** "12345" / "12345"; "123456" / "654321"; "123456" / "123456".
- **Steps:** 1. Try each pair and Save.
- **Expected result:** "New password must be at least 6 characters."; "New passwords don't match."; third saves with "Saved — password updated."
- **Automation:** Manual.

#### TC-SET-004 — Edit profile: e-mail change
- **Requirement:** FR-SET-005
- **Type / Priority:** Functional · P2
- **Preconditions:** Secure e-mail change enabled in Supabase (TBC).
- **Test data:** A new address.
- **Steps:** 1. Enter the new e-mail; Save. 2. Confirm from the mailbox.
- **Expected result:** "check your inbox to confirm the new email" (or "email updated" when applied at once); profile e-mail follows after confirmation. Wrong format is blocked by the server with "Couldn't update email: …".
- **Automation:** Device only (real e-mail).

#### TC-SET-005 — Time zone change reloads
- **Requirement:** FR-SET-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Edit popup.
- **Test data:** New zone.
- **Steps:** 1. Change the zone only; Save.
- **Expected result:** "Saved. Applying your new time zone…" then reload; Edit shows the new zone.
- **Automation:** Manual.

#### TC-SET-006 — Profile save failures
- **Requirement:** FR-SET-007
- **Type / Priority:** Negative · P3
- **Preconditions:** Go offline (or block the request) after opening Edit.
- **Test data:** A changed name.
- **Steps:** 1. Save.
- **Expected result:** "Couldn't save name: …" shown; button back to "Save changes"; nothing closes.
- **Automation:** Manual.

#### TC-SET-007 — Wallpapers by plan
- **Requirement:** FR-SET-008, FR-PLN-003
- **Type / Priority:** Boundary · P1
- **Preconditions:** Accounts on Dawn, Glow, Zenith.
- **Test data:** Wallpaper tiles 4, 5, 8, 9, 11.
- **Steps:** 1. As each plan press tile 4, 5, 8, 9, 11.
- **Expected result:** Dawn: tiles 1–4 apply, 5+ locked ("More wallpapers … the Glow and Zenith plans"); Glow: 1–8 apply, 9+ say "the Zenith plan"; Zenith: all 11. The applied wallpaper stays after reload and on another device.
- **Automation:** Manual.

#### TC-SET-008 — Upload own wallpaper
- **Requirement:** FR-SET-009
- **Type / Priority:** Functional · P1
- **Preconditions:** Zenith account; a 6 MB phone photo.
- **Test data:** Photo; a PDF; a 16 MB image.
- **Steps:** 1. "Upload your own" with the photo. 2. Upload a second photo. 3. Try the PDF. 4. Try the 16 MB image.
- **Expected result:** Spinner "Saving…", toast "Wallpaper saved", a new tile that shows the picture; second upload replaces the first and the old file is removed from storage; PDF: "Please choose a picture (JPG, PNG, WebP…)."; 16 MB: "That picture is over 15 MB. Please choose a smaller one."
- **Automation:** Manual.

#### TC-SET-009 — Upload own wallpaper on a lower plan
- **Requirement:** FR-SET-009, FR-PLN-003
- **Type / Priority:** Negative · P1
- **Preconditions:** Glow account.
- **Test data:** None.
- **Steps:** 1. Press "Upload your own".
- **Expected result:** "Uploading your own wallpaper is available on the Zenith plan. Want to see the plans?" with "See plans". (Server does not check this limit — see Findings.)
- **Automation:** Manual.

#### TC-SET-010 — Theme by plan
- **Requirement:** FR-SET-010
- **Type / Priority:** Functional · P2
- **Preconditions:** Dawn and Glow accounts.
- **Test data:** Slate, Midnight Navy, Obsidian.
- **Steps:** 1. As Dawn press each. 2. As Glow press each. 3. Reload.
- **Expected result:** Dawn can use only the first allowed theme (Midnight Navy default) and gets "More themes … Glow and Zenith plans" for the others; Glow can use all 3; the choice persists after reload.
- **Automation:** Manual.

#### TC-SET-011 — Settings follow the account; offline save
- **Requirement:** FR-SET-011, NFR-AVL-002
- **Type / Priority:** Data · P2
- **Preconditions:** Two browsers on the same account.
- **Test data:** Switch Interface sounds on; then go offline and change the theme.
- **Steps:** 1. Change a preference; open the other browser. 2. Offline, change theme; go online; reload.
- **Expected result:** The preference shows on the other browser; offline change shows "Couldn't save that to your account" toast and is saved at the next start.
- **Automation:** Manual.

#### TC-SET-012 — Preference switches and defaults
- **Requirement:** FR-SET-012
- **Type / Priority:** Functional · P1
- **Preconditions:** New account.
- **Test data:** None.
- **Steps:** 1. Read the switches. 2. Toggle each, reload.
- **Expected result:** Defaults: Focus off, Proactive AI on, Weekly review on, Interface sounds off, Busy-day alerts on, Tell me the evening before on; changes persist in the account.
- **Automation:** Manual.

#### TC-SET-013 — Show Work / Study in Personal
- **Requirement:** FR-SET-013
- **Type / Priority:** Functional · P1
- **Preconditions:** Account B with a Work event and a Study reminder.
- **Test data:** None.
- **Steps:** 1. In Personal, check Calendar. 2. Turn on "Show Work in Personal". 3. Turn it off. 4. As A open Preferences.
- **Expected result:** Work items hidden, then visible, then hidden again (nothing deleted); A does not see either switch.
- **Automation:** Manual.

#### TC-SET-014 — Notifications switch (this device)
- **Requirement:** FR-SET-014, FR-NTF-015, FR-NTF-017
- **Type / Priority:** Functional · P1
- **Preconditions:** Chrome over HTTPS.
- **Test data:** None.
- **Steps:** 1. Turn the switch on; allow. 2. Turn it off. 3. Block notifications in the browser and turn on.
- **Expected result:** On: text "On. Reminders and messages reach this device even when LUMA is closed."; off: "Off. Turn on …"; blocked: error "Notifications are blocked. Allow them for LUMA in your browser or device settings, then try again."
- **Automation:** Device only (push).

#### TC-SET-015 — Interface sounds
- **Requirement:** FR-SET-015
- **Type / Priority:** Functional · P3
- **Preconditions:** Sounds off.
- **Test data:** None.
- **Steps:** 1. Tap buttons. 2. Turn the switch on. 3. Tap buttons quickly.
- **Expected result:** No sound off; a preview tone on enabling; soft tones afterwards, not more than one per 60 ms.
- **Automation:** Manual.

#### TC-SET-016 — Busy level hint
- **Requirement:** FR-SET-016, FR-BSY-002
- **Type / Priority:** Functional · P2
- **Preconditions:** Settings.
- **Test data:** Sensitive, Normal, Relaxed.
- **Steps:** 1. Choose each and read the hint; reload.
- **Expected result:** Sensitive "Amber from 4 things, 4 hours booked or 1 clash; red from 6 things, 6 hours or 2 clashes."; Normal 6 / 6 / 1 and 9 / 9 / 3; Relaxed 8 / 8 / 2 and 12 / 12 / 4; the choice persists.
- **Automation:** `v49_test` (busy UI uses preferences) · hint text Manual.

#### TC-SET-017 — Reminder cards by add-on
- **Requirement:** FR-SET-017
- **Type / Priority:** Functional · P2
- **Preconditions:** A (none), then Study only, then Work only.
- **Test data:** None.
- **Steps:** 1. Read the Reminders cards for each account.
- **Expected result:** A: Calendar events, Tasks, Bills, Subscriptions, Goals, Habits, Health, Budget alerts. Study adds Study and Classes; Work adds Work. Habits and Health show links to their pages.
- **Automation:** Manual.

#### TC-SET-018 — Reminder option ranges
- **Requirement:** FR-SET-018, FR-SET-019
- **Type / Priority:** Boundary · P2
- **Preconditions:** Glow account (timing allowed), Study and Work on.
- **Test data:** None.
- **Steps:** 1. Open each select and read its options; read the initial values.
- **Expected result:** Hours 5 AM to 10 PM; event lead 5 / 10 / 15 / 30 / 60 min; days 1, 2, 3, 5, 7; Study time lead 15 min to 4 h; budget 50% to 95%; defaults event 15 min, all-day 8 AM, tasks 9 AM, bills / subscriptions / goals 3 days 9 AM, Study 3 days 9 AM and 1 h, classes 15 min, Work 1 day 9 AM, budget 80%.
- **Automation:** Manual.

#### TC-SET-019 — Reminder times locked on Dawn
- **Requirement:** FR-SET-020, FR-PLN-006
- **Type / Priority:** Negative · P1
- **Preconditions:** Dawn account.
- **Test data:** None.
- **Steps:** 1. Open the Reminders card. 2. Try the selects. 3. Toggle "Tasks" off and on. 4. Call an upsert of `task_hour = 7` through the API (as A).
- **Expected result:** Note "These are the standard times … Choosing your own is available on Glow and Zenith." and the selects are disabled; switches work; the API call fails with "Plan limit: choosing reminder times is available on Glow and Zenith…".
- **Automation:** Manual (trigger in migration 033 only covers the columns it names; Work and Study columns TBC).

#### TC-SET-020 — Reminder save feedback
- **Requirement:** FR-SET-021
- **Type / Priority:** Functional · P2
- **Preconditions:** Glow account.
- **Test data:** Bills days 5.
- **Steps:** 1. Change a select. 2. Toggle a card off. 3. Reload.
- **Expected result:** Toast "Reminder saved"; the off card is dimmed; values persist after reload.
- **Automation:** Manual.

#### TC-SET-021 — Reminder prefs belong to the person
- **Requirement:** FR-SET-021, NFR-SEC-001
- **Type / Priority:** Security · P1
- **Preconditions:** A and C; knowledge of C's id.
- **Test data:** `reminder_prefs` of C.
- **Steps:** 1. As A select all rows of `reminder_prefs`. 2. Try to upsert a row with C's `user_id`.
- **Expected result:** A sees only A's row; the upsert is refused by the policy.
- **Automation:** Manual.

#### TC-SET-022 — Account and data list
- **Requirement:** FR-SET-022
- **Type / Priority:** Functional · P3
- **Preconditions:** Settings.
- **Test data:** None.
- **Steps:** 1. Read the card.
- **Expected result:** Install LUMA, Change password, Export my data, Sign out other devices, Delete my account (red).
- **Automation:** Manual.

#### TC-SET-023 — Settings on phone widths
- **Requirement:** FR-SET-001, NFR-RSP-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** Widths 320, 360, 390, 1180.
- **Test data:** Account B (all cards visible).
- **Steps:** 1. Open Settings and Edit profile at each width.
- **Expected result:** No horizontal scroll; wallpaper grid wraps; reminder cards stack; popup scrolls inside with fixed header and buttons.
- **Automation:** `audit` 320 / 360 and `audit_modals` · 390 / 1180 Manual.

#### TC-SET-024 — Settings across browsers
- **Requirement:** FR-SET-001, NFR-BRW-001
- **Type / Priority:** Compatibility · P2
- **Preconditions:** Chrome, Safari (also iPhone PWA), Firefox, Edge.
- **Test data:** None.
- **Steps:** 1. Open Settings; change theme; upload wallpaper (Zenith); open a themed select and the date picker.
- **Expected result:** Same behaviour in all four; time-zone list shows "GMT+hh:mm" labels in each.
- **Automation:** Device only / Manual.

## 4. PLN — Plans, add-ons, limits, gifts

#### TC-PLN-001 — New accounts start on Dawn
- **Requirement:** FR-PLN-001
- **Type / Priority:** Functional · P1
- **Preconditions:** Fresh registration.
- **Test data:** None.
- **Steps:** 1. Sign in; open Settings.
- **Expected result:** "Dawn plan", "Free forever", no end date.
- **Automation:** `pg_boot` (migrations apply) · Manual.

#### TC-PLN-002 — A person cannot change their own plan
- **Requirement:** FR-PLN-002, NFR-SEC-005
- **Type / Priority:** Security · P1
- **Preconditions:** A signed in; browser console.
- **Test data:** `update luma.profiles set plan='zenith', plan_expires_at=null, disabled_at=null where id=<A>`.
- **Steps:** 1. Run the update through the Supabase client as A. 2. Reload and read the plan.
- **Expected result:** The update returns without error but plan stays Dawn, plan end and `disabled_at` unchanged.
- **Automation:** `pg_admin_test` ("a user cannot reactivate themselves") · plan case Manual.

#### TC-PLN-003 — Plan limit values
- **Requirement:** FR-PLN-003
- **Type / Priority:** Data · P2
- **Preconditions:** Database access.
- **Test data:** None.
- **Steps:** 1. Read `luma.plan_limits`.
- **Expected result:** Values as in FR-PLN-003 (for example storage 50 / 300 / 1000, wallpapers 4 / 8 / 11, chat 50 each); Work rows `work` and `work_pro` exist.
- **Automation:** `pg_boot` applies the migrations · values Manual.

#### TC-PLN-004 — Habit limit on Dawn
- **Requirement:** FR-PLN-004
- **Type / Priority:** Boundary · P1
- **Preconditions:** Dawn account with 4 active habits.
- **Test data:** Habits 5 and 6.
- **Steps:** 1. Add the 5th habit. 2. Add the 6th.
- **Expected result:** 5th succeeds; 6th shows "Plan limit reached — Your Dawn plan includes up to 5 habits. Upgrade to add more." with "See plans" (database message "Plan limit: the Dawn plan allows up to 5 habits. Upgrade your plan in Settings to add more." if the app check is bypassed). An archived habit does not count.
- **Automation:** Manual.

#### TC-PLN-005 — Other count limits
- **Requirement:** FR-PLN-004
- **Type / Priority:** Boundary · P1
- **Preconditions:** Dawn account.
- **Test data:** 3 goals; 5 bills; 5 reminders; 3 contacts.
- **Steps:** 1. Add one more of each beyond the limit. 2. Complete a goal and add another. 3. Send 4 contact requests.
- **Expected result:** Each over-limit add is refused with the plan-limit text; completed goals do not count; pending requests you sent count toward contacts; accepting a request when full is refused.
- **Automation:** Manual.

#### TC-PLN-006 — Unlimited on Zenith
- **Requirement:** FR-PLN-003, FR-PLN-004
- **Type / Priority:** Functional · P2
- **Preconditions:** Zenith account.
- **Test data:** 30 reminders.
- **Steps:** 1. Add 30 custom reminders.
- **Expected result:** All accepted (limit empty = unlimited).
- **Automation:** Manual.

#### TC-PLN-007 — File size and storage limits
- **Requirement:** FR-PLN-005
- **Type / Priority:** Boundary · P1
- **Preconditions:** Dawn account (5 MB per file, 50 MB total).
- **Test data:** 5 MB file, 5.1 MB file, files to reach 50 MB.
- **Steps:** 1. Upload each in Documents.
- **Expected result:** 5 MB accepted (at the limit); 5.1 MB refused "allows files up to 5 MB…"; when the total would pass 50 MB: "… includes 50 MB of file storage and it is full…".
- **Automation:** Manual.

#### TC-PLN-008 — Chat limit
- **Requirement:** FR-PLN-003
- **Type / Priority:** Boundary · P3
- **Preconditions:** Two contacts.
- **Test data:** 51 messages in one day.
- **Steps:** 1. Send 51 messages.
- **Expected result:** The 51st is refused (limit 50 per day, resets at midnight in the sender's zone).
- **Automation:** Manual.

#### TC-PLN-009 — Plan fallback when the answer fails
- **Requirement:** FR-PLN-007, NFR-AVL-001
- **Type / Priority:** Negative · P1
- **Preconditions:** Zenith account; block the `my_limits` call.
- **Test data:** None.
- **Steps:** 1. Clear the browser's `luma_plan_cache`. 2. Reload with the call blocked. 3. Unblock and reload.
- **Expected result:** After 3 tries the app runs with Dawn limits (never larger), then returns to Zenith. With the cache present the last known plan is used meanwhile.
- **Automation:** Manual.

#### TC-PLN-010 — Plans popup content
- **Requirement:** FR-PLN-009, FR-PLN-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Glow account ending in 5 days.
- **Test data:** None.
- **Steps:** 1. Settings → plan pill / "See plans". 2. Read the cards.
- **Expected result:** Three cards; Glow has "Your plan" and a red line "Until <date> · 5 days left" and "Renew Glow"; Zenith "Upgrade to Zenith"; Dawn "Included"; Add-ons section lists Work and Study (and the bundle only if none is on).
- **Automation:** `v49_test` (Glow with 5 days left, popup opened) · Manual.

#### TC-PLN-011 — Welcome plan popup shows once
- **Requirement:** FR-PLN-010
- **Type / Priority:** Functional · P2
- **Preconditions:** New Dawn account.
- **Test data:** None.
- **Steps:** 1. Sign in. 2. "Stay on Dawn". 3. Sign out and in.
- **Expected result:** First time: title "Welcome to LUMA! Pick your plan", no add-on section; second sign-in: no popup. Closing with the cross also marks it as shown.
- **Automation:** Manual.

#### TC-PLN-012 — Upgrade WhatsApp message
- **Requirement:** FR-PLN-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Dawn account "Aina Rahman".
- **Test data:** Press "Upgrade to Glow".
- **Steps:** 1. Press the button; read the opened link.
- **Expected result:** `https://wa.me/60122108459?text=` with "Hi LUMA! I'd like to upgrade my plan." Name, Email, Current plan: Dawn, Upgrade to: Glow, Price: RM9 / month; popup closes. With the number blank an alert says to e-mail aeinscape@gmail.com.
- **Automation:** `v49_test` (opens and captures the link for renewals) · Manual.

#### TC-PLN-013 — Add-on popup for Work
- **Requirement:** FR-PLN-014, FR-PLN-016
- **Type / Priority:** Functional · P1
- **Preconditions:** Account A.
- **Test data:** None.
- **Steps:** 1. Press the Work lock.
- **Expected result:** "Work mode"; price RM15 / month; perks; two size boxes (Work up to 5 companies, 20 projects, 8 people on a project, 600 tasks in a project and 5 teams; Work Pro 20, 60, 15, 1500, 20) and the note that the size comes from the add-on; buttons "Start 7-day free trial", "Get Work · RM15 / month", "Get Work Pro · RM25 / month", "Get both: Work + Study · RM19 / month · Save RM3 a month".
- **Automation:** Manual.

#### TC-PLN-014 — Work free trial
- **Requirement:** FR-PLN-017
- **Type / Priority:** Functional · P1
- **Preconditions:** Account A, trial unused.
- **Test data:** None.
- **Steps:** 1. Press "Start 7-day free trial". 2. Look at Settings. 3. After expiry (set `expires_at` in the past) press Work again.
- **Expected result:** Work mode opens, toast "Work trial started — Free for 7 days", Settings shows "free trial" and "Last day …"; after expiry the trial button is gone (only "Get …") and a direct call returns "The free trial was already used".
- **Automation:** `pg_admin_test` (second trial refused; reset allows again) · UI Manual.

#### TC-PLN-015 — Trial when add-on already on
- **Requirement:** FR-PLN-017
- **Type / Priority:** Negative · P2
- **Preconditions:** Account B (Study on).
- **Test data:** `start_addon_trial('study')`.
- **Steps:** 1. Call it via the API.
- **Expected result:** Error "You already have this add-on".
- **Automation:** `pg_admin_test` (cannot start a trial on top of an active add-on, admin version) · Manual.

#### TC-PLN-016 — Study trial offered only on staging
- **Requirement:** FR-PLN-018
- **Type / Priority:** Functional · P3
- **Preconditions:** Staging and production hosts.
- **Test data:** None.
- **Steps:** 1. Open the Study popup on both.
- **Expected result:** Staging shows the trial button; production does not (only Get Study · RM7 / month). The database would still accept the trial call (Findings).
- **Automation:** Manual.

#### TC-PLN-017 — Add-on request and bundle messages
- **Requirement:** FR-PLN-019
- **Type / Priority:** Functional · P1
- **Preconditions:** Account A and account with Work standard.
- **Test data:** Get Study; Get both; Get Work Pro; Upgrade to Work Pro.
- **Steps:** 1. Press each and read the link text.
- **Expected result:** "Hi LUMA! I'd like to add an add-on." with Name, Email, Current plan, Add-on (Study / "Work + Study (bundle: Work and Study together)" / "Work Pro") and Price (RM7, RM19, RM25 / month); for the Work holder an extra "Note: I have Work now and would like to upgrade to Work Pro."
- **Automation:** Manual.

#### TC-PLN-018 — Renewal message
- **Requirement:** FR-PLN-020
- **Type / Priority:** Functional · P1
- **Preconditions:** Glow plan ending soon; Work Pro with end date.
- **Test data:** Renew Glow; Renew Work Pro; Renew as Work instead.
- **Steps:** 1. Press each Renew in Settings and the plans popup.
- **Expected result:** "Hi LUMA! I'd like to renew." with Name, Email, Current plan, "Renew: Glow plan" / "Work Pro add-on", "Ends: <d Mon yyyy>" (or "no end date"), Price; renewing as Work adds the note about renewing "as Work instead"; a text under the button says going back deletes nothing.
- **Automation:** `v49_test` (renew buttons for plan and add-ons, window.open captured) · Manual.

#### TC-PLN-019 — Settings plan card
- **Requirement:** FR-PLN-012, FR-PLN-021
- **Type / Priority:** Functional · P2
- **Preconditions:** A (Dawn); B (Zenith, Work trial, Study with end date).
- **Test data:** None.
- **Steps:** 1. Read the plan card for each.
- **Expected result:** A: "Dawn plan · Free forever" with "See plans"; Work and Study "Not switched on" with the Get buttons (Work shows both sizes). B: "Last day: <date> · <n> days left" (red ≤ 7), "free trial" tag, Renew buttons; the paragraph about returning to Dawn and the 7 and 1 day reminders.
- **Automation:** `v49_test` (renders the card) · Manual.

#### TC-PLN-020 — Plan expiry job
- **Requirement:** FR-PLN-022, FR-PLN-029
- **Type / Priority:** Functional · P1
- **Preconditions:** Test database; a Glow person with `plan_expires_at` in the past.
- **Test data:** `select luma.run_plan_expiry()`.
- **Steps:** 1. Run the function as the owner. 2. Read the profile, notifications and purchase history.
- **Expected result:** Plan is Dawn, end empty, notification "Your Glow plan has ended" with link settings, history row "ended". Re-running does not repeat.
- **Automation:** Manual (no automated test exercises `run_plan_expiry`; `pg_boot` only applies it).

#### TC-PLN-021 — Expiry warnings 7 and 1 day
- **Requirement:** FR-PLN-023
- **Type / Priority:** Boundary · P1
- **Preconditions:** Plan ending in 6.5 days; add-on ending in 20 hours; another in 3 days.
- **Test data:** `run_plan_expiry()` twice.
- **Steps:** 1. Run. 2. Run again immediately.
- **Expected result:** "Your Glow plan ends in 7 days" and "Your Study add-on ends tomorrow" are created; the 3-day one is not; the second run adds nothing (20 h dedupe). After an add-on ends, one "Your Study add-on has ended" notice within 3 days.
- **Automation:** Manual.

#### TC-PLN-022 — After an add-on ends
- **Requirement:** FR-PLN-024, FR-SHL-014
- **Type / Priority:** Security · P1
- **Preconditions:** B with Study; set Study to ended.
- **Test data:** Existing Study subject and note.
- **Steps:** 1. Open Study (popup). 2. Export data. 3. Try inserting a study course through the API.
- **Expected result:** Study locked; existing data kept; the insert is refused by the row policy (`has_my_addon`); Study reminders stop.
- **Automation:** Manual.

#### TC-PLN-023 — Work limits come from the add-on
- **Requirement:** FR-PLN-015
- **Type / Priority:** Boundary · P1
- **Preconditions:** A Dawn person with Work (standard); a Zenith person with Work Pro.
- **Test data:** 6th company; 21st project.
- **Steps:** 1. As the Dawn Work person add a 6th company. 2. Add a 21st project. 3. Repeat as Work Pro.
- **Expected result:** Standard stops at 5 companies / 20 projects whatever the plan; Work Pro allows up to 20 / 60. Without the add-on the Work size applies. Going from Pro to standard deletes nothing but blocks adding.
- **Automation:** `pg_busy_test` (Work sizes via admin_set_addon, size shown in the list) · limit enforcement itself is in the Work suites (not reviewed here, TBC).

#### TC-PLN-024 — Gift: send, see, use
- **Requirement:** FR-PLN-025, FR-PLN-026, FR-PLN-027, FR-PLN-028
- **Type / Priority:** Functional · P1
- **Preconditions:** ADMIN, A.
- **Test data:** Gift "Study", 14 days, use within 60 days, note "Thanks for testing".
- **Steps:** 1. ADMIN sends the gift to A. 2. As A open the bell and Settings. 3. Press "Use now" and confirm. 4. Try to use it again.
- **Expected result:** A gets "A free Study gift is waiting" (opens Settings on the gift); Settings menu has a dot; the card says "A free gift is waiting for you", "Use by <date> · 60 days left"; add-on does not start before pressing; confirming states the new last day; Study starts for 14 days, trial stays unused; the gift shows "Used on …" and cannot be used twice.
- **Automation:** `pg_gift_test` (gift sent, not active, seen, notification link, claim, once only, trial not used) · UI Manual.

#### TC-PLN-025 — Gift rules: other people, expiry, limit of 3, extension
- **Requirement:** FR-PLN-025, FR-PLN-027
- **Type / Priority:** Security · P1
- **Preconditions:** ADMIN, A, C.
- **Test data:** Gift id of A used by C; expired gift; 4 gifts.
- **Steps:** 1. C calls `claim_gift` with A's gift id. 2. Use an expired gift. 3. Send 4 gifts to A. 4. Send a 7-day gift to someone with Study already running; claim it. 5. Claim a gift for an add-on that has no end date.
- **Expected result:** "That gift was not found"; "This gift has expired"; the 4th is skipped; the second gift adds 7 days after the first end; no-end-date: "You already have Study with no end date, so there is nothing to add".
- **Automation:** `pg_gift_test` (not others', expired, max 3, adds on top) · no-end-date case Manual.

#### TC-PLN-026 — Gift reminders and removal
- **Requirement:** FR-PLN-028
- **Type / Priority:** Functional · P2
- **Preconditions:** Unused gift with 6.5 days left.
- **Test data:** `run_gift_reminders()` twice.
- **Steps:** 1. Run twice. 2. Delete the account of the receiver.
- **Expected result:** One "Your free Work gift ends in 7 days" notice, not repeated; deleting the account removes its gifts.
- **Automation:** `pg_gift_test`.

#### TC-PLN-027 — Gift month length preview
- **Requirement:** FR-PLN-027
- **Type / Priority:** Boundary · P3
- **Preconditions:** Gift of 1 month; current add-on ends on 31 January.
- **Test data:** None.
- **Steps:** 1. Press "Use now" and read the last day in the confirmation. 2. Compare with Settings after confirming.
- **Expected result:** Both show the same date (the browser preview adds a calendar month, the database adds an interval; they may differ for end-of-month dates — see Findings).
- **Automation:** Manual.

#### TC-PLN-028 — Purchase history
- **Requirement:** FR-PLN-029, FR-PLN-030
- **Type / Priority:** Functional · P2
- **Preconditions:** B with several changes; C with none.
- **Test data:** 45 rows for one person.
- **Steps:** 1. Open Settings → Purchase history. 2. Use filters. 3. "Show older". 4. As C read B's rows through the API.
- **Expected result:** Newest first with Free trial started / Switched on / Time added / Switched off / Ended, date, time and "until <last day>"; 40 rows then "Show older"; filters work; empty state "Nothing yet. Trials, plans and add-ons will be listed here."; C sees none of B's rows.
- **Automation:** `v41_test` (page renders, jsdom) · rest Manual.

#### TC-PLN-029 — Admin change notifies the person
- **Requirement:** FR-PLN-031
- **Type / Priority:** Integration · P2
- **Preconditions:** ADMIN, A.
- **Test data:** Set A to Glow for 1 month.
- **Steps:** 1. ADMIN applies. 2. As A open the bell.
- **Expected result:** "Your plan is now Glow — Thank you! Your new limits are active until <date>…" opening Settings and highlighting the plan row; history shows "Switched on".
- **Automation:** Manual.

#### TC-PLN-030 — Plan perks text versus limits
- **Requirement:** FR-PLN-013, FR-PLN-003
- **Type / Priority:** Data · P3
- **Preconditions:** ADMIN changes Dawn "habits" to 8 in the editor.
- **Test data:** None.
- **Steps:** 1. Read the Dawn card and FAQ. 2. Add a 6th habit as Dawn.
- **Expected result:** Cards and FAQ still say 5 habits (static text) while the app lets the 6th habit in — documents the mismatch (Findings).
- **Automation:** Manual.

#### TC-PLN-031 — Plan popup on phones
- **Requirement:** FR-PLN-009, NFR-RSP-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Widths 320, 360, 390.
- **Test data:** B with Work Pro.
- **Steps:** 1. Open the plans popup and the add-on popup.
- **Expected result:** Cards stack in one column, no clipped buttons, content scrolls inside the popup.
- **Automation:** `audit_modals` · Manual for content.

#### TC-PLN-032 — Limit dialogs
- **Requirement:** FR-PLN-008
- **Type / Priority:** Usability · P2
- **Preconditions:** Dawn account at its bill limit.
- **Test data:** Add a 6th bill; press the locked Payroll feature or a locked theme.
- **Steps:** 1. Try each; press "See plans" and Cancel.
- **Expected result:** "Plan limit reached — Your Dawn plan includes up to 5 bills and subscriptions…" and "Not in your plan — <feature> is available on <plan>. Want to see the plans?"; "See plans" opens the plans popup; Cancel closes.
- **Automation:** Manual.

## 5. NTF — Notifications, push and reminder engines

#### TC-NTF-001 — Notifications cannot be forged or read by others
- **Requirement:** FR-NTF-001, NFR-SEC-001
- **Type / Priority:** Security · P1
- **Preconditions:** A and C signed in (API console).
- **Test data:** `insert into notifications (user_id,title) values (<A>,'fake')`.
- **Steps:** 1. As C try the insert. 2. As C select all notifications. 3. As C update and delete one of A's ids.
- **Expected result:** Insert refused (no insert policy / privilege); C sees only own rows; update and delete affect 0 rows.
- **Automation:** `pg_feedback_test` and `pg_gift_test` read notifications through service role only · Manual for RLS.

#### TC-NTF-002 — Bell badge
- **Requirement:** FR-NTF-003
- **Type / Priority:** Boundary · P1
- **Preconditions:** 0, 3, 9, 10 unread notifications.
- **Test data:** None.
- **Steps:** 1. Read the badge at each count.
- **Expected result:** Hidden at 0; "3"; "9"; "9+" at 10 or more.
- **Automation:** Manual.

#### TC-NTF-003 — Bell panel
- **Requirement:** FR-NTF-004
- **Type / Priority:** Functional · P1
- **Preconditions:** 2 notifications today, 1 unread from last week.
- **Test data:** None.
- **Steps:** 1. Open the panel. 2. Press an item. 3. "Mark all as read". 4. Press Escape / click outside. 5. "See all".
- **Expected result:** Shows today's two, "<n> unread", "1 earlier unread"; item opens its target and becomes read; after mark all "You're all caught up" and the button disables; empty day shows "No notifications today"; See all opens the page.
- **Automation:** `v41_test` (page with one notification renders) · Manual.

#### TC-NTF-004 — Notifications page
- **Requirement:** FR-NTF-005, FR-NTF-011
- **Type / Priority:** Functional · P1
- **Preconditions:** Notifications from today, yesterday and last month.
- **Test data:** None.
- **Steps:** 1. Open the page. 2. Filter Unread. 3. Delete one with the cross. 4. "Mark all as read". 5. Empty the list.
- **Expected result:** Groups "Today", "Yesterday", "<d Month yyyy>"; subtitle "<n> notifications · <n> unread"; the deleted row disappears; the empty texts "No unread notifications." / "No notifications yet.".
- **Automation:** Manual.

#### TC-NTF-005 — Load limit of 200
- **Requirement:** FR-NTF-006, NFR-PRF-004
- **Type / Priority:** Boundary · P3
- **Preconditions:** 250 notifications, 230 unread.
- **Test data:** None.
- **Steps:** 1. Open the app; read the page count and badge.
- **Expected result:** Only the 200 newest are listed and counted (badge may show fewer unread than exist — Findings).
- **Automation:** Manual.

#### TC-NTF-006 — Live arrival and toast
- **Requirement:** FR-NTF-007, FR-NTF-008
- **Type / Priority:** Integration · P1
- **Preconditions:** A open in the app; ADMIN sends A a gift.
- **Test data:** None.
- **Steps:** 1. Without refreshing watch. 2. Press the toast.
- **Expected result:** Badge goes up and a toast slides in for about 6 s; pressing it opens Settings at the gift; with the tab hidden and permission granted a browser notification shows as well.
- **Automation:** Manual.

#### TC-NTF-007 — Realtime resync
- **Requirement:** FR-NTF-007, NFR-AVL-003
- **Type / Priority:** Data · P2
- **Preconditions:** Tab asleep for 10 minutes while 3 notifications arrive.
- **Test data:** None.
- **Steps:** 1. Return to the tab.
- **Expected result:** List reloaded; all 3 present, badge correct.
- **Automation:** Manual.

#### TC-NTF-008 — Chat message notifications replace each other
- **Requirement:** FR-NTF-009
- **Type / Priority:** Functional · P2
- **Preconditions:** A and C are contacts.
- **Test data:** Three messages from C.
- **Steps:** 1. C sends 3 messages while A is on another page. 2. A opens that chat while C sends a 4th.
- **Expected result:** One unread message notification for that chat (replaced); with the chat open no toast shows and the notification is marked read.
- **Automation:** Manual.

#### TC-NTF-009 — Focus mode
- **Requirement:** FR-NTF-010, FR-SET-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Focus mode on; push on for a phone.
- **Test data:** A contact nudge; a task reminder; a gift.
- **Steps:** 1. Receive each.
- **Expected result:** Only the reminder pops up (toast, and push on the phone); the nudge and the gift are in the bell but without toast or push. There is no quiet-hours setting anywhere (Findings).
- **Automation:** Device only (push) · toast Manual.

#### TC-NTF-010 — Click through to the item and highlight
- **Requirement:** FR-NTF-011, FR-NTF-012
- **Type / Priority:** Functional · P1
- **Preconditions:** Reminders for an event, a bill, a shared note and a contact request.
- **Test data:** None.
- **Steps:** 1. Open each from the bell.
- **Expected result:** The right page opens, scrolls its list to the item and flashes it for about 5 s; the contact request highlights its row; a message opens the chat.
- **Automation:** Manual.

#### TC-NTF-011 — Click-through switches mode
- **Requirement:** FR-NTF-013, FR-SHL-012
- **Type / Priority:** Integration · P1
- **Preconditions:** B in Personal with "Show Work in Personal" off; a Work event reminder.
- **Test data:** None.
- **Steps:** 1. Open the reminder.
- **Expected result:** The app switches to Work, opens Calendar, highlights the event (today's occurrence if it repeats).
- **Automation:** Manual.

#### TC-NTF-012 — Study reminder opens the right tab
- **Requirement:** FR-NTF-014
- **Type / Priority:** Functional · P2
- **Preconditions:** A Study assignment reminder and a class reminder.
- **Test data:** None.
- **Steps:** 1. Open each.
- **Expected result:** Study opens on Assignments and Timetable respectively.
- **Automation:** Manual.

#### TC-NTF-013 — Mark-all failure
- **Requirement:** FR-NTF-011
- **Type / Priority:** Negative · P3
- **Preconditions:** Block the update request.
- **Test data:** None.
- **Steps:** 1. Press "Mark all as read".
- **Expected result:** Alert "Could not mark as read: …" and the list reloads with items unread again.
- **Automation:** Manual.

#### TC-NTF-014 — Enable push and subscription row
- **Requirement:** FR-NTF-015, FR-NTF-024
- **Type / Priority:** Functional · P1
- **Preconditions:** Chrome HTTPS, notifications default.
- **Test data:** None.
- **Steps:** 1. Settings → Notifications on. 2. Check the `push_subscriptions` table. 3. Turn off. 4. Turn on again.
- **Expected result:** One row with endpoint, p256dh, auth, user agent (≤ 200 chars); off deletes it and sets "never ask again"; on again recreates exactly one row for the device.
- **Automation:** Device only.

#### TC-NTF-015 — Push on iPhone PWA
- **Requirement:** FR-NTF-015, FR-NTF-019, NFR-BRW-002
- **Type / Priority:** Compatibility · P1
- **Preconditions:** iPhone, LUMA added to Home Screen, signed in.
- **Test data:** A custom reminder due in 2 minutes.
- **Steps:** 1. Allow notifications. 2. Close LUMA. 3. Wait for the reminder. 4. Tap the notification. 5. Open LUMA, receive another with the app visible.
- **Expected result:** Device notification arrives while closed; tapping opens LUMA on the reminder's page; with the app visible a toast shows and the system notification is silent and removed in under a second. In Safari (not installed) the Settings text says to add LUMA to the Home Screen first.
- **Automation:** Device only.

#### TC-NTF-016 — Push after sign-in prompt
- **Requirement:** FR-NTF-016
- **Type / Priority:** Functional · P2
- **Preconditions:** Device not subscribed, permission not denied.
- **Test data:** None.
- **Steps:** 1. Sign in; press "No thanks". 2. Sign in again. 3. Clear site data; sign in; press "Enable" with permission denied in the browser.
- **Expected result:** The popup appears once; after "No thanks" it does not return on this device; denied permission shows no popup; "Enable" failure shows the error in red.
- **Automation:** Device only.

#### TC-NTF-017 — Push state texts
- **Requirement:** FR-NTF-017
- **Type / Priority:** Usability · P3
- **Preconditions:** Browsers: Chrome, iPhone Safari (not installed), http (no TLS), permission blocked.
- **Test data:** None.
- **Steps:** 1. Open Settings → Preferences in each state.
- **Expected result:** Texts: "Not supported by this browser. On iPhone, add LUMA to your Home Screen first.", "Blocked. Allow notifications …", "On. …", "Off. …", "On while LUMA is open in a browser tab.".
- **Automation:** Manual.

#### TC-NTF-018 — send-push security and burst rule
- **Requirement:** FR-NTF-018, NFR-SEC-008
- **Type / Priority:** Security · P1
- **Preconditions:** Deployed function URL.
- **Test data:** POST with no secret; wrong secret; correct secret with a `message` record twice within a minute from one sender.
- **Steps:** 1. Call without the header. 2. Call with a wrong value. 3. Send valid payloads.
- **Expected result:** 403 "forbidden" for the first two; for valid calls "sent"; the second message of a burst returns "skipped: message burst"; a Focus-mode user's non-reminder returns "skipped: focus mode"; a dead endpoint (404 / 410) is deleted.
- **Automation:** Manual (no automated test for `send-push`).

#### TC-NTF-019 — Service worker notification click
- **Requirement:** FR-NTF-019, FR-SHL-031
- **Type / Priority:** Functional · P1
- **Preconditions:** Desktop Chrome, push on.
- **Test data:** A push for the Bills page.
- **Steps:** 1. With LUMA open in a tab but not focused, receive it and click. 2. Close all LUMA tabs, receive another and click.
- **Expected result:** First: the tab is focused and goes to Bills with the item highlighted; second: a new window opens `/app/?from=push…#bills` and goes to the item.
- **Automation:** Device only.

#### TC-NTF-020 — Reminder engines in time zones
- **Requirement:** FR-NTF-020, FR-SET-006
- **Type / Priority:** Integration · P1
- **Preconditions:** Two accounts: zone Asia/Kuala_Lumpur and America/Los_Angeles; both with a task due today and "Tasks" reminder at 9 AM.
- **Test data:** None.
- **Steps:** 1. Observe when each receives "tasks due today". 2. Check `cron.job` for the list of jobs.
- **Expected result:** Each gets it at 9 AM in their own zone; the job names include luma-health-reminders, habit, event, custom, class (every minute), morning, subscription, study, group-task, work (hourly), budget (:30), weekly-review, plan-expiry, busy-alerts (:05), gift-reminders (:10).
- **Automation:** `pg_boot` (migrations apply; pg_cron may be unavailable in PGlite, TBC) · Manual.

#### TC-NTF-021 — Muted reminders and duplicates
- **Requirement:** FR-NTF-021, FR-SET-021
- **Type / Priority:** Functional · P2
- **Preconditions:** Habits and Health switches off in Settings → Reminders.
- **Test data:** A habit with a reminder time; water reminder.
- **Steps:** 1. Wait for the times. 2. Turn them on; wait for a water slot twice within 10 minutes.
- **Expected result:** Off: nothing in the bell or push. On: one water reminder per slot, none duplicated within 10 minutes.
- **Automation:** Manual.

#### TC-NTF-022 — Weekly review
- **Requirement:** FR-NTF-022, FR-SET-012
- **Type / Priority:** Functional · P2
- **Preconditions:** Weekly review on; Sunday 18:xx local (or set the clock in the test database).
- **Test data:** 3 tasks done, 1 overdue, RM50 spent.
- **Steps:** 1. Run `run_weekly_review()` at that time. 2. Run again. 3. Switch the preference off and run on the next Sunday.
- **Expected result:** One "weekly_review" notification with the counts; none on the second run (5-day rule); none when off.
- **Automation:** Manual.

#### TC-NTF-023 — Welcome notification
- **Requirement:** FR-NTF-023
- **Type / Priority:** Functional · P3
- **Preconditions:** New account.
- **Test data:** None.
- **Steps:** 1. Open the bell after the first sign-in.
- **Expected result:** "Welcome to LUMA 🎉 — Your account has been successfully registered…" opening the dashboard.
- **Automation:** `pg_boot` (trigger applies) · Manual.

#### TC-NTF-024 — Push subscriptions are private
- **Requirement:** FR-NTF-024, NFR-SEC-001
- **Type / Priority:** Security · P1
- **Preconditions:** A subscribed; C signed in.
- **Test data:** A's endpoint.
- **Steps:** 1. As C select and delete A's subscription rows.
- **Expected result:** C sees none and deletes none.
- **Automation:** Manual.

#### TC-NTF-025 — Notification text is escaped
- **Requirement:** NFR-SEC-009
- **Type / Priority:** Security · P1
- **Preconditions:** A contact sends a message or an item with title `<img src=x onerror=alert(1)>`.
- **Test data:** That title.
- **Steps:** 1. Let a notification, the search box and the admin feedback list show it.
- **Expected result:** The text is shown literally; no script runs.
- **Automation:** Manual.

#### TC-NTF-026 — Panel and toast on phones
- **Requirement:** FR-NTF-004, FR-NTF-008, NFR-RSP-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Widths 320, 360, 390, 1180.
- **Test data:** Long titles.
- **Steps:** 1. Open the bell panel and the page; trigger a toast.
- **Expected result:** Panel stays inside the screen (left edge ≥ 12 px); no horizontal scroll; toast readable and tappable.
- **Automation:** `audit` (notifications page in default list) · Manual for panel and toast.

#### TC-NTF-027 — Notification icons for every type
- **Requirement:** FR-NTF-002
- **Type / Priority:** Data · P3
- **Preconditions:** One notification of each type (insert through the service role in a test database).
- **Test data:** Types listed in FR-NTF-002 plus an unknown type "xyz".
- **Steps:** 1. Open the Notifications page.
- **Expected result:** Each known type has its own icon and colour; "xyz" falls back to the grey bell (system).
- **Automation:** Manual.

## 6. BSY — Busy-day alerts

#### TC-BSY-001 — Load counting rules
- **Requirement:** FR-BSY-001
- **Type / Priority:** Boundary · P1
- **Preconditions:** Personal mode, tomorrow empty.
- **Test data:** 5 all-day events + 1 task due = 6 things; 9:00–11:00 and 10:00–12:00 events; an event with start only; a done task.
- **Steps:** 1. Add the items one group at a time and read tomorrow's tint and notice reason.
- **Expected result:** Done tasks do not count; reason text "<n> things · <h> h booked · <n> clash(es)" (hours shown from 3 h); a timed item with no end counts 60 minutes (at least 15); overlapping items give 1 clash; Calendar category filters do not hide a busy day.
- **Automation:** `pg_busy_test` (server counts: events, tasks, hours 4, clash 1, repeat) · `v49_test` (client load of 7 timed events) · Manual.

#### TC-BSY-002 — Thresholds per level
- **Requirement:** FR-BSY-002
- **Type / Priority:** Boundary · P1
- **Preconditions:** A day with exactly 3, 4, 5, 6, 8, 9, 12 things (separate days).
- **Test data:** Levels Sensitive, Normal, Relaxed.
- **Steps:** 1. For each level read each day's colour.
- **Expected result:** Sensitive: amber at 4, red at 6; Normal: amber at 6, red at 9; Relaxed: amber at 8, red at 12; below the first number no tint. Same pattern for hours (4 / 6, 6 / 9, 8 / 12) and clashes (1 / 2, 1 / 3, 2 / 4).
- **Automation:** `pg_busy_test` (relaxed: 11 things amber; sensitive: packed) · exact edges Manual.

#### TC-BSY-003 — Classes count as half
- **Requirement:** FR-BSY-001, FR-BSY-008
- **Type / Priority:** Data · P2
- **Preconditions:** Study on; two classes on a weekday.
- **Test data:** 2 classes + 5 events.
- **Steps:** 1. Read the day's count in Study mode.
- **Expected result:** Counts 6 (2 classes = 1 thing).
- **Automation:** `pg_busy_test` ("two classes count as one thing").

#### TC-BSY-004 — Switch the alerts off
- **Requirement:** FR-BSY-003
- **Type / Priority:** Functional · P1
- **Preconditions:** A busy tomorrow; alerts on.
- **Test data:** None.
- **Steps:** 1. Turn "Busy-day alerts" off in Settings. 2. Look at Calendar, Dashboard, Work, Study. 3. Run the evening job.
- **Expected result:** No tint, notice or strip anywhere; no evening notification. Turning on restores them.
- **Automation:** `v49_test` (notice hidden when off) · `pg_busy_test` (busy alerts off gives nothing).

#### TC-BSY-005 — Calendar tint and inline notice
- **Requirement:** FR-BSY-004
- **Type / Priority:** Functional · P1
- **Preconditions:** Tomorrow packed.
- **Test data:** None.
- **Steps:** 1. Open Calendar in month, week and day views.
- **Expected result:** Tomorrow's cell and week header are red-tinted (amber when busy); the day view shows the inline notice with the reason; the date number stays centred inside the "today" circle.
- **Automation:** `v49_test` (month cell class, day view notice) · week view Manual.

#### TC-BSY-006 — Notice bar and "Hide for today"
- **Requirement:** FR-BSY-005
- **Type / Priority:** Functional · P1
- **Preconditions:** Today normal; tomorrow packed; day after busy.
- **Test data:** None.
- **Steps:** 1. Open the Dashboard. 2. Press the cross. 3. Open Work and Study overview. 4. Next day reload.
- **Expected result:** "Tomorrow is packed — <reason>. Think about moving something." with "Open <day>" and "Also:" days (up to 4); cross hides it on all pages for the rest of the day; it returns the next day.
- **Automation:** `v49_test` (dashboard notice, Work and Study overview boxes) · hide Manual.

#### TC-BSY-007 — Seven-day strip
- **Requirement:** FR-BSY-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Dashboard.
- **Test data:** None.
- **Steps:** 1. Count the squares; read the key; press the packed day.
- **Expected result:** 7 squares coloured Light / Busy / Packed with the key and "Tap a day to open it"; pressing opens Calendar in day view on that date.
- **Automation:** `v49_test` (7 squares, tap opens calendar day view).

#### TC-BSY-008 — Evening push at 6 pm local
- **Requirement:** FR-BSY-007, FR-BSY-009
- **Type / Priority:** Functional · P1
- **Preconditions:** Person whose local time is 18:xx; tomorrow packed.
- **Test data:** `run_busy_alerts()`.
- **Steps:** 1. Run twice. 2. Delete the notification and switch "Tell me the evening before" off; run. 3. Change the zone so the hour is not 18; run.
- **Expected result:** One notification "Tomorrow is packed" with body "11 things · … Think about moving something." and link calendar; second run adds none; switch off gives none; other hours give none.
- **Automation:** `pg_busy_test` (one packed notice, not twice, switches, only at 6 pm local).

#### TC-BSY-009 — Server counting rules (Work, Study, repeats)
- **Requirement:** FR-BSY-008
- **Type / Priority:** Data · P2
- **Preconditions:** Person with Work and Study.
- **Test data:** Weekly event started last week; Work task spanning tomorrow; someone without add-ons.
- **Steps:** 1. Call `busy_day_stats` for tomorrow.
- **Expected result:** Weekly repeat counted; the spanning Work task counted; person without add-ons gets only personal items; another person's data not mixed in.
- **Automation:** `pg_busy_test`.

#### TC-BSY-010 — Client and server agree
- **Requirement:** FR-BSY-001, FR-BSY-008
- **Type / Priority:** Integration · P2
- **Preconditions:** Person with Work add-on; 4 Work events (space work) and 3 personal events tomorrow; Personal mode, "Show Work in Personal" off.
- **Test data:** Normal level.
- **Steps:** 1. Read the Personal calendar tint for tomorrow. 2. Run the evening job.
- **Expected result:** Calendar counts 3 (no tint); the server counts all events regardless of mode (7, amber) — document the difference (Findings).
- **Automation:** Manual.

#### TC-BSY-011 — Evening notification click
- **Requirement:** FR-BSY-007
- **Type / Priority:** Functional · P3
- **Preconditions:** A busy_day notification.
- **Test data:** None.
- **Steps:** 1. Press it in the bell and from a push.
- **Expected result:** Calendar opens.
- **Automation:** Manual.

## 7. FBK — Feedback

#### TC-FBK-001 — Menu item and defaults
- **Requirement:** FR-FBK-001, FR-FBK-002, FR-FBK-003
- **Type / Priority:** Functional · P1
- **Preconditions:** A in Personal, Work and Study modes; opened from Bills.
- **Test data:** None.
- **Steps:** 1. Look for "Feedback" in each mode. 2. Open it from Bills. 3. Read the module and kinds.
- **Expected result:** Item present in all modes; module starts as "Bills"; kinds Bug, Idea (selected), Question, Praise; parts box hidden for modules without parts, shown for Calendar etc. "Admin (administrators)" absent for A, present for ADMIN.
- **Automation:** `v49_test` (menu item in every mode, starts on module, parts, 4 kinds).

#### TC-FBK-002 — Send feedback with a picture
- **Requirement:** FR-FBK-005, FR-FBK-006, FR-FBK-009
- **Type / Priority:** Functional · P1
- **Preconditions:** A.
- **Test data:** Module Study, part Timetable, kind Bug, text "The Friday class is missing from the grid", a small PNG.
- **Steps:** 1. Fill and add the picture (also try paste). 2. Send.
- **Expected result:** Preview shown; button "Sending…"; "Thank you! Your message was sent to the developer." and toast; form cleared; message appears under "Your messages" with Bug chip, "Study › Timetable", status New, "with a picture". Context includes page, mode, version, screen.
- **Automation:** `v49_test` (send incl. GIF picture, thanks, list) · `pg_feedback_test` (database side).

#### TC-FBK-003 — Validation of comments
- **Requirement:** FR-FBK-004, FR-FBK-002
- **Type / Priority:** Boundary · P1
- **Preconditions:** Feedback page.
- **Test data:** "", "ab", "abc", 4000 characters, 4001 characters.
- **Steps:** 1. Send each.
- **Expected result:** Empty and "ab": "Write a few words about it first." (nothing sent); "abc" and 4000 sent; the box stops at 4000 and the counter reads "4000 / 4000".
- **Automation:** `v49_test` (empty message refused) · `pg_feedback_test` (min 3) · 4000 Manual.

#### TC-FBK-004 — Picture rules
- **Requirement:** FR-FBK-005
- **Type / Priority:** Boundary · P2
- **Preconditions:** Feedback page.
- **Test data:** PDF; 4000 × 3000 PNG of 8 MB; GIF 5 MB and 5.1 MB; WebP.
- **Steps:** 1. Add each.
- **Expected result:** PDF refused; large PNG shrunk to ≤ 1800 px JPEG and accepted; GIF 5.1 MB "That picture is bigger than 5 MB."; 5 MB GIF and WebP accepted; the cross removes the picture.
- **Automation:** Manual.

#### TC-FBK-005 — Ten messages a day
- **Requirement:** FR-FBK-007
- **Type / Priority:** Boundary · P1
- **Preconditions:** A with 0 messages today.
- **Test data:** 11 messages.
- **Steps:** 1. Send 10 then an 11th.
- **Expected result:** The 11th is refused with "You can send up to 10 messages a day. Please try again tomorrow." (rolling 24 hours); any picture just uploaded is removed.
- **Automation:** `pg_feedback_test` ("at most 10 a day").

#### TC-FBK-006 — Server guard against forgery
- **Requirement:** FR-FBK-008, FR-FBK-010, NFR-SEC-011
- **Type / Priority:** Security · P1
- **Preconditions:** A, C.
- **Test data:** insert with `user_id` of C; picture path in C's folder; kind "rant"; status "done".
- **Steps:** 1. As A attempt each insert. 2. As A update own row's status. 3. As C read A's feedback.
- **Expected result:** All refused or ignored (status stays New); user_label is set by the server as "Name <email>"; C sees nothing of A's.
- **Automation:** `pg_feedback_test` (picture in another folder, other user, kinds, no edit, read own).

#### TC-FBK-007 — Picture storage access
- **Requirement:** FR-FBK-015, NFR-SEC-006
- **Type / Priority:** Security · P1
- **Preconditions:** A's feedback picture exists.
- **Test data:** A's picture path.
- **Steps:** 1. As C create a signed URL or download it. 2. As A and as ADMIN do the same. 3. As C upload to A's folder.
- **Expected result:** C refused; A and ADMIN allowed; upload into another folder refused; bucket accepts only PNG, JPEG, WEBP, GIF up to 5 MB.
- **Automation:** Manual (storage policies are not exercised by `pg_feedback_test`).

#### TC-FBK-008 — Admins are told
- **Requirement:** FR-FBK-011
- **Type / Priority:** Integration · P2
- **Preconditions:** ADMIN and a second admin; A sends feedback.
- **Test data:** Module "Work", part "Tasks: board".
- **Steps:** 1. Send. 2. Read each admin's bell; as ADMIN send feedback yourself.
- **Expected result:** Each administrator (not the sender) gets "💡 New feedback: Work › Tasks: board" with the first 120 characters; opening goes to the inbox.
- **Automation:** `pg_feedback_test` (administrator told, opens feedback inbox).

#### TC-FBK-009 — "Your messages" list
- **Requirement:** FR-FBK-009
- **Type / Priority:** Functional · P2
- **Preconditions:** 35 messages by A.
- **Test data:** One with note "Fixing in 0.22" and status Planned.
- **Steps:** 1. Open the Feedback page.
- **Expected result:** Newest 30 listed with count "30"; the planned one shows its status chip and note with a reply arrow.
- **Automation:** `v49_test` (earlier messages and note) · 30-limit Manual.

#### TC-FBK-010 — Inbox access
- **Requirement:** FR-FBK-012, FR-ADM-002
- **Type / Priority:** Security · P1
- **Preconditions:** A and ADMIN.
- **Test data:** `/app/#adminfeedback`.
- **Steps:** 1. As A open the address and run a select on all feedback.
- **Expected result:** "This page is only for administrators." and the select returns only A's rows.
- **Automation:** `pg_feedback_test` (others cannot read; administrator reads all) · page text Manual.

#### TC-FBK-011 — Inbox filters and search
- **Requirement:** FR-FBK-012
- **Type / Priority:** Functional · P2
- **Preconditions:** ≥ 6 messages of mixed status and modules; one from a deleted account.
- **Test data:** Search "Gantt".
- **Steps:** 1. Open the inbox. 2. Press each status chip. 3. Pick a module. 4. Type in search.
- **Expected result:** Starts on New; chips show counts; filters combine; search matches message, sender and part; sender shows "Deleted account" for the orphan; empty filter shows "Nothing here — No messages match these filters."
- **Automation:** `v49_test` (inbox sub, cards, New filter, All filter, thumbnail).

#### TC-FBK-012 — Reply by status and note
- **Requirement:** FR-FBK-013
- **Type / Priority:** Functional · P1
- **Preconditions:** A message from A.
- **Test data:** Seen + "looking"; Planned + "Next release"; Done; Won't do.
- **Steps:** 1. ADMIN saves each in turn. 2. Read A's bell and "Your messages". 3. Save Planned again with the same status.
- **Expected result:** Seen: no notice; Planned: "🗓 Your feedback is planned: Work" with the note; Done: "✅ Your feedback was done"; Won't do: none; saving Planned again (status unchanged) sends no second notice. A sees the status and note. A non-admin calling `admin_feedback_update` gets "Not allowed".
- **Automation:** `pg_feedback_test` (seen quiet, planned notifies with note, person sees note, non-admin refused) · `v49_test` (status saved).

#### TC-FBK-013 — Note length and unknown status
- **Requirement:** FR-FBK-013
- **Type / Priority:** Boundary · P3
- **Preconditions:** ADMIN.
- **Test data:** Note of 1000 and 1001 characters; status "maybe".
- **Steps:** 1. Type in the note box; call the function with "maybe".
- **Expected result:** The box stops at 1000; the function answers "Unknown status".
- **Automation:** Manual.

#### TC-FBK-014 — Delete feedback
- **Requirement:** FR-FBK-014
- **Type / Priority:** Functional · P2
- **Preconditions:** Message with a picture.
- **Test data:** None.
- **Steps:** 1. ADMIN presses delete; Cancel; then confirm. 2. As A call `admin_feedback_delete`.
- **Expected result:** Confirmation "It is removed for good, with its picture."; row and picture gone; A's call fails "Not allowed".
- **Automation:** `pg_feedback_test` (admin can delete) · picture removal Manual.

#### TC-FBK-015 — Feedback survives account deletion
- **Requirement:** FR-FBK-016, FR-ACC-011
- **Type / Priority:** Data · P2
- **Preconditions:** A sent 9 messages (one with a picture).
- **Test data:** None.
- **Steps:** 1. Delete A's account. 2. Open the inbox.
- **Expected result:** Messages remain with sender "Deleted account"; the pictures were removed from storage by the delete function, so "Open picture" fails (Findings).
- **Automation:** `pg_feedback_test` (rows kept, owner empty) · picture Manual.

#### TC-FBK-016 — Feedback on phones
- **Requirement:** FR-FBK-002, NFR-RSP-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** Widths 320, 360, 390, 1180; ADMIN for the inbox.
- **Test data:** Long comment, wide screenshot.
- **Steps:** 1. Open Feedback and Feedback inbox.
- **Expected result:** No horizontal scroll; kind buttons wrap; admin row (status, note, Save, delete) stacks.
- **Automation:** `audit` 320 / 360 (feedback, adminfeedback in Work mode list) · 390 / 1180 Manual.

## 8. SUP — Support

#### TC-SUP-001 — Channels
- **Requirement:** FR-SUP-001, FR-SUP-006
- **Type / Priority:** Functional · P2
- **Preconditions:** Support page in each mode.
- **Test data:** None.
- **Steps:** 1. Press "Email us". 2. Press "WhatsApp". 3. Read the hours line.
- **Expected result:** A mail window to aeinscape@gmail.com opens; wa.me/60122108459 opens in a new tab; "Support hours: Mon–Fri, 9am–6pm (MYT)".
- **Automation:** `v41_test` (page renders) · Manual.

#### TC-SUP-002 — Contact form empty message
- **Requirement:** FR-SUP-002
- **Type / Priority:** Negative · P2
- **Preconditions:** Support page.
- **Test data:** Empty / spaces.
- **Steps:** 1. Press "Send message".
- **Expected result:** The message box border turns red; nothing else happens; the five subjects (Billing & plans … Other) are listed.
- **Automation:** Manual.

#### TC-SUP-003 — Contact form send
- **Requirement:** FR-SUP-003
- **Type / Priority:** Functional · P1
- **Preconditions:** Support page, network tab open.
- **Test data:** "My plan did not change".
- **Steps:** 1. Type and press "Send message".
- **Expected result:** The box empties and "Thanks! Our team will reply to your account email shortly." shows. As built, no network request is made and nobody receives the message (Findings — this test is expected to fail the real intent).
- **Automation:** Manual.

#### TC-SUP-004 — FAQ accordion
- **Requirement:** FR-SUP-004
- **Type / Priority:** Functional · P2
- **Preconditions:** Support page.
- **Test data:** None.
- **Steps:** 1. Open question 1, then question 3. 2. Press an open question. 3. Count the questions (41).
- **Expected result:** Only one answer open at a time; the arrow turns; pressing the open one closes it; 41 questions.
- **Automation:** Manual.

#### TC-SUP-005 — FAQ accuracy against the code
- **Requirement:** FR-SUP-004, FR-SUP-005, FR-PLN-003, FR-PLN-015
- **Type / Priority:** Data · P2
- **Preconditions:** Plan limits at their default values.
- **Test data:** Prices, limits and times quoted in the FAQ.
- **Steps:** 1. Compare the FAQ numbers (storage 50 MB / 300 MB / 1 GB, wallpapers 4 / 8 / 11, Lumi 3 / 10 / 15, Work 5 / 20 / 8 / 600 / 5, Work Pro 20 / 60 / 15 / 1500 / 20, busy thresholds 6 / 9, 10 feedback messages) with Settings, the plans popup and `plan_limits`.
- **Expected result:** All agree; delete-account answer matches the Settings flow.
- **Automation:** Manual.

#### TC-SUP-006 — Support on phones
- **Requirement:** FR-SUP-001, NFR-RSP-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Widths 320, 360, 390, 1180.
- **Test data:** Open the longest FAQ answer (Work projects).
- **Steps:** 1. Open Support.
- **Expected result:** Channels and form stack; FAQ scrolls inside its card; no horizontal scroll.
- **Automation:** `audit` 320 / 360 (support in the Work list) · Manual.

## 9. ADM — Administrator tools

#### TC-ADM-001 — Admin access control
- **Requirement:** FR-ADM-001, FR-ADM-002, NFR-SEC-003
- **Type / Priority:** Security · P1
- **Preconditions:** A (normal), ADMIN.
- **Test data:** `/app/#admin`, `#adminreport`; RPCs `admin_list_users`, `admin_stats`, `admin_set_plan`, `admin_plan_limits`, `admin_recent_actions`.
- **Steps:** 1. As A look for the Admin menu item and open each address. 2. Call each RPC as A and as anon.
- **Expected result:** No Admin menu item; pages say "This page is only for administrators."; every RPC fails with "Not allowed" (anon: permission denied); `admin_users` cannot be selected or inserted by A.
- **Automation:** `pg_admin_test` (trials, bulk grant, roles, log readable only by admins) · `pg_busy_test` (limits editor refused) · others Manual.

#### TC-ADM-002 — Overview tiles and list
- **Requirement:** FR-ADM-003, FR-ADM-004
- **Type / Priority:** Functional · P2
- **Preconditions:** 5 accounts including an unverified one and a deactivated one.
- **Test data:** Search "aina".
- **Steps:** 1. Open Admin. 2. Search by name and e-mail fragment.
- **Expected result:** Tiles Accounts, Dawn, Glow, Zenith, New in 7 days and subtitle "<n> accounts · <n> new this week"; rows show badges Admin / You / Unverified / Deactivated, "Joined … · Seen …", plan and add-on tiles; search filters after about 300 ms; empty result "No accounts match."
- **Automation:** `pg_admin_test` ("admin list shows trial usage and add-on source") · `v41_test` (admin page renders) · Manual.

#### TC-ADM-003 — Change a plan with duration
- **Requirement:** FR-ADM-005, FR-ADM-007, FR-PLN-031
- **Type / Priority:** Functional · P1
- **Preconditions:** A on Dawn.
- **Test data:** Glow, 3 months.
- **Steps:** 1. Press A's plan tile. 2. Choose Glow and "3 months"; read the preview. 3. Apply. 4. Reopen, choose Glow "1 month" and "Add to it"; Apply.
- **Expected result:** Preview "It runs until <date> (3 months from today)."; toast "Plan changed"; list shows Glow with end date; second step: preview "(<date> + 1 month)" and the end moves one month later; A is notified; history rows "Switched on" then "Time added".
- **Automation:** Manual (no automated test calls `admin_set_plan`; only `pg_boot` applies it).

#### TC-ADM-004 — Duration edge cases
- **Requirement:** FR-ADM-007
- **Type / Priority:** Boundary · P2
- **Preconditions:** A plan ending on 31 January.
- **Test data:** +1 month; "Until a date" 28 Feb; "No end"; Dawn.
- **Steps:** 1. Add 1 month with Add-to-it. 2. Choose "Until a date" without a date and Apply. 3. Choose a date. 4. Choose "No end". 5. Set Dawn.
- **Expected result:** End 28 (or 29) February; "Pick the last day." when no date; date ends at the end of that day in A's own time zone; "No end" clears the date ("No end date"); Dawn says "The free plan has no end date." and clears it.
- **Automation:** Manual.

#### TC-ADM-005 — Add-on on, off, size
- **Requirement:** FR-ADM-006, FR-ADM-007
- **Type / Priority:** Functional · P1
- **Preconditions:** A.
- **Test data:** Work, Work Pro, 1 month; then Off.
- **Steps:** 1. Press A's Work tile; choose On, Normal, size "Work Pro", 1 month; Apply. 2. Renew without a size. 3. Set size standard. 4. Study with a size. 5. Press Off.
- **Expected result:** List tile reads "Work Pro" with the date; renewing keeps the size; changed back on request; Study stays standard; Off ends it now (tile "tap to give") and history shows "Switched off". A unknown size is refused.
- **Automation:** `pg_busy_test` (Work Pro given, shown in list, renewal keeps size, set back, unknown size refused, Study has no sizes).

#### TC-ADM-006 — Give a free trial by hand and reset it
- **Requirement:** FR-ADM-008
- **Type / Priority:** Functional · P1
- **Preconditions:** A without Study, trial unused.
- **Test data:** Study.
- **Steps:** 1. Choose "Free trial · 7 days" and Apply. 2. Try again while it runs. 3. Let it end; read the note; press "Reset". 4. As A start the trial.
- **Expected result:** Toast "Free trial started"; second attempt "They already have this add-on switched on"; the note says the trial was used and "Reset" shows; after reset A can start it again.
- **Automation:** `pg_admin_test` (trial counted, cannot stack, reset).

#### TC-ADM-007 — Changing own plan
- **Requirement:** FR-ADM-009
- **Type / Priority:** Functional · P2
- **Preconditions:** ADMIN in Work mode.
- **Test data:** Switch own Work off.
- **Steps:** 1. Apply to own row.
- **Expected result:** Toast "Your own plan or add-ons changed"; the app leaves Work to Personal / Dashboard; no notification for the admin.
- **Automation:** Manual.

#### TC-ADM-008 — Bulk selection helpers
- **Requirement:** FR-ADM-011
- **Type / Priority:** Functional · P2
- **Preconditions:** 12 people, 3 already have Study, 1 admin, 1 deactivated.
- **Test data:** Pick 10 who do not have Study; pick 600; pick 0.
- **Steps:** 1. Press "Pick them". 2. Switch the chip to Work. 3. Use "Select all shown" and "Clear".
- **Expected result:** Skips admins, deactivated and holders; "Only <n> found" toast when fewer; number clamps 1 to 500; "Nobody to pick…" note when none; count "<n> selected".
- **Automation:** Manual.

#### TC-ADM-009 — Bulk free access (start now)
- **Requirement:** FR-ADM-012, FR-ADM-014
- **Type / Priority:** Functional · P1
- **Preconditions:** ADMIN selects A, C, B (B has Study).
- **Test data:** Study, 30 days (via 1 month), note "Beta testers".
- **Steps:** 1. "Give free access…" → Start now. 2. Leave "Skip them" and Apply. 3. Repeat with "Add time to theirs". 4. Choose "Until a date" without a date.
- **Expected result:** First: toast "2 new, 1 skipped · Study"; A and C get "🎁 Free Study access" with the note and still have their own trial; second: "1 extended"; no-date: "Pick the last day."; with 0 people the button is disabled; 501 ids refused "Up to 500 people at a time".
- **Automation:** `pg_admin_test` (bulk grant counts, unknown ids ignored, skip existing, extend, notification, trial untouched, duration required, only admins).

#### TC-ADM-010 — Bulk gifts (they choose when)
- **Requirement:** FR-ADM-013, FR-PLN-025
- **Type / Priority:** Functional · P1
- **Preconditions:** ADMIN, A, a person holding 3 unused gifts, a deactivated person.
- **Test data:** Work 14 days, claim 30 days.
- **Steps:** 1. Choose "They choose when", durations, deadline; read the preview; Apply.
- **Expected result:** Preview "A gift of Work for 14 days is sent to <n> people, to use within 30 days. Nothing starts until they press "Use now". People who already hold 3 unused gifts are skipped."; toast "<n> sent, <m> skipped (already hold 3)"; "Until a date" is not offered for gifts.
- **Automation:** `pg_gift_test` (sent to 2, not switched on, limit 3, admin log).

#### TC-ADM-011 — Deactivate and reactivate
- **Requirement:** FR-ADM-015, FR-AUTH-016
- **Type / Priority:** Security · P1
- **Preconditions:** A signed in on a phone.
- **Test data:** Reason "abuse".
- **Steps:** 1. ADMIN opens A's "…" menu → Deactivate. 2. A tries to use the app and sign in. 3. Reactivate. 4. Try to deactivate self and another admin.
- **Expected result:** Row greyed with "Deactivated"; A's sessions end and sign-in is refused; data kept; reactivation lets A sign in; self and admin: "You can not deactivate your own account" / "An administrator can not be deactivated"; the options are hidden for those rows.
- **Automation:** `pg_admin_test` (ban, sessions removed, no self-reactivation, no self / admin deactivation, reactivate).

#### TC-ADM-012 — Make and remove administrator
- **Requirement:** FR-ADM-016
- **Type / Priority:** Security · P1
- **Preconditions:** ADMIN, A, a deactivated person.
- **Test data:** None.
- **Steps:** 1. Make A administrator (confirm). 2. A opens Admin. 3. Remove. 4. Try on self and on the deactivated person.
- **Expected result:** A is notified "You are now an administrator" and can use admin pages; after removal cannot; self: "You can not change your own administrator access" (button hidden); deactivated: "Reactivate this account before making it an administrator".
- **Automation:** `pg_admin_test` (roles, self, deactivated).

#### TC-ADM-013 — Delete an account from Admin
- **Requirement:** FR-ADM-017, FR-ADM-018, FR-ACC-006
- **Type / Priority:** Functional · P1
- **Preconditions:** A with data and files; function deployed.
- **Test data:** A's e-mail.
- **Steps:** 1. Open A's menu; read the Delete button state. 2. Type A's e-mail in different case; press Delete; confirm. 3. Open the menu of ADMIN's own row and of another admin.
- **Expected result:** Button disabled until the typed e-mail matches (case ignored); after confirmation toast "Account deleted"; A vanishes from the list; log shows "Deleted an account". Own and admin rows show only the explanation.
- **Automation:** `pg_admin_test` (cascade removal) · `del_test` is a Lumi test, not this function · Manual.

#### TC-ADM-014 — Admin log
- **Requirement:** FR-ADM-019, NFR-OBS-001
- **Type / Priority:** Functional · P2
- **Preconditions:** Several admin actions done.
- **Test data:** None.
- **Steps:** 1. Read "Recent admin actions". 2. Call `admin_recent_actions(500)`. 3. Change a plan and an add-on and a limit; check the log.
- **Expected result:** Newest 15 shown with title, target and counts, administrator name and time; the function caps at 200; trials, gifts, free access, deactivate, roles and delete appear; plan, add-on and limit changes do NOT appear in this log (Findings).
- **Automation:** `pg_admin_test` ("every admin action is logged": give_trial, reset_trial, bulk_grant, deactivate, reactivate; only admins read it) · `pg_gift_test` (bulk_gift logged).

#### TC-ADM-015 — Plan report
- **Requirement:** FR-ADM-020
- **Type / Priority:** Functional · P2
- **Preconditions:** Several months of data.
- **Test data:** Range Last 3 months, then All.
- **Steps:** 1. Open Admin → View report. 2. Press chips; change From and To (From later than To). 3. Click a bar. 4. Download CSV.
- **Expected result:** Chart stacks Dawn, Glow, Zenith; tiles show the selected month ("(so far)" for this month); the range stays ordered; CSV `luma-plan-report-YYYY-MM-to-YYYY-MM.csv` with header "Month,Accounts,New sign-ups,Dawn,Glow,Zenith,Upgrades,Downgrades" and newest month first.
- **Automation:** `v41_test` (page renders with mock) · Manual.

#### TC-ADM-016 — Work report
- **Requirement:** FR-ADM-021
- **Type / Priority:** Functional · P3
- **Preconditions:** Some Work users and a trial.
- **Test data:** None.
- **Steps:** 1. Scroll to "Work add-on" on the report page.
- **Expected result:** Tiles and monthly table; if migration 080 is missing the text asks to run it; non-admin RPC call fails.
- **Automation:** Manual.

#### TC-ADM-017 — Plan limits editor
- **Requirement:** FR-ADM-022, FR-PLN-003
- **Type / Priority:** Functional · P1
- **Preconditions:** ADMIN.
- **Test data:** Dawn "habits" 5 → 7; Work Pro "work_tasks" cleared; -1; 2.7.
- **Steps:** 1. Press "Edit limits". 2. Change two boxes; read the button. 3. "Undo changes". 4. Change again and Save. 5. Type -1 and 2.7. 6. As A (Dawn) add a 7th habit.
- **Expected result:** Changed boxes highlighted, button "Save 2 changes"; Undo restores; Save says "Saved 2 changes. They apply straight away."; empty = unlimited (∞ placeholder); -1 is saved as 0 and 2.7 as 2; the 7th Dawn habit is now accepted by the database.
- **Automation:** `pg_busy_test` (lists limits; changes; null = unlimited; unknown key and negative refused; non-admin refused).

#### TC-ADM-018 — Limit editor failure path
- **Requirement:** FR-ADM-022
- **Type / Priority:** Negative · P3
- **Preconditions:** Make the third change fail (block the request).
- **Test data:** Three changed boxes.
- **Steps:** 1. Save.
- **Expected result:** "2 saved, then it stopped: <error>" in red; remaining box still highlighted; Save still available.
- **Automation:** Manual.

#### TC-ADM-019 — Feedback inbox card on Admin
- **Requirement:** FR-ADM-023
- **Type / Priority:** Functional · P3
- **Preconditions:** 3 new feedback messages.
- **Test data:** None.
- **Steps:** 1. Open Admin.
- **Expected result:** Feedback inbox card shows "3 new" and "Open inbox"; Plan report and Plan limits cards present.
- **Automation:** `v41_test` (page renders) · Manual.

#### TC-ADM-020 — Missing migration messages
- **Requirement:** FR-ADM-010
- **Type / Priority:** Negative · P3
- **Preconditions:** Database without migration 065 (test copy).
- **Test data:** Start a trial.
- **Steps:** 1. Apply the trial.
- **Expected result:** "Run supabase/migrations/065_admin_tools.sql in the SQL Editor first."
- **Automation:** Manual.

#### TC-ADM-021 — Admin list limit of 500
- **Requirement:** FR-ADM-004, NFR-PRF-004
- **Type / Priority:** Boundary · P3
- **Preconditions:** 520 accounts (test data).
- **Test data:** Search for the 510th newest by e-mail.
- **Steps:** 1. Open Admin and count; search.
- **Expected result:** 500 rows listed; the oldest 20 only appear through search; tile "Accounts" shows the true total.
- **Automation:** Manual.

#### TC-ADM-022 — Admin pages on phones and laptop
- **Requirement:** FR-ADM-004, NFR-RSP-001
- **Type / Priority:** Responsive · P1
- **Preconditions:** ADMIN; widths 320, 360, 390, 1180.
- **Test data:** Plan popup, bulk popup, account popup, limits grid, report table.
- **Steps:** 1. Open Admin, the three popups, the limits editor and the report.
- **Expected result:** No page scroll sideways (tables and the limits grid scroll inside their box); popups fit with fixed header and buttons; tiles wrap.
- **Automation:** `audit` default list includes admin and adminreport (Personal, 320 / 360) · `audit_modals` · 390 / 1180 Manual.

#### TC-ADM-023 — Admin tools across browsers
- **Requirement:** FR-ADM-005, NFR-BRW-001
- **Type / Priority:** Compatibility · P3
- **Preconditions:** Chrome, Safari, Firefox, Edge.
- **Test data:** None.
- **Steps:** 1. Change a plan with the date picker; download the CSV; open the chart.
- **Expected result:** Same results; CSV downloads and the SVG chart draws in each.
- **Automation:** Manual.

## 10. ACC — Account, export and delete

#### TC-ACC-001 — Export my data
- **Requirement:** FR-ACC-001, FR-ACC-002
- **Type / Priority:** Functional · P1
- **Preconditions:** B with tasks, events, notes, habits, bills, money, reminders, health, a document and Study data.
- **Test data:** None.
- **Steps:** 1. Settings → Export. 2. Open the file.
- **Expected result:** Button "Preparing…" then restored; file `luma-export-<date>.json` holds exported_at, account, tasks, events, notes, habits, habit_logs, goals, bills_and_subscriptions, bill_payments, money_entries, study, reminders, health_logs, documents (name, size only); message "Your data was downloaded. Uploaded files are not included, only their names."
- **Automation:** Manual.

#### TC-ACC-002 — Export is complete across modes
- **Requirement:** FR-ACC-001, FR-SET-013
- **Type / Priority:** Data · P1
- **Preconditions:** B has Work items (events, reminders, documents) and Personal items; "Show Work in Personal" off.
- **Test data:** None.
- **Steps:** 1. Export in Personal mode. 2. Export in Work mode. 3. Compare.
- **Expected result:** Expected: the file holds everything the person owns. Observed in code: the export reads through the mode filter, so Work items are missing from a Personal export (Findings); contacts, messages and Work projects are not in the file at all.
- **Automation:** Manual.

#### TC-ACC-003 — Export failure
- **Requirement:** FR-ACC-002
- **Type / Priority:** Negative · P3
- **Preconditions:** Offline.
- **Test data:** None.
- **Steps:** 1. Press Export.
- **Expected result:** Either the file with empty sections or "Could not export: …"; button text returns to "Export".
- **Automation:** Manual.

#### TC-ACC-004 — Delete dialog and confirmation
- **Requirement:** FR-ACC-003
- **Type / Priority:** Functional · P1
- **Preconditions:** A with data.
- **Test data:** Typed e-mail in capitals; a wrong e-mail.
- **Steps:** 1. Press Delete…. 2. Read the list. 3. Type a wrong e-mail, then the right one in capitals. 4. Press the red button; press Cancel in the second dialog. 5. Press "download my data first".
- **Expected result:** Popup lists what is removed and shows the e-mail; the final button is disabled until the e-mail matches (case ignored); a second dialog "Delete your account forever?" appears; Cancel keeps the account; download starts the export.
- **Automation:** Manual.

#### TC-ACC-005 — Delete removes everything
- **Requirement:** FR-ACC-007, FR-ACC-009, FR-ACC-010
- **Type / Priority:** Functional · P1
- **Preconditions:** A with tasks, document upload, own wallpaper and feedback with picture; C's data separate.
- **Test data:** A's e-mail.
- **Steps:** 1. Confirm deletion. 2. Check Auth users, tables and the three buckets. 3. Check C's data. 4. Try to sign in as A.
- **Expected result:** Redirect to `/login/?deleted=1` with the green message; local and session storage cleared; A's auth user, rows and files in luma-documents, luma-backgrounds, luma-feedback are gone; C untouched; sign-in fails.
- **Automation:** `pg_admin_test` (account removal cascades through tasks, profiles, Study, splits; other people untouched) · files and function Manual.

#### TC-ACC-006 — Delete function permissions
- **Requirement:** FR-ACC-005, FR-ACC-006, NFR-SEC-007
- **Type / Priority:** Security · P1
- **Preconditions:** Deployed function; tokens for A, C, ADMIN.
- **Test data:** Requests: no token; GET; `{action:"x"}`; `{action:"delete",user_id:"abc"}`; unknown uuid; A deleting C; A deleting self without confirm; ADMIN deleting another admin; ADMIN deleting self.
- **Steps:** 1. Send each.
- **Expected result:** 401 "Please sign in again."; 405 "POST only"; 400 "Bad request"; 400 "Bad user id"; 404 "No such account."; 403 "Not allowed."; 400 "Type your email address to confirm."; 403 "An administrator account can not be deleted."; 403 "An administrator account can not be deleted here."
- **Automation:** Manual (`del_test` and `upd_test` test the Lumi function, not `account`; `esbuild` only checks that `account` compiles).

#### TC-ACC-007 — Administrator sees a note instead of the form
- **Requirement:** FR-ACC-004
- **Type / Priority:** Functional · P2
- **Preconditions:** ADMIN.
- **Test data:** None.
- **Steps:** 1. Settings → Delete my account.
- **Expected result:** The admin note is shown, the delete form hidden.
- **Automation:** Manual.

#### TC-ACC-008 — Function not deployed
- **Requirement:** FR-ACC-009
- **Type / Priority:** Negative · P3
- **Preconditions:** Function blocked (404).
- **Test data:** Correct e-mail.
- **Steps:** 1. Confirm deletion.
- **Expected result:** "Account deletion is not switched on yet. Please contact support to delete your account."; button returns to "Delete my account forever" (enabled when the e-mail matches).
- **Automation:** Manual.

#### TC-ACC-009 — Audit entry for deletion
- **Requirement:** FR-ACC-008, FR-ADM-019
- **Type / Priority:** Data · P2
- **Preconditions:** A self-deletes; ADMIN deletes C.
- **Test data:** None.
- **Steps:** 1. Read the admin log.
- **Expected result:** Two "Deleted an account" entries with e-mails; details hold self true / false and files_removed; the entries remain after the accounts are gone.
- **Automation:** Manual.

#### TC-ACC-010 — Large folders and partial failure
- **Requirement:** FR-ACC-007
- **Type / Priority:** Boundary · P3
- **Preconditions:** A account with 1,200 files in one folder (test).
- **Test data:** None.
- **Steps:** 1. Delete the account. 2. List the bucket folder.
- **Expected result:** Expected: all files removed. Observed in code: only the first 1000 per folder are listed in one pass, so up to 200 may stay orphaned; and files are removed before the sign-in, so a failed user delete leaves a live account without files (Findings).
- **Automation:** Manual.

#### TC-ACC-011 — Privacy: storage keys cleared
- **Requirement:** FR-ACC-009, NFR-PRV-003
- **Type / Priority:** Security · P2
- **Preconditions:** Signed-in browser.
- **Test data:** None.
- **Steps:** 1. List localStorage keys. 2. Log out normally; list again. 3. Delete account; list.
- **Expected result:** Keys: `luma.remember`, `luma.rememberedEmail` (only if remembered), `luma_plan_cache`, `luma_mode`, `luma_push_declined`, `luma_profile_pending`, `luma_installed`, Supabase session; after deletion everything is cleared; after a normal log-out the plan cache and mode remain (TBC whether intended).
- **Automation:** Manual.

#### TC-ACC-012 — Account section on phones
- **Requirement:** FR-ACC-003, NFR-RSP-001
- **Type / Priority:** Responsive · P2
- **Preconditions:** Widths 320, 360, 390.
- **Test data:** None.
- **Steps:** 1. Open the delete popup and Settings → Account and data.
- **Expected result:** Popup fits, the e-mail box and buttons are fully visible; rows wrap without sideways scroll.
- **Automation:** `audit_modals` (all popups) · Manual.

## 11. NFR — Non-functional test cases

#### TC-NFR-001 — RLS on every personal table
- **Requirement:** NFR-SEC-001, NFR-PRV-001
- **Type / Priority:** Security · P1
- **Preconditions:** A and C with data in profiles, notifications, push_subscriptions, reminder_prefs, feedback, purchase_history, addon_gifts, user_addons.
- **Test data:** API console as A.
- **Steps:** 1. For each table select all rows. 2. Select `admin_users`, `admin_audit`, `plan_changes`. 3. Try insert / update / delete of C's rows.
- **Expected result:** A sees only A's rows; the three admin tables return no rows or permission denied; all writes to C's rows affect nothing.
- **Automation:** `pg_feedback_test`, `pg_gift_test`, `pg_admin_test` check parts (feedback, gifts, admin log) · rest Manual.

#### TC-NFR-002 — All migrations apply cleanly and twice
- **Requirement:** NFR-MNT-003, NFR-SEC-002
- **Type / Priority:** Functional · P1
- **Preconditions:** `docs/test-automation` installed.
- **Test data:** None.
- **Steps:** 1. Run `node sql/pg_boot.js`. 2. Re-run a few migrations (031, 062, 069, 081) on the same database.
- **Expected result:** "applied N migration files; 0 with errors"; re-runs succeed (migrations are "safe to re-run"). Every `security definer` function in `pg_proc` has `search_path` set to empty.
- **Automation:** `pg_boot` (apply) · re-run and `search_path` check Manual.

#### TC-NFR-003 — Admin and internal functions are not callable by others
- **Requirement:** NFR-SEC-003, NFR-SEC-004
- **Type / Priority:** Security · P1
- **Preconditions:** A signed in; anon key.
- **Test data:** `luma.notify`, `plan_of`, `limit_of`, `has_addon`, `admin_log`, `run_plan_expiry`, `run_busy_alerts`, `busy_day_stats`, `has_my_addon('study')`.
- **Steps:** 1. Call each through the REST rpc as A and as anon.
- **Expected result:** Permission denied for every one except `has_my_addon`, which answers only about the caller; no one can send themselves a notification.
- **Automation:** `pg_admin_test` and `pg_busy_test` check "Not allowed" for admin functions; the revoke grants are Manual.

#### TC-NFR-004 — Plan, expiry and deactivation fields are protected
- **Requirement:** NFR-SEC-005, NFR-SEC-010
- **Type / Priority:** Security · P1
- **Preconditions:** A.
- **Test data:** Update `plan`, `plan_expires_at`, `disabled_at`, `disabled_reason` as A.
- **Steps:** 1. Update each. 2. Read the profile.
- **Expected result:** All four unchanged; admin functions can change them (switch limited to their statement).
- **Automation:** `pg_admin_test` (no self-reactivation) · others Manual.

#### TC-NFR-005 — Storage buckets are private and per-folder
- **Requirement:** NFR-SEC-006
- **Type / Priority:** Security · P1
- **Preconditions:** A and C; files in `luma-documents`, `luma-backgrounds`, `luma-feedback`.
- **Test data:** Public URL guessing; A reading C's path.
- **Steps:** 1. Open a public-style URL of A's file without a token. 2. As C list / download / upload into A's folder. 3. Check signed URL lifetimes (wallpaper 7 days, feedback 1 hour).
- **Expected result:** Public access denied; cross-folder access denied (except admin reading feedback pictures and shared documents by policy); signed URLs stop working after their time.
- **Automation:** Manual.

#### TC-NFR-006 — CORS and secrets
- **Requirement:** NFR-SEC-007, NFR-SEC-008
- **Type / Priority:** Security · P2
- **Preconditions:** Browser dev tools; repository.
- **Test data:** OPTIONS and POST from a foreign origin; search the repository.
- **Steps:** 1. Call `account` from another origin with no token. 2. Search the client files for "VAPID_PRIVATE", "service_role", "WEBHOOK_SECRET".
- **Expected result:** `account` answers CORS headers (`*`) but refuses unauthenticated calls (401); no private key or service key appears in client code; only the publishable Supabase key and the public VAPID key do.
- **Automation:** Manual.

#### TC-NFR-007 — Output escaping
- **Requirement:** NFR-SEC-009
- **Type / Priority:** Security · P1
- **Preconditions:** A sets first name `<b onmouseover=alert(1)>X</b>`, sends feedback with `<script>` text; ADMIN opens the inbox and user list.
- **Test data:** Those strings; a contact name with HTML.
- **Steps:** 1. View the profile card, search, notification, admin list and inbox.
- **Expected result:** Text appears literally everywhere; no HTML or script runs. (Note: Settings profile card inserts the name without escaping in `settings.js` — verify; see Findings.)
- **Automation:** Manual.

#### TC-NFR-008 — Database input limits
- **Requirement:** NFR-SEC-011
- **Type / Priority:** Boundary · P2
- **Preconditions:** Console.
- **Test data:** Feedback module 61 chars, part 81 chars, context 2001 chars, image path 301 chars; gift note 121 chars; limit -1.
- **Steps:** 1. Insert each.
- **Expected result:** Each is refused by the check constraints or functions (gift note and limit through the admin functions are truncated or refused as in the SQL).
- **Automation:** `pg_feedback_test` (kinds, 3-char minimum, folder rule) · rest Manual.

#### TC-NFR-009 — Third-party scripts
- **Requirement:** NFR-SEC-012
- **Type / Priority:** Security · P3
- **Preconditions:** View source of `app/index.html`.
- **Test data:** None.
- **Steps:** 1. Check the supabase-js, Font Awesome and Google Fonts tags.
- **Expected result:** Expected: pinned versions with integrity hashes. Observed: supabase-js `@2` with no integrity attribute (fails the "should").
- **Automation:** Manual.

#### TC-NFR-010 — Loading cover timing
- **Requirement:** NFR-PRF-001, NFR-PRF-002
- **Type / Priority:** Performance · P2
- **Preconditions:** Chrome, throttled "Fast 3G" and normal network.
- **Test data:** None.
- **Steps:** 1. Reload the app with each. 2. Time the cover. 3. Check script URLs on staging and production.
- **Expected result:** Cover shown at once and at least 1 s; ends when the dashboard has loaded; staging URLs carry a new timestamp each load, production a version only. Record time to the dashboard (no target defined, TBC).
- **Automation:** Manual.

#### TC-NFR-011 — Bounded lists
- **Requirement:** NFR-PRF-003, NFR-PRF-004
- **Type / Priority:** Performance · P3
- **Preconditions:** Large test data: 250 notifications, 600 feedback rows, 60 purchase rows.
- **Test data:** None.
- **Steps:** 1. Open Notifications, the inbox, Purchase history; search twice within a minute and once after.
- **Expected result:** 200 / 500 / 40 rows respectively; second search uses cached data (no new requests), third refetches; search covers 24 months of money entries.
- **Automation:** Manual.

#### TC-NFR-012 — Images are shrunk before upload
- **Requirement:** NFR-PRF-005
- **Type / Priority:** Performance · P3
- **Preconditions:** A 12 MB, 6000 px photo.
- **Test data:** That photo.
- **Steps:** 1. Upload as wallpaper (Zenith) and as a feedback picture; check stored sizes.
- **Expected result:** Wallpaper stored as JPEG with longest side ≤ 1920 px; feedback picture ≤ 1800 px JPEG.
- **Automation:** Manual.

#### TC-NFR-013 — Resilience: cron not enabled
- **Requirement:** NFR-AVL-005
- **Type / Priority:** Negative · P3
- **Preconditions:** Database without pg_cron.
- **Test data:** Run migrations 062, 069, 082.
- **Steps:** 1. Run each.
- **Expected result:** The functions are created, the scheduling block only raises a notice ("Could not schedule … Enable pg_cron …"); no migration fails.
- **Automation:** `pg_boot` (PGlite has no pg_cron; migrations still apply) — confirms no failure.

#### TC-NFR-014 — Environment keys fallback
- **Requirement:** NFR-AVL-006, NFR-OBS-003
- **Type / Priority:** Functional · P3
- **Preconditions:** Production host with blank production keys.
- **Test data:** None.
- **Steps:** 1. Open the production site; read the version line and the requests' host.
- **Expected result:** Uses the staging Supabase project; version line without STAGING (it only flags non-production hosts) — Findings.
- **Automation:** Manual.

#### TC-NFR-015 — Breakpoints and no sideways scroll
- **Requirement:** NFR-RSP-001, NFR-RSP-002, NFR-RSP-004
- **Type / Priority:** Responsive · P1
- **Preconditions:** Widths 320, 360, 390, 768, 1024, 1180.
- **Test data:** B in Personal, Work, Study mode.
- **Steps:** 1. Visit every page and every popup at each width. 2. Rotate a phone.
- **Expected result:** No horizontal scroll of the page; drawer menu at ≤ 768 px, permanent sidebar above; popups have fixed header and buttons with scrolling body.
- **Automation:** `audit.sh` / `audit_modals.sh` at 320 and 360 (Work pages list in `run_all.sh`; default list for the Personal pages) · other widths Manual.

#### TC-NFR-016 — iPhone safe areas and standalone
- **Requirement:** NFR-RSP-003, NFR-BRW-002
- **Type / Priority:** Compatibility · P1
- **Preconditions:** iPhone with a notch, app on the Home Screen.
- **Test data:** None.
- **Steps:** 1. Open LUMA; rotate; open Settings and a popup.
- **Expected result:** Content is not hidden under the notch or home bar; status bar translucent; app standalone.
- **Automation:** Device only.

#### TC-NFR-017 — Keyboard operation
- **Requirement:** NFR-AXS-001, NFR-AXS-002
- **Type / Priority:** Usability · P2
- **Preconditions:** Desktop browser, keyboard only.
- **Test data:** None.
- **Steps:** 1. Tab to the search icon; press Enter / Space. 2. Try to reach the bell and log-out icons with Tab. 3. Open dialog, dropdown, date picker, bell panel and press Escape.
- **Expected result:** Search opens by keyboard; the bell and log-out icons are not focusable (fails the "should" for them — Findings); Escape closes each layer without closing others; Enter accepts a dialog.
- **Automation:** Manual.

#### TC-NFR-018 — Accessible names and status
- **Requirement:** NFR-AXS-003, NFR-AXS-004, NFR-AXS-005
- **Type / Priority:** Usability · P3
- **Preconditions:** Screen reader (VoiceOver / NVDA).
- **Test data:** None.
- **Steps:** 1. Navigate icon-only buttons (feedback remove, busy-notice cross, inbox delete, bell). 2. Trigger the loading cover and an undo bar.
- **Expected result:** The three named buttons are read with their labels; the bell reads only its tooltip (title); loading cover and undo bar are announced as status. Contrast and reduced motion: record results (TBC).
- **Automation:** Manual.

#### TC-NFR-019 — Browser matrix smoke test
- **Requirement:** NFR-BRW-001, NFR-BRW-003, NFR-BRW-004
- **Type / Priority:** Compatibility · P1
- **Preconditions:** Chrome, Edge, Firefox, Safari (desktop), Safari iPhone, Chrome Android.
- **Test data:** Account B.
- **Steps:** 1. Register or sign in; open every menu page; open search; date picker; create a task and undo; change theme; switch modes.
- **Expected result:** Same behaviour everywhere; time-zone labels show "GMT+hh:mm"; where Web Push is unavailable the Settings text says so and in-tab notifications still work.
- **Automation:** `v41_test` (jsdom only, not a real browser) · Manual / Device only.

#### TC-NFR-020 — Privacy: feedback and Lumi disclosure
- **Requirement:** NFR-PRV-004, NFR-PRV-005, NFR-PRV-006
- **Type / Priority:** Data · P2
- **Preconditions:** A sends feedback; network tab open.
- **Test data:** None.
- **Steps:** 1. Inspect the request body. 2. Read the FAQ "How does Lumi use my data?". 3. Press "Terms of Service" and "Privacy Policy" on the register page.
- **Expected result:** Body holds only kind, module, part, message, image path and context (page, mode, version, screen, lang, user agent) plus name and e-mail added by the server; FAQ names Google Gemini or Groq; both links go nowhere (`#`) — fails NFR-PRV-006.
- **Automation:** Manual.

#### TC-NFR-021 — Traceability of admin and purchase records
- **Requirement:** NFR-OBS-001, NFR-OBS-002, NFR-OBS-004
- **Type / Priority:** Functional · P2
- **Preconditions:** Admin actions done; console open.
- **Test data:** None.
- **Steps:** 1. Compare the admin log and each person's purchase history for the same actions. 2. Break a request and read the console and function logs.
- **Expected result:** Trials, gifts, access, deactivation, roles, deletion in the admin log; every plan or add-on change in purchase history; failures logged as "LUMA: …" in the console and `console.error` in `send-push` and `account` logs.
- **Automation:** `pg_admin_test` (log) · Manual.

#### TC-NFR-022 — Maintainability: version and changelog
- **Requirement:** NFR-MNT-001, NFR-MNT-002, NFR-MNT-004, NFR-MNT-005
- **Type / Priority:** Functional · P3
- **Preconditions:** Repository.
- **Test data:** None.
- **Steps:** 1. Compare `LUMA_VERSION` with the top CHANGELOG entry. 2. Check each module folder has html, css, js and is listed in `boot.js`. 3. Run `run_all.sh`.
- **Expected result:** Versions match (0.26.4); modules registered; the suites pass.
- **Automation:** `run_all.sh` (all suites) · Manual.

#### TC-NFR-023 — Offline and unavailable service
- **Requirement:** NFR-AVL-004, NFR-AVL-007, NFR-AVL-002
- **Type / Priority:** Negative · P2
- **Preconditions:** Signed-in app.
- **Test data:** Switch the network off, change a theme, reopen.
- **Steps:** 1. Go offline and use the app. 2. Change theme. 3. Reload offline. 4. Go online and reload.
- **Expected result:** Existing screens keep working until a request is needed; the change shows the "Couldn't save that to your account" toast; reload offline fails (no cached app); after reconnecting the theme is saved.
- **Automation:** Manual.

#### TC-NFR-024 — Targets still to be defined
- **Requirement:** NFR-PRF-006, NFR-PRF-007, NFR-OBS-005, NFR-PRV-002
- **Type / Priority:** Performance · P3
- **Preconditions:** Test database with 1,000 people; Supabase dashboard.
- **Test data:** Reminder switched on for 10 people; export and delete done once.
- **Steps:** 1. Look at the minute jobs' query plans (they read only people with the feature on). 2. Check job run history and failures in `cron.job_run_details`. 3. Record page-load and push delivery times. 4. Confirm export and delete are both available to an ordinary person.
- **Expected result:** Jobs touch only people with the feature switched on; failures are visible in the job history (no alerting exists, TBC); no numeric performance target exists to compare against (TBC); export and delete work without an administrator.
- **Automation:** Manual.

## Findings

Numbered F-1 … F-n; "where" gives file and line (as of 0.26.4).

| # | Finding | Where | Severity |
|---|---|---|---|
| F-1 | **Support contact form sends nothing.** "Send message" clears the box and says "Thanks! Our team will reply…" but makes no request, so the person believes support was told. | `app/modules/support/support.js` lines 77-82 | High |
| F-2 | **Terms of Service and Privacy Policy links are dead** (`href="#"`), yet the account cannot be created without ticking them. | `register/index.html` line 50 | High |
| F-3 | **Export is incomplete and depends on the mode.** It reads through the mode filter (`LumaSpace`), so Work and Study items that are not shown in the current mode are missing; contacts, chat, Work projects, files and other data are not exported; text and FAQ say "your data". | `settings.js` 320-335, `shared/luma-space.js` | High |
| F-4 | **Plan changes by an administrator are not in the admin log.** `admin_set_plan`, `admin_set_addon` and `admin_set_plan_limit` do not call `admin_log` (migration 062 also dropped the `plan_changes` insert of 036). Only the person's purchase history records plan and add-on changes; limit changes are recorded nowhere. | 036, 062, 083, 082 | Medium |
| F-5 | **Plan features that are only checked in the browser:** `own_wallpaper`, `wallpapers`, `themes` (and `split`, payroll) are UI limits; the wallpaper bucket policy only checks the folder, so a Dawn person can upload a wallpaper through the API. | `settings.js`, 042 | Medium |
| F-6 | **Account deletion is not atomic and may leave files.** Files are removed first and the sign-in last (a failure leaves a live account without files); only the first 1000 files per folder are listed, and only 4 levels deep; the confirmation e-mail is compared with `profiles.email`, which the person can edit (the update policy has no check). | `supabase/functions/account/index.ts`, 001 | Medium |
| F-7 | **Feedback pictures are deleted with the account but the feedback is kept**, so the inbox shows "Open picture" for a file that no longer exists. | `account/index.ts` (BUCKETS includes luma-feedback), 081 | Low |
| F-8 | **Focus mode has no quiet hours**, only a type filter (reminder_ and budget_ pass). Plan-end warnings, gifts, busy-day alerts and weekly reviews are silenced too. The brief mentions quiet hours; the code has none. | `notifications.js` 142, `send-push/index.ts` | Medium (scope) |
| F-9 | **Badge and counts only cover the 200 newest notifications**, so a person with more than 200 unread sees a lower number. | `notifications.data.js` line 20 | Low |
| F-10 | **Server busy-day alert counts all events regardless of mode** (space) while the Calendar counts only the current mode, so the 6 pm push can say "busy" when the Personal calendar shows a light day. | 082 `busy_day_stats`, `core/busy.js` | Medium |
| F-11 | **Plan perks and FAQ are fixed text**; editing limits in Admin → Plan limits does not update the plans popup or FAQ. The client fallback `DAWN` says 2 wallpapers while the database says 4; it has no Work keys (the client then treats Work limits as unlimited; the database still enforces). | `core/plans.js` PLANS, `support.js`, `shared/luma-plan.js` line 11 | Low |
| F-12 | **The Study free trial is hidden only in the browser on production**; `start_addon_trial` accepts it anywhere. | `core/modes.js` line 130, 044 | Low |
| F-13 | **Gift preview date can differ from the real end** for end-of-month dates (browser `setMonth` versus database month interval). | `settings.js` `claimGift`, 069 | Low |
| F-14 | **Admin `bulk_grant` does not skip deactivated accounts** (bulk gift does); the admin list stops at 500 accounts (search is the only way to reach older ones). | 065, 062, `admin.js` | Low |
| F-15 | **Duplicate system notification possible:** when the tab is in the background and push is on, the page raises its own browser notification and the service worker shows the pushed one. Needs a device check (TBC). | `notifications.js` showNotifToast, `sw.js` | Low |
| F-16 | **Accessibility gaps:** bell and log-out icons are `span`s without role or tabindex (only search has them); supabase-js is loaded from a CDN with a floating `@2` and no integrity hash. | `core/shell.html` 144-147, `app/index.html` 52 | Low |
| F-17 | **Settings profile card writes the name without escaping** (`${lumaFullName()}`, `${lumaEmail()}` in template text), a possible HTML injection from the person's own name; other places use `escapeHtml`. | `settings.js` lines 21-23 | Low (self only; TBC) |
| F-18 | **Stale comments and documents:** `account/index.ts` header says self-delete is "not used by the app yet" although Settings uses it; `plan_expiry` comments say daily but the job is hourly; `CONVENTIONS.md` names migration 083 as the latest, the repository has 085. Purchase history does not show the Work size (Work Pro). | `account/index.ts` 4, 062, `purchases.js` | Info |
| F-19 | **Production still uses the staging database** while `PROD.url` is blank, and the version line does not flag it (it flags non-production hosts only). | `shared/supabase-config.js` | Info |
| F-20 | **No offline mode:** the service worker caches nothing (by design), so the app cannot open without a connection. Performance and availability targets are not defined anywhere (TBC). | `sw.js` | Info |

Test-automation coverage gaps found while writing these cases: no automated test calls `admin_set_plan`, `admin_set_addon` (except the Work size cases in `pg_busy_test`), `run_plan_expiry`, `run_weekly_review`, the other reminder jobs, `send-push`, the `account` function, the storage policies, or the login, register and verify pages (`reset_test` covers only the reset page; `edge/del_test.js` and `upd_test.js` test the Lumi function, not `account`).
