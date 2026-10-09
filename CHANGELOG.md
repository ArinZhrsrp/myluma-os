# LUMA changelog

The newest version is on top. The version number lives in `shared/supabase-config.js` (`window.LUMA_VERSION`) and is shown under "Your Personal OS" in the sidebar and on the login and register pages.
Rules: **patch** (0.9.1) = fixes and small tweaks · **minor** (0.10.0) = a new feature or module · **1.0.0** = the first production release.
Versions before 0.9.0 were written down afterwards from the commit history, so their grouping is approximate.

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
