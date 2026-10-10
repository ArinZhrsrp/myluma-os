#!/bin/bash
# Runs every automated check (see README.md in this folder). Run from anywhere:  docs/test-automation/run_all.sh
# Needs: Node 18+, `npm install` once in this folder, and (for the phone-width audits) Google Chrome on macOS and Python 3.
# Set LUMA_ROOT if the project folder is not three levels above this file.
cd "$(dirname "$0")"
t() { perl -e 'alarm shift; exec @ARGV' "$@"; }   # timeout helper (macOS has no `timeout`)
echo "=== database: apply every migration"; t 200 node sql/pg_boot.js 2>&1 | tail -1
echo "=== database: rules"
for t in pg_work_test pg_phase_test pg_company_test pg_wfiles_test pg_time_test pg_wreminder_test pg_move_test pg_extras_test pg_feedback_test pg_study_test pg_split_test pg_admin_test pg_tasks_test pg_gift_test pg_refs_test pg_busy_test pg_team_test pg_auth_test pg_birthday_test; do printf "%-22s" "$t:"; t 250 node sql/$t.js 2>&1 | tail -1 | cut -c1-70; done
echo "=== user interface (jsdom)"
echo "--- work / feedback / busy-day / date picker (v49)"; t 150 node ui/v49_test.js 2>&1 | grep -E "TEST ERR|^errors" -A3 | head -6
echo "--- Google / Apple buttons (oauth_test)"; t 100 node ui/oauth_test.js 2>&1 | tail -3
echo "--- every page renders (v41)"; t 150 node ui/v41_test.js 2>&1 | tail -2
echo "=== edge functions: syntax"
for f in lumi account send-push; do printf "%-10s" "$f:"; "${ESBUILD:-./node_modules/.bin/esbuild}" "${LUMA_ROOT:-../..}/supabase/functions/$f/index.ts" --loader:.ts=ts --format=esm --outfile=/dev/null 2>&1 | tail -1; done
echo "=== phone-width audits (needs Chrome; serves the app on :8765)"
(node rig/serve.js >/dev/null 2>&1 &) ; sleep 1
(cd rig; node make_stub.js >/dev/null
for w in 320 360; do echo "--- pages at ${w}px"
  t 200 ./audit.sh $w "&mode=personal&pages=dashboard,calendar,reminders,tasks,money,subscriptions,bills,goals,habits,health,notes,documents,contacts,assistant,analytics,settings,support,feedback,notifications" | tr '\n' ' '; echo
  t 200 ./audit.sh $w "&mode=work&pages=work,company,calendar,documents,contacts" | tr '\n' ' '; echo
  t 200 ./audit.sh $w "&mode=study&pages=study,studyarchive,calendar,notes" | tr '\n' ' '; echo
  t 200 ./audit_modals.sh $w "&mode=work" | tail -1
done)
pkill -f "rig/serve.js" 2>/dev/null
echo DONE
