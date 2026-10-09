const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'), path = require('path');
const DIR = ROOTDIR+'supabase/migrations';
const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), banned_until timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz default now(), phone text);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;
`;
async function boot({ verbose = true, upTo = 999 } = {}) {
  const db = new PGlite(); await db.exec(STUBS);
  const files = fs.readdirSync(DIR).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  const problems = [];
  for (const f of files) {
    const n = parseInt(f, 10); if (n > upTo) break;
    try { await db.exec(fs.readFileSync(path.join(DIR, f), 'utf8')); }
    catch (e) { problems.push([f, e.message]); }
  }
  if (verbose) { console.log('applied', files.length, 'migration files;', problems.length, 'with errors'); problems.forEach(([f, m]) => console.log('  ✗', f, '→', m.slice(0, 260))); }
  return { db, problems };
}
module.exports = { boot };
if (require.main === module) boot().then(() => process.exit(0));
