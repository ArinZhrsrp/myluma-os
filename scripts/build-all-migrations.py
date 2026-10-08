#!/usr/bin/env python3
"""Rebuilds supabase/ALL_MIGRATIONS.sql (every migration in one file, for a brand-new project).
Run after you add a migration:  python3 scripts/build-all-migrations.py"""
import glob, os
files = sorted(glob.glob("supabase/migrations/*.sql"))
out = ["-- ============================================================\n-- LUMA — ALL MIGRATIONS in one file, for a brand-new Supabase project.\n-- Generated from supabase/migrations (in order). Turn on the pg_cron extension first\n-- (Database → Extensions), then paste this whole file into the SQL Editor and run it.\n-- Safe to run again. Regenerate with: python3 scripts/build-all-migrations.py\n-- ============================================================\n"]
for f in files:
    out.append("\n\n-- ################################################################\n-- " + os.path.basename(f) + "\n-- ################################################################\n\n" + open(f).read())
open("supabase/ALL_MIGRATIONS.sql", "w").write("".join(out))
print(len(files), "migrations written to supabase/ALL_MIGRATIONS.sql")
