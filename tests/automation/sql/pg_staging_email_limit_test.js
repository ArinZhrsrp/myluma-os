const { boot } = require('./pg_boot.js');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const read = name => fs.readFileSync(path.resolve(__dirname, '../../../supabase/setup', name), 'utf8');
const setup = read('staging_email_limit.sql');
(async () => {
  const { db, problems } = await boot({ verbose: false });
  assert.deepEqual(problems, []);
  const add = async email => (await db.query('insert into auth.users (email) values ($1) returning id', [email])).rows[0].id;
  const remove = id => db.query('delete from auth.users where id=$1', [id]);
  const base = await add('shiwwinzahra@gmail.com');
  await add('shiwwinzahra+one@gmail.com');
  await add('shiwwinzahra+two@gmail.com');
  const excess = await add('shiwwinzahra+three@gmail.com');
  await assert.rejects(db.exec(setup), e => e.code === '23514');
  await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 4);
  await remove(excess);
  await db.exec(setup);
  await db.exec(setup);
  for (const email of ['shiwwinzahra+three@gmail.com', 'shiwwin.zahra@gmail.com', 'SHIWWINZAHRA+FOUR@GOOGLEMAIL.COM']) {
    await assert.rejects(add(email), e => e.code === '23505');
  }
  const other = await add('other+one@gmail.com');
  await assert.rejects(db.query('update auth.users set email=$1 where id=$2', ['shiwwinzahra+four@gmail.com', other]), e => e.code === '23505');
  // A failed email change retains the source mailbox slot.
  assert.equal((await db.query('select mailbox from luma.staging_email_slots where user_id=$1', [other])).rows[0].mailbox, 'other@gmail.com');
  await db.query('update auth.users set email=$1 where id=$2', ['shiwwin.zahra+renamed@googlemail.com', base]);
  await remove(base);
  const replacement = await add('shiwwinzahra+replacement@gmail.com');
  await assert.rejects(add('shiwwinzahra+extra@gmail.com'), e => e.code === '23505');
  await db.query('update auth.users set email=$1 where id=$2', ['moved@example.com', replacement]);
  await add('shiwwinzahra@gmail.com');
  for (let i = 0; i < 4; i++) await add(`person+${i}@example.com`);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('delete from luma.staging_email_slots'), e => e.code === '42501');
  await db.exec('reset role');
  // A staging setup must not loosen or coexist with production's stricter rule.
  await db.query("delete from auth.users where luma.registration_mailbox(email) = 'shiwwinzahra@gmail.com'");
  await db.exec(read('production_email_uniqueness.sql'));
  await assert.rejects(db.exec(setup), /Production mailbox uniqueness is installed/);
  await db.exec('rollback');
  await db.close();
  console.log('Staging email limit passed: three total, aliases, existing accounts, reruns, updates, deletion, other providers, permissions and production guard.');
})().catch(e => { console.error(e); process.exit(1); });
