# Documentation conventions

These rules keep the requirements (SRS), the design (SDD) and the test cases consistent, so they can be traced to each other.

## 1. Product facts every document must respect

- **LUMA** is a personal operating system: plain HTML / CSS / classic `<script>` JavaScript (no build step, no framework), Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), hosted on Vercel, installable as a PWA, with Web Push.
- **Three modes ("spaces")**: **Personal**, **Work** (add-on), **Study** (add-on). What a person creates in Work or Study stays in that mode (`space` column, migration 050). In Personal mode, "Show Work in Personal" / "Show Study in Personal" (Settings → Preferences) also show those items.
- **Plans**: Dawn (free), Glow (RM9 / month), Zenith (RM19 / month). Limits live in `luma.plan_limits`.
- **Add-ons**: Study (RM7 / month), Work (RM15 / month) and **Work Pro** (RM25 / month; migration 083). Bundle Work + Study RM19 / month. The Work add-on sets the Work limits (companies, projects, people on a project, tasks in a project, teams), not the plan. Add-ons are granted by an administrator after a WhatsApp request, or started as a one-time 7-day free trial.
- **Database schema** is `luma`; migrations are `supabase/migrations/NNN_*.sql` (001 … latest) and `supabase/ALL_MIGRATIONS.sql`.
- **Edge Functions**: `lumi` (AI assistant, tools), `account` (export / delete account), `send-push` (Web Push).
- The truth is the code, the migrations and `CHANGELOG.md`. If something is not in them, write "TBC" (to be confirmed); never invent behaviour. If the code and an older document disagree, the code wins, and the disagreement goes in the "Findings" section of your file.

## 2. Identifiers

| Kind | Format | Example |
|---|---|---|
| Functional requirement | `FR-<AREA>-<NNN>` (three digits, starting at 001, no gaps) | `FR-WRK-014` |
| Non-functional requirement | `NFR-<AREA>-<NNN>` | `NFR-SEC-003` |
| Test case | `TC-<AREA>-<NNN>` | `TC-WRK-031` |

`<AREA>` is a short upper-case code owned by one document set (listed in the brief for each area). A test case's area code is the same as the requirement it checks.

## 3. Requirement format (SRS)

Each functional requirement is one line in a table, grouped under a heading per feature:

```
| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-WRK-014 | The system shall … (one testable statement, present tense, "shall") | Must | work.js, migration 073 |
```

- Priority: **Must** (core / breaks the product without it), **Should**, **Could**.
- "Source" names the file(s) or migration(s) that implement it, so a reader can verify.
- Put business rules, limits and plan / role restrictions in their own requirements (do not hide them inside prose).
- After the table of a feature, add short "Notes" only when something is non-obvious (edge cases, error messages that are shown to people).

## 4. Test case format

Every test case is a block like this (the traceability script reads the `Requirement` line, so keep the labels exactly):

```
#### TC-WRK-031 — Create a project with six phases
- **Requirement:** FR-WRK-014, FR-WRK-015
- **Type / Priority:** Functional · P1
- **Preconditions:** Signed in with the Work add-on; at least one company.
- **Test data:** Project name "Website redesign".
- **Steps:**
  1. Open Work → Projects → New project.
  2. Choose type "Project (phases)" and enter the name.
  3. Press Save project.
- **Expected result:** The project appears in the list; its board has the six phases Planning, Requirement study, Design, Development, Testing, Deployment.
- **Automation:** `pg_phase_test` (checks 1–4) · otherwise manual.
```

- **Type** is one of: Functional, Negative, Boundary, Security, Responsive, Usability, Integration, Data, Performance, Compatibility.
- **Priority**: P1 (must pass before release), P2, P3.
- **Automation**: say which automated suite covers it, or "Manual", or "Device only" (needs a real phone / second device). The automated suites are described in `docs/test-automation/README.md`; read the test files there to find out what they really check.
- Write steps a tester who has never seen LUMA can follow: exact menu names, button labels and the visible result. Include the data to type.
- Cover, for every feature: the normal path, an empty state, invalid input, boundary values (limits), a permission / plan / role restriction, and a phone-width check where the layout matters. Add a security test wherever there is an access rule (who may read / change what).
- Group the test cases under one heading per feature, in the same order as the SRS.
- End each test-case file with a **Findings** section: bugs, gaps, contradictions or doubtful behaviour you noticed while reading the code (with file / line). If none, write "None found."

## 5. Style

- English, plain wording, short sentences. UK spelling is fine (the app uses "colour").
- Use the exact labels the app shows (buttons, tabs, menu names). Prices are written `RM15 / month`.
- Markdown only; tables for lists of facts, blocks for test cases, Mermaid fenced blocks (```mermaid) for diagrams.
- Do not paste large code. Refer to files as `app/modules/work/work.js`.
