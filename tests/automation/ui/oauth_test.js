// Google / Apple buttons on the Login and Register pages: Apple only on Apple devices, the right Supabase call, the Terms box, and what the page says when the person comes back.
const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');
const { JSDOM } = require('jsdom'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  ✗', n, x || ''); } };
const UA = { windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36', android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1', ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(which, ua, query, o) {
  o = o || {};
  const html = fs.readFileSync(ROOTDIR + which + '/index.html', 'utf8').replace(/<script[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(html, { url: 'https://luma.test/' + which + '/' + (query || ''), userAgent: ua, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; Object.defineProperty(w.navigator, 'userAgent', { get: () => ua }); Object.defineProperty(w.navigator, 'platform', { get: () => '' });
  Object.assign(w, { __oauth: [], __inv: [], __upd: [], __go: [], __out: 0, __session: o.session || null }); w.fetch = () => Promise.resolve({ ok: true });
  w.supabase = { createClient: () => ({
    auth: { signInWithOAuth: async (a) => { w.__oauth.push(a); return { error: null }; }, getSession: async () => ({ data: { session: w.__session } }), signOut: async () => { w.__out++; return {}; }, updateUser: async (x) => { w.__upd.push(x); return {}; } },
    functions: { invoke: async (n, b) => { w.__inv.push([n, b]); return {}; } }, schema: () => ({}) }) };
  w.LUMA_SUPABASE_URL = 'https://x.supabase.co'; w.LUMA_SUPABASE_ANON_KEY = 'k';
  if (o.intent) w.localStorage.setItem('luma.oauth_intent', JSON.stringify({ intent: o.intent, provider: 'google', ts: o.ts || Date.now() }));
  w.eval(fs.readFileSync(ROOTDIR + 'shared/luma-auth.js', 'utf8')); w.LumaAuth.go = (u) => w.__go.push(u);
  w.eval(fs.readFileSync(ROOTDIR + which + '/' + which + '.js', 'utf8'));
  await wait(80); return w;
}
const sess = (o) => ({ user: Object.assign({ id: 'u1', email: 'new@x.com', created_at: new Date().toISOString(), user_metadata: {}, app_metadata: { provider: 'google' } }, o || {}) });
(async () => {
  for (const [name, ua, apple] of [['Windows', UA.windows, false], ['Android', UA.android, false], ['iPhone', UA.iphone, true], ['iPad (reports Macintosh)', UA.ipad, true], ['Mac', UA.mac, true]]) {
    const w = await page('login', ua); const b = w.document.querySelector('[data-oauth=apple]');
    ok(`Apple button ${apple ? 'shown' : 'hidden'} on ${name}`, !!b && b.hidden === !apple, String(b && b.hidden));
    ok(`Google button always shown on ${name}`, !w.document.querySelector('[data-oauth=google]').hidden);
  }
  let w = await page('login', UA.mac);
  w.document.querySelector('[data-oauth=google]').click(); await wait(30);
  ok('Login → Google calls Supabase with provider google and comes back to /login/', w.__oauth.length === 1 && w.__oauth[0].provider === 'google' && w.__oauth[0].options.redirectTo === 'https://luma.test/login/', JSON.stringify(w.__oauth));
  ok('Google asks which account to use', w.__oauth[0].options.queryParams && w.__oauth[0].options.queryParams.prompt === 'select_account');
  ok('"Remember me" is on for a provider sign-in', w.localStorage.getItem('luma.remember') === '1');
  w.document.querySelector('[data-oauth=apple]').click(); await wait(30);
  ok('Login → Apple asks for name and e-mail', w.__oauth.length === 2 && w.__oauth[1].provider === 'apple' && w.__oauth[1].options.scopes === 'name email', JSON.stringify(w.__oauth[1]));
  ok('buttons are not the old "coming soon" stubs', !w.document.body.innerHTML.includes('_comingSoon'));
  w = await page('login', UA.mac, '?error=access_denied&error_description=Provider+said+no');
  ok('coming back with an error shows it', /Provider said no/.test(w.document.getElementById('formError').textContent) && w.document.getElementById('formError').style.display === 'flex', w.document.getElementById('formError').textContent);
  w = await page('login', UA.mac, '?code=abc123');
  ok('coming back with a code says "Signing you in…"', /Signing you in/.test(w.document.getElementById('formOk').textContent), w.document.getElementById('formOk').textContent);
  w = await page('register', UA.iphone);
  w.document.querySelector('[data-oauth=google]').click(); await wait(30);
  ok('Register → Google without the Terms box ticked: nothing starts, a message is shown', w.__oauth.length === 0 && /Tick the box/.test(w.document.getElementById('formError').textContent), w.document.getElementById('formError').textContent);
  w.document.getElementById('agree').checked = true; w.document.getElementById('agree').dispatchEvent(new w.Event('change'));
  w.document.querySelector('[data-oauth=apple]').click(); await wait(30);
  ok('Register → Apple with the box ticked starts the sign-in', w.__oauth.length === 1 && w.__oauth[0].provider === 'apple', JSON.stringify(w.__oauth));
  w = await page('register', UA.windows);
  ok('Register on Windows: no Apple button', w.document.querySelector('[data-oauth=apple]').hidden === true);
  // ---- coming back from the provider: Login never makes an account
  w = await page('login', UA.mac, '?code=abc', { session: sess(), intent: 'login' });
  ok('Login → a brand-new Google ID: the account that was just made is deleted again', w.__inv.length === 1 && w.__inv[0][0] === 'account' && w.__inv[0][1].body.action === 'delete' && w.__inv[0][1].body.confirm === 'new@x.com', JSON.stringify(w.__inv));
  ok('… the person is signed out, is not sent into the app, and is told to use "Create one"', w.__out === 1 && w.__go.length === 0 && /Create one/.test(w.document.getElementById('formError').textContent) && /Google/.test(w.document.getElementById('formError').textContent), w.document.getElementById('formError').textContent);
  w = await page('login', UA.iphone, '?code=abc', { session: sess({ app_metadata: { provider: 'apple' } }), intent: 'login' });
  ok('Login → a brand-new Apple ID says Apple', /Apple/.test(w.document.getElementById('formError').textContent), w.document.getElementById('formError').textContent);
  w = await page('login', UA.mac, '?code=abc', { session: sess(), intent: 'register' });
  ok('Register → Google: the account is kept, marked registered, and the app opens', w.__inv.length === 0 && w.__upd.length === 1 && w.__upd[0].data.registered === true && w.__go[0] === '/app/', JSON.stringify([w.__inv, w.__upd, w.__go]));
  w = await page('login', UA.mac, '?code=abc', { session: sess({ created_at: new Date(Date.now() - 30 * 864e5).toISOString() }), intent: 'login' });
  ok('Login → an existing account (made long ago) goes straight in', w.__inv.length === 0 && w.__out === 0 && w.__go[0] === '/app/');
  w = await page('login', UA.mac, '?code=abc', { session: sess({ user_metadata: { registered: true } }), intent: 'login' });
  ok('Login → an account already marked registered goes in, even if recent', w.__inv.length === 0 && w.__go[0] === '/app/');
  w = await page('login', UA.mac, '?code=abc', { session: sess({ app_metadata: { provider: 'email' } }), intent: 'login' });
  ok('an e-mail account is never touched by this rule', w.__inv.length === 0 && w.__go[0] === '/app/');
  w = await page('login', UA.mac, '?code=abc', { session: sess(), intent: 'register', ts: Date.now() - 20 * 60 * 1000 });
  ok('a register intent older than 15 minutes is forgotten: treated as a Login (strict)', w.__inv.length === 1 && w.__upd.length === 0);
  w = await page('login', UA.mac, '?code=abc', { session: sess() });
  ok('no remembered intent: treated as a Login (strict)', w.__inv.length === 1);
  w = await page('login', UA.mac, '', { session: sess({ created_at: new Date(Date.now() - 30 * 864e5).toISOString(), app_metadata: { provider: 'email' } }) });
  ok('an ordinary visit to /login/ while signed in still goes to the app', w.__go[0] === '/app/');
  w = await page('login', UA.mac); w.document.querySelector('[data-oauth=google]').click(); await wait(30);
  ok('the Login buttons remember "login"; the Register buttons remember "register"', JSON.parse(w.localStorage.getItem('luma.oauth_intent')).intent === 'login');
  w = await page('register', UA.mac); w.document.getElementById('agree').checked = true; w.document.querySelector('[data-oauth=google]').click(); await wait(30);
  ok('Register remembers "register"', JSON.parse(w.localStorage.getItem('luma.oauth_intent')).intent === 'register');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR', e.stack.split('\n').slice(0, 5).join(' | ')); process.exit(2); });
