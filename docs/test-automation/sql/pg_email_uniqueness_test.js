// Production setup is deliberately separate from migrations used by staging.
const { boot } = require('./pg_boot.js');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const setup = fs.readFileSync(path.resolve(__dirname, '../../../supabase/setup/production_email_uniqueness.sql'), 'utf8');

(async () => {
  const { db, problems } = await boot({ verbose: false });
  assert.deepEqual(problems, []);
  const insert = email => db.query('insert into auth.users (email) values ($1) returning id', [email]);
  const base = 'shiwwinzahra@gmail.com';
  const alias = 'shiwwinzahra+luma@gmail.com';
  await insert(base);
  await insert(alias); // Staging remains unrestricted.
  await assert.rejects(db.exec(setup), /unique|duplicat/i);
  await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 2);
  await db.query('delete from auth.users where email = $1', [alias]);
  await db.exec(setup);
  await db.exec(setup); // Safe to rerun.
  for (const email of [base, alias, 'shiwwin.zahra@gmail.com', 'SHIWWINZAHRA+OTHER@GMAIL.COM', 'shiwwinzahra@googlemail.com']) {
    await assert.rejects(insert(email), e => e.code === '23505');
  }
  const other = (await insert('different@gmail.com')).rows[0].id;
  await assert.rejects(db.query('update auth.users set email=$1 where id=$2', [alias, other]), e => e.code === '23505');
  await insert('first+tag@example.com');
  await insert('first@example.com');
  await insert('f.irst@example.com'); // Do not assume Gmail rules for other domains.
  await insert('new.person+tag@gmail.com');
  assert.equal((await db.query('select email from auth.users where email=$1', ['new.person+tag@gmail.com'])).rows[0].email, 'new.person+tag@gmail.com');
  await assert.rejects(insert('newperson@gmail.com'), e => e.code === '23505');
  assert.equal((await db.query('select email from auth.users where email=$1', [base])).rows[0].email, base);
  await db.close();
  console.log('Production mailbox uniqueness passed: staging aliases, existing duplicates, rerun, Gmail variants, email changes, other domains and original delivery addresses.');
})().catch(e => { console.error(e); process.exit(1); });
