const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
// Loads LUMA (old single file or new folders), walks every page, and records a signature: errors + computed styles.
process.on("unhandledRejection", () => {});
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = ROOTDIR+'';
const mode = process.argv[2], out = process.argv[3];

const today = new Date().toISOString().slice(0, 10), iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const session = { user: { id: 'u1', email: 'a@b.c', user_metadata: { full_name: 'Test User' } } };
const T = {
  tasks: [{ id: 't1', title: 'Pay rent', status: 'todo', priority: 'high', tag: 'Personal', due_date: iso(-1), notes: 'ask landlord', created_at: new Date().toISOString() }, { id: 't2', title: 'Write report', status: 'in_progress', priority: 'med', tag: 'Work', due_date: iso(2), notes: '', created_at: new Date().toISOString() }, { id: 't3', title: 'Old thing', status: 'done', priority: 'low', tag: 'Study', due_date: iso(-3), completed_at: new Date().toISOString(), notes: '', created_at: new Date().toISOString() }],
  events: [{ id: 'e1', title: 'Standup', category: 'Meeting', event_date: today, all_day: false, start_time: '10:00', end_time: '10:30', repeats: 'daily', note: 'daily sync', created_at: new Date().toISOString() }, { id: 'e2', title: 'Holiday', category: 'Personal', event_date: iso(1), all_day: true, start_time: null, end_time: null, repeats: 'none', note: '', created_at: new Date().toISOString() }],
  notes: [{ id: 'n1', title: 'Ideas', body: 'first idea', tag: 'Work', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), note_documents: [] }],
  habits: [{ id: 'h1', name: 'Read', icon: 'fa-book', color: '#3b82f6', target: '', days: [0, 1, 2, 3, 4, 5, 6], archived: false, period: 'daily', per_period: 1, goal_value: null, unit: '', source: 'manual', reminder_time: '08:00', created_at: new Date(Date.now() - 5 * 864e5).toISOString() }],
  goals: [{ id: 'g1', title: 'Save money', category: 'Finance', unit: 'RM', target_value: 1000, current_value: 250, deadline: iso(20), note: '', completed_at: null, created_at: new Date().toISOString() }],
  bills: [{ id: 'b1', name: 'Internet', amount: 129, category: 'Internet', recurrence: 'monthly', due_date: iso(3), note: '', active: true, created_at: new Date(Date.now() - 40 * 864e5).toISOString() }, { id: 'b2', name: 'Netflix', amount: 55, category: 'Subscription', recurrence: 'monthly', due_date: iso(5), note: '', active: true, created_at: new Date(Date.now() - 40 * 864e5).toISOString() }],
  money_entries: [{ id: 'm1', kind: 'expense', amount: 25, category: 'Food & dining', name: 'Lunch', entry_date: today, created_at: new Date().toISOString() }],
  reminders: [{ id: 'r1', title: 'Timesheet', note: 'submit', kind: 'month_last_weekday', start_date: today, remind_time: '09:00', days: [], active: true, last_fired_on: null, created_at: new Date().toISOString() }],
  documents: [{ id: 'd1', category_id: null, name: 'Passport.pdf', mime_type: 'application/pdf', size_bytes: 1200, storage_path: 'u1/a.pdf', created_at: new Date().toISOString() }],
  health_logs: [{ log_date: today, sleep_hours: 7, water_ml: 1000, steps: 4000, active_minutes: 20, mood: 4, note: 'ok', updated_at: new Date().toISOString() }],
  money_settings: { gross_salary: 5000, epf_rate: 11, marital: 'single', children: 0, other_relief: 0, pay_day: 25, monthly_budget: 2500, pcb_override: null, created_at: new Date(Date.now() - 40 * 864e5).toISOString() },
  profiles: { id: 'u1', first_name: 'Test', last_name: 'User', email: 'a@b.c', plan: 'zenith', theme: 'midnight', background_url: null, preferences: {}, country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
  notifications: [{ id: 'x1', type: 'system', title: 'Hello', body: 'World', link: 'dashboard', read_at: null, created_at: new Date().toISOString() }],
  study_notes: [{ id: 'n1', course_id: 'c1', title: 'ER basics', body: 'Entities, relationships, cardinality', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
  study_semesters: [{ id: 'sm1', name: 'Semester 2, 2026', start_date: iso(-28), end_date: iso(70), created_at: new Date().toISOString(), is_active: true, archived_at: null, remark: '' }, { id: 'sm2', name: 'Semester 3, 2027', start_date: iso(120), end_date: iso(220), created_at: new Date().toISOString(), is_active: false, archived_at: null, remark: '' }, { id: 'sm0', name: 'Semester 1, 2026', start_date: iso(-200), end_date: iso(-110), created_at: new Date().toISOString(), archived_at: new Date(Date.now()-100*864e5).toISOString(), is_active: false, remark: 'Finished well, but Calculus was hard.' }],
  study_courses: [{ id: 'c3', name: 'Physics 101', code: 'PH101', color: '#f472b6', lecturer: '', credit_hours: 3, archived: true, semester_id: 'sm0', target_percent: null, final_percent: 81, created_at: new Date().toISOString() }, { id: 'c4', name: 'Old elective', code: '', color: '#fbbf24', lecturer: '', credit_hours: 2, archived: true, semester_id: null, target_percent: null, final_percent: 62, created_at: new Date().toISOString() }, { id: 'c1', name: 'Database Systems', code: 'CS2101', color: '#34d399', lecturer: 'Dr. Aisyah', credit_hours: 3, archived: false, semester_id: 'sm1', target_percent: 80, final_percent: null, created_at: new Date().toISOString() }, { id: 'c2', name: 'Calculus', code: '', color: '#60a5fa', lecturer: '', credit_hours: 4, archived: false, semester_id: 'sm1', target_percent: null, final_percent: 72, created_at: new Date().toISOString() }],
  study_classes: [{ id: 'k9', course_id: 'c3', weekday: 2, start_time: '10:00:00', end_time: '12:00:00', room: 'Lab', kind: 'lab', start_date: null, end_date: null, created_at: new Date().toISOString() }, { id: 'k1', course_id: 'c1', weekday: new Date().getUTCDay(), start_time: '09:00:00', end_time: '10:30:00', room: 'Lab 3', kind: 'lecture', created_at: new Date().toISOString() }, { id: 'k2', course_id: 'c2', weekday: (new Date().getUTCDay() + 1) % 7, start_time: '14:00:00', end_time: '15:00:00', room: '', kind: 'tutorial', created_at: new Date().toISOString() }],
  study_tasks: [{ id: 's9', course_id: 'c3', title: 'Final report', kind: 'project', due_date: iso(-120), due_time: null, weight: 30, score: 45, max_score: 50, status: 'done', notes: '', completed_at: null, created_at: new Date().toISOString() }, { id: 's1', course_id: 'c1', title: 'ER diagram report', kind: 'assignment', due_date: iso(2), due_time: '23:59:00', weight: 20, score: 42, max_score: 50, status: 'todo', notes: '', completed_at: null, created_at: new Date().toISOString() }, { id: 's2', course_id: 'c2', title: 'Midterm', kind: 'exam', due_date: iso(-1), due_time: null, weight: 30, score: null, max_score: null, status: 'todo', notes: '', completed_at: null, created_at: new Date().toISOString() }, { id: 's3', course_id: null, title: 'Read chapter 4', kind: 'other', due_date: null, due_time: null, weight: null, score: null, max_score: null, status: 'done', notes: '', completed_at: new Date().toISOString(), created_at: new Date().toISOString() }],
  focus_sessions: [{ minutes: 50, course_id: 'c1', started_at: new Date().toISOString() }],
  document_categories: [{ id: 'c1', name: 'Receipts', parent_id: null, color: '#3b82f6' }],
};
const chain = (value) => { const f = function () {}; return new Proxy(f, { get(_, k) { if (k === 'then') return (res) => res({ data: value, error: null }); if (k === 'maybeSingle' || k === 'single') return () => chain(Array.isArray(value) ? value[0] || null : value); return chain(value); }, apply() { return chain(value); } }); };
const client = { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getUser: async () => ({ data: { user: session.user } }), signOut: async () => ({}) },
  schema: () => ({ from: (t) => chain(T[t] !== undefined ? T[t] : []), rpc: (n, a) => { (globalThis.__rpcs = globalThis.__rpcs || []).push([n, JSON.stringify(a)]); return chain(n === 'my_limits' ? { plan: 'zenith', limits: {}, addons: ['study'], addon_info: { study: { source: 'admin', expires_at: null } }, trials_used: [] } : n === 'is_admin' ? true : n === 'admin_stats' ? { total: 1, dawn: 0, glow: 0, zenith: 1, new_7d: 1 } : n === 'admin_list_users' ? [{ id: 'u9', email: 'aina@x.com', first_name: 'Aina', last_name: 'Rahman', plan: 'glow', country: 'Malaysia', created_at: new Date().toISOString(), last_sign_in_at: null, email_confirmed_at: new Date().toISOString(), is_admin: false, addons: ['study'], plan_expires_at: new Date(Date.now()+5*864e5).toISOString(), addon_expiry: { study: new Date(Date.now()+40*864e5).toISOString() } }, { id: 'u8', email: 'ben@x.com', first_name: 'Ben', last_name: '', plan: 'dawn', country: 'Malaysia', created_at: new Date().toISOString(), last_sign_in_at: null, email_confirmed_at: new Date().toISOString(), is_admin: false, addons: [], plan_expires_at: null, addon_expiry: {} }] : n === 'admin_monthly_stats' ? [{ period: today.slice(0, 8) + '01', total_accounts: 1, new_signups: 1, on_dawn: 0, on_glow: 0, on_zenith: 1, upgrades: 0, downgrades: 0 }] : n === 'list_contacts' ? [{ contact_id: 'ct1', status: 'accepted', direction: 'outgoing', other_id: 'u2', other_first_name: 'Aina', other_last_name: 'Rahman', other_email: 'aina@x.com' }, { contact_id: 'ct2', status: 'accepted', direction: 'incoming', other_id: 'u3', other_first_name: 'Ben', other_last_name: '', other_email: 'ben@x.com' }] : n === 'my_study_projects' ? [{ id: 'p1', title: 'DB presentation', course_name: 'Database Systems', due_date: iso(5), owner_id: 'u1', owner_name: 'Test User', my_status: 'accepted', members: 3, tasks_total: 4, tasks_done: 1, updated_at: new Date().toISOString() }, { id: 'p2', title: 'Physics lab report', course_name: 'Physics', due_date: iso(9), owner_id: 'u2', owner_name: 'Aina Rahman', my_status: 'pending', members: 2, tasks_total: 0, tasks_done: 0, updated_at: new Date().toISOString() }] : n === 'study_project_detail' ? { project: { id: 'p1', title: 'DB presentation', course_name: 'Database Systems', due_date: iso(5), owner_id: 'u1', notes: 'Slides in Drive' }, me: { user_id: 'u1', status: 'accepted' }, members: [{ user_id: 'u1', name: 'Test User', status: 'accepted' }, { user_id: 'u2', name: 'Aina Rahman', status: 'accepted' }, { user_id: 'u3', name: 'Ben', status: 'pending' }], tasks: [{ id: 'pt1', title: 'Draw ER diagram', assignee_id: 'u2', status: 'todo', due_date: null, created_by: 'u1' }, { id: 'pt2', title: 'Write intro', assignee_id: 'u1', status: 'done', due_date: null, created_by: 'u1' }] } : n === 'shared_study_notes' ? [{ id: 'sn1', title: 'Normalisation cheat sheet', body: '1NF, 2NF, 3NF explained', course_name: 'Database Systems', owner_name: 'Aina Rahman', updated_at: new Date().toISOString() }] : n === 'study_note_shared_with' ? [{ user_id: 'u3', name: 'Ben' }] : n === 'create_study_project' ? 'newp' : n === 'nudge_study_project_member' ? 'sent' : n === 'invite_to_study_project' || n === 'share_study_note' ? 1 : []); } }),
  from: () => chain([]), rpc: () => chain([]), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, functions: { invoke: async () => ({ data: {} }) }, storage: { from: () => ({ upload: async () => ({}), remove: async () => ({}), createSignedUrl: async () => ({ data: { signedUrl: 'https://signed.example/x' }, error: null }) }) } };

const PROPS = ['display', 'position', 'overflow-x', 'overflow-y', 'flex-direction', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'justify-content', 'grid-template-columns', 'gap', 'color', 'background-color', 'background-image', 'font-size', 'font-weight', 'line-height', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-top-color', 'border-radius', 'opacity', 'visibility', 'z-index', 'width', 'height', 'min-height', 'max-height', 'text-align', 'white-space', 'cursor', 'pointer-events', 'transition', 'box-shadow', 'text-transform', 'letter-spacing'];
function sigOf(w, root, prefix, map) {
  const els = [root, ...root.querySelectorAll('*')];
  const seen = {};
  els.forEach((el) => {
    if (/^(SCRIPT|STYLE|LINK|META|TITLE)$/.test(el.tagName)) return;
    const base = prefix + ' ' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).sort().join('.') : '');
    seen[base] = (seen[base] || 0) + 1; const key = base + ' [' + seen[base] + ']';
    const cs = w.getComputedStyle(el); const o = {}; PROPS.forEach((p) => { o[p] = cs.getPropertyValue(p); });
    map[key] = o;
  });
}
(async () => {
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(String(e.detail && e.detail.message || e.message).slice(0, 160)));
  const before = (w) => { w.supabase = { createClient: () => client }; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {} }); w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {}; w.IntersectionObserver = class { observe() {} disconnect() {} }; w.sessionStorage.setItem('luma_booted', '1'); };
  let dom, server;
  if (mode === 'old' || mode === 'oldjs') {
    let html = fs.readFileSync(mode === 'oldjs' ? '/tmp/oldjs.html' : ROOT + 'LUMA Glass Dashboard.html', 'utf8');
    html = html.replace(/<script src="https:[^"]*"><\/script>/g, '').replace(/<script src="(assets\/[^"]+)"><\/script>/g, (m, f) => '<script>' + fs.readFileSync(ROOT + f, 'utf8').replace(/<\/script>/g, '<\\/script>') + '</script>');
    dom = new JSDOM(html, { url: 'http://localhost/LUMA%20Glass%20Dashboard.html', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true, beforeParse: before });
  } else {
    server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('nf'); } else { res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(b); } }); });
    await new Promise((r) => server.listen(0, r)); const port = server.address().port;
    let html = fs.readFileSync(ROOT + 'app/index.html', 'utf8').replace(/<script src="https:[^"]*"><\/script>/g, '').replace(/<link[^>]*href="https:[^>]*>/g, '');
    dom = new JSDOM(html, { url: 'http://localhost:' + port + '/app/', runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true, beforeParse: (w) => { before(w); w.fetch = (u, o) => fetch(new URL(u, 'http://localhost:' + port + '/app/'), o); } });
  }
  await new Promise((r) => setTimeout(r, mode === 'old' || mode === 'oldjs' ? 3500 : 6000));
  const w = dom.window, d = w.document, map = {};

  const ev=(c)=>w.eval(c); const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); const txt=(el)=>el.textContent.replace(/\s+/g,' ');
  try {
  ev("LumaPlan.plan='glow'; LumaPlan.planExpires=new Date(Date.now()+5*864e5).toISOString(); LumaPlan.addons=['study']; LumaPlan.addonInfo={study:{source:'admin',expires_at:new Date(Date.now()+20*864e5).toISOString()}}; window.open=(u)=>{window.__o=u}"); 
  ev("LumaPlan.addons=['study','work']; LumaPlan.addonInfo={study:{source:'admin',expires_at:new Date(Date.now()+20*864e5).toISOString()},work:{source:'trial',expires_at:new Date(Date.now()+3*864e5).toISOString()}}");
  ev("goTo('settings')"); await wait(1000);
    ev("LumaPlan.plan='zenith'; LumaPlan.admin=true; LumaPlan.addons=['study']");
  const pages=['dashboard','calendar','tasks','reminders','money','split','subscriptions','bills','goals','habits','health','notes','documents','contacts','assistant','analytics','settings','purchases','support','notifications','admin','adminreport'];
  const res=[]; for(const k of pages){ const before=errors.length; try{ ev("goTo('"+k+"')"); }catch(e){ res.push(k+': THREW '+e.message); continue; } await wait(700); const pg=d.getElementById('page-'+k); res.push(k+': '+(pg&&pg.classList.contains('active')&&txt(pg).length>20?'ok':'EMPTY')+(errors.length>before?' ERR '+errors.slice(before).join('|'):'')); }
  console.log(res.filter(x=>!/: ok$/.test(x)).join('\n')||'personal pages: all render, no errors');
  const st=[]; for(const t of ['overview','timetable','assignments','subjects','semesters','notes','cards','groups']){ const before=errors.length; ev("goTo('study'); SD.tab='"+t+"'; sdPaint()"); await wait(500); st.push(t+':'+(txt(d.getElementById('sdRoot')).length>10?'ok':'EMPTY')+(errors.length>before?' ERR':'')); }
  console.log('study tabs:', st.join(' | '));
  ev("goTo('studyarchive')"); await wait(600); console.log('study archive:', txt(d.getElementById('page-studyarchive')).length>20?'ok':'EMPTY');
  } catch (e) { console.log('TEST ERR', e.stack.split('\n').slice(0,3).join(' | ')); }
  console.log('errors', errors); process.exit(0);
  const keys = ['dashboard', 'calendar', 'reminders', 'tasks', 'money', 'subscriptions', 'bills', 'goals', 'habits', 'health', 'notes', 'documents', 'contacts', 'assistant', 'analytics', 'admin', 'adminreport', 'settings', 'support', 'notifications'];
  // shell (sidebar + top bar), taken on the dashboard
  const sb = d.getElementById('sidebar'); if (sb) sigOf(w, sb, 'shell', map); const tb = d.querySelector('.topbar'); if (tb) sigOf(w, tb, 'topbar', map);
  for (const k of keys) {
    try { w.eval(`goTo(${JSON.stringify(k)})`); } catch (e) { errors.push('goTo ' + k + ': ' + e.message); }
    await new Promise((r) => setTimeout(r, 1300));
    const pg = d.getElementById('page-' + k); if (pg) sigOf(w, pg, 'page-' + k, map); else errors.push('no page element for ' + k);
    map['_active_' + k] = { v: String(d.querySelector('.page.active') && d.querySelector('.page.active').id), fit: String(d.querySelector('.main-content').classList.contains('fit')) };
  }
  d.querySelectorAll('.modal-overlay, #notifPanel, #chatPop, .fab').forEach((m) => sigOf(w, m, 'modal ' + (m.id || m.className), map));
  fs.writeFileSync(out, JSON.stringify({ errors, map }, null, 0));
  console.log(mode, '→ errors:', errors.length, errors.slice(0, 5), '| signature entries:', Object.keys(map).length);
  if (server) server.close(); dom.window.close(); process.exit(0);
})();
