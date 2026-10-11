// A new account made with Google or Apple (or the sign-up form) gets the right name in luma.profiles (migration 086).
const { boot } = require('./pg_boot.js'); let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  ✗', n, x || ''); } };
(async () => {
  const { db, problems } = await boot({ verbose: false }); ok('migrations apply', problems.length === 0, JSON.stringify(problems).slice(0, 300));
  const mk = async (id, email, meta) => { await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3::jsonb)', [id, email, JSON.stringify(meta)]); return (await db.query('select first_name, last_name, email, country, timezone from luma.profiles where id=$1', [id])).rows[0]; };
  const id = (n) => `00000000-0000-0000-0000-00000000000${n}`;
  let p = await mk(id(1), 'form@x.com', { first_name: 'Aina', last_name: 'Rahman', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' });
  ok('the sign-up form: names, country and time zone as typed', p.first_name === 'Aina' && p.last_name === 'Rahman' && p.country === 'Malaysia' && p.timezone === 'Asia/Kuala_Lumpur', JSON.stringify(p));
  p = await mk(id(2), 'g@x.com', { given_name: 'Ben', family_name: 'Lee', full_name: 'Ben Lee', name: 'Ben Lee', picture: 'https://x/y.png' });
  ok('Google: given_name / family_name', p.first_name === 'Ben' && p.last_name === 'Lee' && p.country === null && p.timezone === null, JSON.stringify(p));
  p = await mk(id(3), 'a@x.com', { full_name: 'Cho Min Jae' });
  ok('Apple / Google with only a full name: split at the first space', p.first_name === 'Cho' && p.last_name === 'Min Jae', JSON.stringify(p));
  p = await mk(id(4), 'one@x.com', { name: 'Dewi' });
  ok('a single name: no last name', p.first_name === 'Dewi' && p.last_name === null, JSON.stringify(p));
  p = await mk(id(5), 'none@privaterelay.appleid.com', {});
  ok('Apple sent no name (only the first sign-in carries it): empty names, the account still exists', p.first_name === null && p.last_name === null && p.email === 'none@privaterelay.appleid.com', JSON.stringify(p));
  p = await mk(id(6), 'both@x.com', { first_name: 'Eka', given_name: 'Other', full_name: 'Other Name' });
  ok('the sign-up form wins over provider fields', p.first_name === 'Eka', JSON.stringify(p));
  p = await mk(id(7), 'sp@x.com', { full_name: '  Fatimah   Zahra  ' });
  ok('extra spaces are tidied', p.first_name === 'Fatimah' && p.last_name === 'Zahra', JSON.stringify(p));
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR', e.stack.split('\n').slice(0, 4).join(' | ')); process.exit(2); });
