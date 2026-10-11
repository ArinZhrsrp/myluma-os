# LUMA user-manual website

A buildless, responsive user guide maintained only on `documentations`.
The guide covers application v0.30.4 (application commit `8c0e122`), with 29
articles and 40 screenshots captured from actual application screens using
fictional fixture data. No live user account or database was used.

## Preview

From the repository root:

```sh
python3 -m http.server 8772 --directory user-manual
```

Open http://localhost:8772. No Node dependencies or build step are needed to serve
the manual. `vercel.json` on this branch publishes `user-manual/` as its static
output. Application branches retain their separate Vercel configuration.
Do not merge this branch into an application branch.

## Maintain

- `guides.js`: guide titles, navigation groups, location instructions, steps, tips,
  related guides and screenshot galleries.
- `manual.js`: routing, search, article rendering, screenshot viewer and print.
- `style.css`: responsive layout and print styles.
- `assets/screenshots/`: application screenshots, not generated mockups.
- `tools/`: screenshot fixture server, capture script and browser checks.

The screenshots intentionally show sample records and the STAGING version label.
They are examples, not a representation of a reader's own account. Limits and
prices that administrators can change are referred to the current in-app plan
comparison. The article about Support documents the current non-sending contact
form and points readers to email/WhatsApp instead.

Google Fonts is optional: the stylesheet falls back to local sans-serif fonts
if it cannot load. The manual itself does not require sign-in or call Supabase.
The Open LUMA link opens the live application in a separate tab.

## Refresh screenshots

Keep the application checkout separate from the documentation checkout so the
screenshots can use current code without merging application changes here.
The capture script uses installed Google Chrome and `playwright-core`:

```sh
npm install --prefix /tmp/luma-manual-tools --no-package-lock playwright-core
# Substitute a new temporary path if this worktree already exists.
git worktree add --detach /tmp/luma-manual-app origin/staging
LUMA_ROOT=/tmp/luma-manual-app node user-manual/tools/preview-app.cjs
# In a second terminal:
node user-manual/tools/capture.cjs
```

Set `CHROME_PATH` or `PLAYWRIGHT_CORE` if your local executable or package path
is different. The fixture server listens only on 127.0.0.1:8771 and supplies sample
data; the capture script blocks Supabase requests. Stop the fixture server after
capturing. Review every screenshot, update version/source metadata in the capture
script and website, and review the guide text before committing.

Browser checks (with the manual preview server running):

```sh
node user-manual/tools/check.cjs
```

Captures wait for application initialisation, navigate to the requested page, and
verify its active page ID, heading and tab before saving. The capture manifest
records all 40 page states and image hashes; duplicate images or browser errors
fail capture. Authentication screens use local session fixtures.

The checks verify the screenshot hashes and page/tab identities as well as all
guide routes, screenshot loading, guide links, search, image
viewer, mobile navigation and horizontal overflow. Screenshots and code review
do not replace end-to-end tests against a deployed application's services.
