// Birthdays (migration 087): who is listed today / soon (in each person's own time zone), 29 February, privacy, the wish, the daily alert to administrators, the sign-up metadata.
const { boot } = require('./pg_boot.js'); let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  ✗', n, x || ''); } };
const id = (n) => `00000000-0000-0000-0000-00000000000${n}`; const [ADM, A, B, C, D, E, STR] = [1, 2, 3, 4, 5, 6, 7].map(id);
(async () => {
  const { db, problems } = await boot({ verbose: false }); ok('migrations apply', problems.length === 0, JSON.stringify(problems).slice(0, 300));
  const sup = async (q, p) => { await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)"); return db.query(q, p); };
  const as = async (u, q, p) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`); try { return await db.query(q, p); } finally { await db.exec('reset role'); } };
  const err = async (u, q, p) => { try { await as(u, q, p); return null; } catch (e) { return e.message; } };
  for (const [i, e] of [ADM, A, B, C, D, E, STR].map((u, i) => [u, 'u' + i])) await sup('insert into auth.users (id,email) values ($1,$2)', [i, e + '@x.com']);
  await sup(`insert into luma.admin_users (user_id) values ($1)`, [ADM]);
  // a birthday N days from today (in the person's own time zone), for someone who is 25 on it
  const bday = async (u, n, years = 25) => sup(`update luma.profiles set birthday = ((timezone(luma.user_tz(id), now()))::date + $2::int) - make_interval(years => $3::int) where id=$1`, [u, n, years]);
  await sup(`update luma.profiles set first_name='Aina' where id=$1`, [A]); await bday(A, 0);
  await sup(`update luma.profiles set first_name='Ben' where id=$1`, [B]); await bday(B, 3);
  await sup(`update luma.profiles set first_name='Cho' where id=$1`, [C]); await bday(C, 20);
  await sup(`update luma.profiles set first_name='Dewi' where id=$1`, [D]); await bday(D, -1);      // yesterday: next one is in about a year
  let r = await as(ADM, `select * from luma.admin_birthdays(30)`);
  ok('today, in 3 days and in 20 days are listed, in order', r.rows.map((x) => x.first_name).join() === 'Aina,Ben,Cho', r.rows.map((x) => x.first_name).join());
  ok('days until and the age they turn', r.rows[0].days_until === 0 && r.rows[0].turning === 25 && r.rows[1].days_until === 3 && r.rows[2].days_until === 20, JSON.stringify(r.rows.map((x) => [x.days_until, x.turning])));
  ok('yesterday\'s birthday is not in the next 30 days', !r.rows.some((x) => x.first_name === 'Dewi'));
  r = await as(ADM, `select * from luma.admin_birthdays(7)`); ok('a shorter window lists fewer people', r.rows.length === 2, String(r.rows.length));
  r = await as(ADM, `select * from luma.admin_birthdays(366)`); ok('a year ahead lists everyone with a birthday saved (Dewi next year)', r.rows.length === 4 && r.rows[3].first_name === 'Dewi' && r.rows[3].days_until >= 360, JSON.stringify(r.rows.map((x) => x.days_until)));
  ok('no birthday saved → not listed (Eka)', !r.rows.some((x) => x.id === E));
  await sup(`update luma.profiles set disabled_at = now() where id=$1`, [C]); r = await as(ADM, `select * from luma.admin_birthdays(30)`); ok('a deactivated account is left out', !r.rows.some((x) => x.first_name === 'Cho'));
  await sup(`update luma.profiles set disabled_at = null where id=$1`, [C]);
  // time zones: the same instant is "today" for one person and "tomorrow" for another
  await sup(`update luma.profiles set timezone='Pacific/Kiritimati' where id=$1`, [A]); await sup(`update luma.profiles set timezone='Etc/GMT+12' where id=$1`, [B]);
  await bday(A, 0); await bday(B, 0);
  r = await as(ADM, `select first_name, days_until from luma.admin_birthdays(1) where id in ($1,$2) order by first_name`, [A, B]); ok('each person\'s own "today" (UTC+14 and UTC-12 are both 0)', r.rows.length === 2 && r.rows.every((x) => x.days_until === 0), JSON.stringify(r.rows));
  await sup(`update luma.profiles set timezone=null where id in ($1,$2)`, [A, B]); await bday(A, 0); await bday(B, 3);
  // 29 February
  r = await sup(`select luma.bday_in_year(date '2000-02-29', 2027) a, luma.bday_in_year(date '2000-02-29', 2028) b, luma.bday_in_year(date '2000-02-29', 2100) c, luma.bday_in_year(date '1999-03-05', 2027) d`);
  ok('29 February: 28 Feb in 2027, 29 Feb in 2028, 28 Feb in 2100 (not a leap year), others unchanged', String(r.rows[0].a.toISOString ? r.rows[0].a.toISOString().slice(0, 10) : r.rows[0].a) === '2027-02-28' && String(r.rows[0].b.toISOString().slice(0, 10)) === '2028-02-29' && String(r.rows[0].c.toISOString().slice(0, 10)) === '2100-02-28' && String(r.rows[0].d.toISOString().slice(0, 10)) === '2027-03-05', JSON.stringify(r.rows[0]));
  // who may call
  let e = await err(A, `select * from luma.admin_birthdays(30)`); ok('a normal person cannot list birthdays', !!e && /Not allowed/.test(e), e);
  e = await err(A, `select * from luma.birthday_rows(30)`); ok('the inner function is not callable by people', !!e, e);
  r = await as(STR, `select count(*)::int n from luma.profiles where id <> $1`, [STR]); ok('other people cannot read anyone else\'s profile (so not their birthday)', r.rows[0].n === 0);
  await as(E, `update luma.profiles set birthday = date '1990-05-17' where id = $1`, [E]); r = await sup(`select birthday::text b from luma.profiles where id=$1`, [E]); ok('a person can save their own birthday', r.rows[0].b === '1990-05-17');
  e = await err(E, `update luma.profiles set birthday = date '1850-01-01' where id = $1`, [E]); ok('a birthday before 1900 is refused', !!e, e);
  // the wish
  e = await err(A, `select luma.admin_birthday_wish($1,'hi')`, [B]); ok('only an administrator can send a wish', !!e && /Not allowed/.test(e), e);
  await as(ADM, `select luma.admin_birthday_wish($1,'Have a great day!')`, [A]);
  r = await sup(`select title, body, link from luma.notifications where user_id=$1 and type='birthday'`, [A]); ok('the person gets "Happy birthday, Aina!" with the admin\'s message', r.rows.length === 1 && /Happy birthday, Aina!/.test(r.rows[0].title) && r.rows[0].body === 'Have a great day!', JSON.stringify(r.rows));
  r = await sup(`select count(*)::int n from luma.admin_audit where action='birthday_wish' and target_user=$1`, [A]); ok('the wish is written to the admin log', r.rows[0].n === 1);
  e = await err(ADM, `select luma.admin_birthday_wish($1,'')`, [A]); ok('a second wish the same day is refused', !!e && /already sent/.test(e), e);
  r = await as(ADM, `select wished_on from luma.admin_birthdays(1) where id=$1`, [A]); ok('the list shows who was already wished', !!r.rows[0].wished_on);
  await as(ADM, `select luma.admin_birthday_wish($1,'')`, [B]); r = await sup(`select body from luma.notifications where user_id=$1 and type='birthday'`, [B]); ok('no message → a kind default text', /Wishing you a wonderful year/.test(r.rows[0].body));
  e = await err(ADM, `select luma.admin_birthday_wish($1,'')`, [STR]); ok('a person without a birthday cannot be wished', !!e && /no birthday/.test(e), e);
  // the daily alert to administrators (9 am in the administrator's time zone)
  const h = (await sup(`select extract(hour from now() at time zone 'UTC')::int h`)).rows[0].h; let off = ((9 - h) % 24 + 24) % 24; if (off > 14) off -= 24;
  const tz = off === 0 ? 'Etc/UTC' : (off > 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`);
  await sup(`update luma.profiles set timezone=$2 where id=$1`, [ADM, tz]); await sup(`delete from luma.notifications where type in ('admin_birthday','birthday')`);
  await bday(A, 0); await bday(B, 3); await bday(C, 40);
  r = await sup(`select luma.run_birthday_alerts() n`); ok('at 9 am the administrator is told, once', r.rows[0].n === 1, JSON.stringify(r.rows));
  r = await sup(`select title, body, link from luma.notifications where user_id=$1 and type='admin_birthday'`, [ADM]); ok('"1 birthday today", names who is today and who is coming up, opens Admin', r.rows.length === 1 && /1 birthday today/.test(r.rows[0].title) && /Today: Aina/.test(r.rows[0].body) && /Ben \(in 3 days\)/.test(r.rows[0].body) && r.rows[0].link === 'admin' && !/Cho/.test(r.rows[0].body), JSON.stringify(r.rows));
  r = await sup(`select luma.run_birthday_alerts() n`); ok('not twice in a day', r.rows[0].n === 0);
  await sup(`delete from luma.notifications where type='admin_birthday'`); await bday(A, 10); await bday(B, 12); await bday(D, 15);
  r = await sup(`select luma.run_birthday_alerts() n`); ok('nobody today or this week → no alert', r.rows[0].n === 0);
  await bday(B, 2); r = await sup(`select luma.run_birthday_alerts() n`); r = await sup(`select title from luma.notifications where user_id=$1 and type='admin_birthday'`, [ADM]); ok('only upcoming birthdays → "Birthdays coming up"', r.rows.length === 1 && /coming up/.test(r.rows[0].title), JSON.stringify(r.rows));
  await sup(`delete from luma.notifications where type='admin_birthday'`); await sup(`update luma.profiles set timezone=$2 where id=$1`, [ADM, off === 0 ? 'Etc/GMT-3' : 'Etc/UTC']); await bday(A, 0);
  r = await sup(`select luma.run_birthday_alerts() n`); ok('only at 9 am local', r.rows[0].n === 0 || h === 9);
  // a birthday typed on the sign-up form
  const mk = async (n, meta) => { await sup('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)', [`00000000-0000-0000-0000-00000000010${n}`, `m${n}@x.com`, JSON.stringify(meta)]); return (await sup(`select birthday::text b from luma.profiles where id=$1`, [`00000000-0000-0000-0000-00000000010${n}`])).rows[0].b; };
  ok('sign-up form birthday is saved', (await mk(1, { birthday: '1995-03-02' })) === '1995-03-02');
  ok('an invalid date is ignored, the account is still made', (await mk(2, { birthday: 'soon' })) === null);
  ok('a future date is ignored', (await mk(3, { birthday: '2099-01-01' })) === null);
  ok('no birthday: empty', (await mk(4, { first_name: 'Z' })) === null);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR', e.stack.split('\n').slice(0, 4).join(' | ')); process.exit(2); });
