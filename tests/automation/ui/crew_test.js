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
T.work_projects=[{id:'p1',owner_id:'u1',name:'Website',client:'Acme',color:'#fb923c',status:'active',deadline:iso(20),description:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()},{id:'p2',owner_id:'u2',name:'Brand kit',client:'',color:'#60a5fa',status:'active',deadline:null,description:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
T.work_projects.forEach(p=>{p.kind=p.id==='p1'?'project':'general'; p.company_id='co1';});
T.work_projects.push({id:'p9',owner_id:'u1',name:'Old job',client:'',color:'#a78bfa',status:'active',deadline:null,description:'',kind:'general',company_id:'co2',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
T.work_time_entries=[{id:'te1',company_id:'co1',project_id:'p1',task_id:'w1',project_name:'Website',task_title:'Design home page',work_date:today.slice(0,8)+'01',minutes:90,note:'wireframes',running_since:null,created_at:'2026-10-01T09:00:00Z'},{id:'te2',company_id:'co1',project_id:null,task_id:null,project_name:null,task_title:null,work_date:today.slice(0,8)+'02',minutes:45,note:'team meeting',running_since:null,created_at:'2026-10-02T09:00:00Z'},{id:'te3',company_id:'co2',project_id:null,task_id:null,project_name:null,task_title:null,work_date:today.slice(0,8)+'02',minutes:30,note:'old',running_since:null,created_at:'2026-10-02T10:00:00Z'}];
T.feedback=[{id:'fa1',user_label:'Aina Rahman <aina@x.com>',kind:'bug',module:'Work',part:'Tasks: Gantt chart',message:'The bar jumps when I drag it',image_path:'u2/a.png',context:{page:'work',mode:'work',version:'0.21.0',screen:'390x844'},status:'new',admin_note:'',created_at:new Date().toISOString()},{id:'fa2',user_label:'Ben <b@x.com>',kind:'idea',module:'Calendar',part:'',message:'Dark red for packed days',image_path:null,context:{},status:'planned',admin_note:'soon',created_at:new Date().toISOString()}];
T.work_companies=[{id:'co1',name:'Acme Sdn Bhd',archived_at:null,created_at:'2026-01-01'},{id:'co2',name:'Old Co',archived_at:'2026-06-01T00:00:00Z',created_at:'2026-01-02'}];
T.work_folders=['Planning','Requirement study','Design','Development','Testing','Deployment'].map((n,i)=>({id:'f'+i,project_id:'p1',name:n,notes:i===2?'wireframes in Figma':'',position:i,is_phase:true}));
T.work_tasks=[{id:'w1',project_id:'p1',title:'Design home page',description:'',status:'doing',priority:'high',folder_id:'f2',assignee_ids:['u1'],start_date:iso(-4),due_date:iso(-1),position:0,checklist:[{t:'wireframe',d:true},{t:'colours',d:false}],created_by:'u1',created_at:new Date().toISOString()},{id:'w2',project_id:'p1',title:'Write copy',description:'',status:'todo',priority:'med',assignee_id:'u2',due_date:iso(3),position:0,checklist:[],created_by:'u1',created_at:new Date().toISOString()},{id:'w3',project_id:'p2',title:'Logo ideas',description:'',status:'review',priority:'low',assignee_id:null,due_date:null,position:0,checklist:[],created_by:'u2',created_at:new Date().toISOString()}];
globalThis.__rpcData={work_comment_history:[{body:'Please use the NEW logo',edited_at:new Date().toISOString(),is_current:true},{body:'Please use the new logo',edited_at:new Date(Date.now()-3600e3).toISOString(),is_current:false}],work_project_time:[{user_id:'u1',name:'Test User',work_date:today.slice(0,8)+'03',minutes:120,task_title:'Design home page',note:'wireframes'},{user_id:'u2',name:'Aina Rahman',work_date:today.slice(0,8)+'04',minutes:45,task_title:null,note:'review'}],work_task_comments_of:[{id:'cm1',user_id:'u2',name:'Aina Rahman',body:'Please use the new logo',created_at:new Date().toISOString(),edited_at:new Date().toISOString()},{id:'cm2',user_id:'u1',name:'Test User',body:'On it',created_at:new Date().toISOString(),edited_at:null}],work_task_files_of:[{id:'fl1',document_id:'d1',name:'brief.pdf',size_bytes:1200,mime_type:'application/pdf',storage_path:'u1/brief.pdf',added_by:'u1',added_by_name:'You',created_at:new Date().toISOString()}],my_work_shared:[{id:'p2',name:'Brand kit',client:'',color:'#60a5fa',status:'active',deadline:null,owner_id:'u2',owner_name:'Aina Rahman',my_role:'member',my_status:'accepted',tasks:1,done:0},{id:'p3',name:'Launch plan',client:'',color:'#a78bfa',status:'active',deadline:null,owner_id:'u2',owner_name:'Aina Rahman',my_role:'member',my_status:'pending',tasks:0,done:0}],my_work_people:[{project_id:'p1',user_id:'u1',name:'Test User',role:'owner',status:'accepted'},{project_id:'p1',user_id:'u2',name:'Aina Rahman',role:'member',status:'accepted'},{project_id:'p2',user_id:'u2',name:'Aina Rahman',role:'owner',status:'accepted'},{project_id:'p2',user_id:'u1',name:'Test User',role:'member',status:'accepted'}]};
const chain = (value) => { const f = function () {}; return new Proxy(f, { get(_, k) { if (k === 'then') return (res) => res({ data: value, error: null }); if (k === 'maybeSingle' || k === 'single') return () => chain(Array.isArray(value) ? value[0] || null : value); return chain(value); }, apply() { return chain(value); } }); };
const client = { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getUser: async () => ({ data: { user: session.user } }), signOut: async () => ({}) },
  schema: () => ({ from: (t) => chain(T[t] !== undefined ? T[t] : []), rpc: (n, a) => { (globalThis.__rpcs = globalThis.__rpcs || []).push([n, JSON.stringify(a)]); return chain(globalThis.__rpcData && globalThis.__rpcData[n] ? globalThis.__rpcData[n] : n === 'my_limits' ? { plan: 'zenith', limits: {}, addons: ['study'], addon_info: { study: { source: 'admin', expires_at: null } }, trials_used: [] } : n === 'is_admin' ? true : n === 'admin_stats' ? { total: 1, dawn: 0, glow: 0, zenith: 1, new_7d: 1 } : n === 'admin_list_users' ? [{ id: 'u9', email: 'aina@x.com', first_name: 'Aina', last_name: 'Rahman', plan: 'glow', country: 'Malaysia', created_at: new Date().toISOString(), last_sign_in_at: null, email_confirmed_at: new Date().toISOString(), is_admin: false, addons: ['study'], plan_expires_at: new Date(Date.now()+5*864e5).toISOString(), addon_expiry: { study: new Date(Date.now()+40*864e5).toISOString() } }, { id: 'u8', email: 'ben@x.com', first_name: 'Ben', last_name: '', plan: 'dawn', country: 'Malaysia', created_at: new Date().toISOString(), last_sign_in_at: null, email_confirmed_at: new Date().toISOString(), is_admin: false, addons: [], plan_expires_at: null, addon_expiry: {} }] : n === 'admin_monthly_stats' ? [{ period: today.slice(0, 8) + '01', total_accounts: 1, new_signups: 1, on_dawn: 0, on_glow: 0, on_zenith: 1, upgrades: 0, downgrades: 0 }] : n === 'list_contacts' ? [{ contact_id: 'ct1', status: 'accepted', direction: 'outgoing', other_id: 'u2', other_first_name: 'Aina', other_last_name: 'Rahman', other_email: 'aina@x.com' }, { contact_id: 'ct2', status: 'accepted', direction: 'incoming', other_id: 'u3', other_first_name: 'Ben', other_last_name: '', other_email: 'ben@x.com' }] : n === 'my_study_projects' ? [{ id: 'p1', title: 'DB presentation', course_name: 'Database Systems', due_date: iso(5), owner_id: 'u1', owner_name: 'Test User', my_status: 'accepted', members: 3, tasks_total: 4, tasks_done: 1, updated_at: new Date().toISOString() }, { id: 'p2', title: 'Physics lab report', course_name: 'Physics', due_date: iso(9), owner_id: 'u2', owner_name: 'Aina Rahman', my_status: 'pending', members: 2, tasks_total: 0, tasks_done: 0, updated_at: new Date().toISOString() }] : n === 'study_project_detail' ? { project: { id: 'p1', title: 'DB presentation', course_name: 'Database Systems', due_date: iso(5), owner_id: 'u1', notes: 'Slides in Drive' }, me: { user_id: 'u1', status: 'accepted' }, members: [{ user_id: 'u1', name: 'Test User', status: 'accepted' }, { user_id: 'u2', name: 'Aina Rahman', status: 'accepted' }, { user_id: 'u3', name: 'Ben', status: 'pending' }], tasks: [{ id: 'pt1', title: 'Draw ER diagram', assignee_id: 'u2', status: 'todo', due_date: null, created_by: 'u1' }, { id: 'pt2', title: 'Write intro', assignee_id: 'u1', status: 'done', due_date: null, created_by: 'u1' }] } : n === 'shared_study_notes' ? [{ id: 'sn1', title: 'Normalisation cheat sheet', body: '1NF, 2NF, 3NF explained', course_name: 'Database Systems', owner_name: 'Aina Rahman', updated_at: new Date().toISOString() }] : n === 'study_note_shared_with' ? [{ user_id: 'u3', name: 'Ben' }] : n === 'create_study_project' ? 'newp' : n === 'nudge_study_project_member' ? 'sent' : n === 'invite_to_study_project' || n === 'share_study_note' ? 1 : []); } }),
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
  // ---- the AI crew box in the Feedback inbox (migration 101) ----
  let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  ✗', n, x === undefined ? '' : x); } };
  const now = new Date().toISOString();
  T.feedback = [
    { id: 'fa1', user_id: 'u2', user_label: 'Aina Rahman <aina@x.com>', kind: 'idea', module: 'Work', part: 'Tasks: Gantt chart', message: 'The bar jumps when I drag it', image_path: null, context: { page: 'work' }, status: 'new', admin_note: '', created_at: now },
    { id: 'fa2', user_id: 'u3', user_label: 'Ben <b@x.com>', kind: 'question', module: 'Calendar', part: '', message: 'How do I export?', image_path: null, context: {}, status: 'new', admin_note: '', created_at: now },
    { id: 'fa3', user_id: 'u4', user_label: 'Cho <c@x.com>', kind: 'bug', module: 'Money', part: '', message: 'Budget is wrong', image_path: null, context: {}, status: 'new', admin_note: '', created_at: now },
    { id: 'fa4', user_id: 'u5', user_label: 'Dee <d@x.com>', kind: 'bug', module: 'Work', part: 'Tasks: Gantt chart', message: 'gantt end date off by one', image_path: null, context: {}, status: 'seen', admin_note: '', created_at: now },
  ];
  T.crew_runs = [
    { id: 'r1', feedback_id: 'fa1', status: 'done', category: 'bug', severity: 'high', summary: 'Dragging a Gantt bar saves the end date a day early.', likely_cause: 'Rounding in wkGanttDrop (work.views.js)', suggested_fix: 'Use Math.round instead of Math.floor', draft_reply: 'Thanks Aina! We found the cause and a fix is on the way.', suggested_status: 'planned', duplicate_of: 'fa4', model: 'claude:claude-sonnet-5-5', error: '', created_at: now },
    { id: 'r2', feedback_id: 'fa2', status: 'working', created_at: now },
    { id: 'r3', feedback_id: 'fa3', status: 'failed', error: 'claude 529: overloaded', created_at: now },
  ];
  T.crew_steps = [
    { run_id: 'r1', agent: 'engineer', task: 'find it', status: 'done', output: 'Likely cause: rounding', started_at: now },
    { run_id: 'r1', agent: 'support', task: 'reply', status: 'done', output: 'Thanks Aina!', started_at: now },
    { run_id: 'r2', agent: 'support', task: 'reply', status: 'working', output: '', started_at: now },
  ];
  ev("LumaPlan.admin=true; LUMA_USER.id='u1'; window.__inv=[]; LumaAuth.client.functions.invoke=async(n,o)=>{window.__inv.push([n,o]); return {data:{ok:true,run_id:'r9'}}}");
  ev("goTo('adminfeedback')"); await wait(1500); d.querySelector('[data-fbs=""]').click(); await wait(100);
  const card = id => d.querySelector('.fb-item[data-id="' + id + '"] .fb-crew');
  const c1 = card('fa1');
  ok('a finished run shows its summary', c1 && /saves the end date a day early/.test(txt(c1)), c1 && txt(c1).slice(0, 200));
  ok('category and severity shown', c1 && /bug/.test(txt(c1)) && /high/.test(txt(c1)));
  ok('the duplicate is named', c1 && /same thing as “gantt end date off by one” \(Seen\)/.test(txt(c1)), c1 && txt(c1.querySelector('.fb-crew-dup') || c1));
  ok('cause and fix are folded away', c1 && c1.querySelectorAll('details').length === 2 && /wkGanttDrop/.test(txt(c1.querySelector('details'))));
  ok('the draft reply is shown with its suggested status', c1 && /Draft reply · suggested status: Planned/.test(txt(c1)) && /fix is on the way/.test(txt(c1.querySelector('.fb-crew-reply'))));
  ok('it says nothing was sent', c1 && /nothing was sent to the person/.test(txt(c1)));
  const c2 = card('fa2'); ok('a running crew shows who is working', c2 && /The crew is working on it/.test(txt(c2)) && /Support/.test(txt(c2)), c2 && txt(c2));
  const c3 = card('fa3'); ok('a failed run shows why and offers Try again', c3 && /Could not finish/.test(txt(c3)) && /overloaded/.test(txt(c3)) && !!c3.querySelector('[data-crewrun]'));
  const c4 = card('fa4'); ok('feedback the crew has not seen offers Ask the crew', c4 && /Ask the crew/.test(txt(c4)));

  // Use as note: fills the note and the status, saves nothing
  ev("window.__fu=[]; LumaAuth.client.schema=(function(sc){return function(n){const o=sc.call(this,n); return {from:o.from, rpc:function(name,a){ if(name==='admin_feedback_update'){window.__fu.push(a); return Promise.resolve({error:null})} return o.rpc(name,a)}}}})(LumaAuth.client.schema)");
  const it1 = d.querySelector('.fb-item[data-id="fa1"]'); it1.querySelector('[data-crewnote]').click(); await wait(100);
  ok('Use as note fills the note box', it1.querySelector('[data-fbnote]').value === 'Thanks Aina! We found the cause and a fix is on the way.');
  ok('…and picks the suggested status', it1.querySelector('[data-fbst]').value === 'planned');
  ok('…without saving anything', ev('window.__fu.length') === 0);
  it1.querySelector('[data-fbsave]').click(); await wait(300);
  ok('Save then sends it the usual way', /"p_status":"planned"/.test(ev('JSON.stringify(window.__fu)')) && /fix is on the way/.test(ev('JSON.stringify(window.__fu)')), ev('JSON.stringify(window.__fu)'));
  // Use as reply: opens the reply box with the draft
  d.querySelector('.fb-item[data-id="fa1"] [data-crewreply]').click(); await wait(100);
  const ta = d.querySelector('.fb-item[data-id="fa1"] [data-fbrtext]'); ok('Use as reply opens the reply box with the draft', ta && /fix is on the way/.test(ta.value));
  // a note being typed survives a crew update
  const it2 = d.querySelector('.fb-item[data-id="fa2"]'); it2.querySelector('[data-fbnote]').value = 'typing…';
  T.crew_runs[1].status = 'done'; T.crew_runs[1].summary = 'Answered by the FAQ: Calendar → Export.'; T.crew_runs[1].draft_reply = 'Open Calendar → Export.'; T.crew_runs[1].suggested_status = 'done';
  ev("fbaLoadCrew().then(fbaCrewRepaint)"); await wait(300);
  ok('a crew update redraws only the crew box', /Answered by the FAQ/.test(txt(card('fa2'))) && d.querySelector('.fb-item[data-id="fa2"] [data-fbnote]').value === 'typing…');
  // Ask the crew starts the function for that feedback
  card('fa4').querySelector('[data-crewrun]').click(); await wait(300);
  ok('Ask the crew calls feedback-crew with the feedback id', ev("JSON.stringify(window.__inv)") === '[["feedback-crew",{"body":{"feedback_id":"fa4"}}]]', ev("JSON.stringify(window.__inv)"));
  ok('…and shows it is waiting', /Waiting to start/.test(txt(card('fa4'))));
  // ---- the Agent floor page ----
  T.crew_runs = [{ id: 'r1', feedback_id: 'fa1', status: 'working', created_at: now }, { id: 'r3', feedback_id: 'fa3', status: 'failed', error: 'overloaded', created_at: now }];
  T.crew_steps = [{ run_id: 'r1', agent: 'engineer', task: 'Find why the end date is a day early', status: 'working', output: '', started_at: now }];
  ev("window.__inv=[]; LumaAuth.client.functions.invoke=async(n,o)=>{window.__inv.push([n,o]); return {data:{ok:true,run_id:'r9'}}}");
  ev("goTo('agentfloor')"); await wait(1500);
  ok('Agent floor opens with the office', !!d.getElementById('afCanvas') && d.querySelectorAll('#afWrap [data-afb]').length === 4);
  ok('the crew shows the Engineer working on the real task', /Cleo Engineer\s*working\s*Find why the end date/.test(txt(d.getElementById('afCrew'))), txt(d.getElementById('afCrew')).slice(0, 200));
  ok('the lead waits on the crew', /Ada Lead\s*waiting/.test(txt(d.getElementById('afCrew'))));
  ok('latest feedback lists each with its crew status', /Working/.test(txt(d.getElementById('afQueue'))) && /Failed/.test(txt(d.getElementById('afQueue'))) && /Not checked/.test(txt(d.getElementById('afQueue'))));
  ok('the header says what is going on', /1 feedback being worked on/.test(txt(d.getElementById('afSub'))), txt(d.getElementById('afSub')));
  ok('what happened is listed', /Cleo started/.test(txt(d.getElementById('afLog'))));
  d.querySelector('[data-afask="fa2"]').click(); await wait(300);
  ok('Ask the crew from the floor starts the function', /"feedback_id":"fa2"/.test(ev("JSON.stringify(window.__inv)")), ev("JSON.stringify(window.__inv)"));
  ok('Admin highlights its menu item on the floor page', !!d.querySelector('.menu.active[data-page="admin"]') || !d.querySelector('.menu[data-page="admin"]'));
  ev("LumaPlan.admin=false"); ev("goTo('admin')"); await wait(400); ev("goTo('agentfloor')"); await wait(600);
  ok('only administrators see the floor', /only for administrators/.test(txt(d.getElementById('page-agentfloor'))));
  ev("LumaPlan.admin=true");
  // without migration 101 the inbox looks as before
  delete T.crew_runs; ev("FBA.crewOn=true"); ev("LumaAuth.client.schema=window.__sc0||LumaAuth.client.schema");
  ev("(function(){const sc=LumaAuth.client.schema; LumaAuth.client.schema=function(n){const o=sc.call(this,n); return {from:function(t){ if(t==='crew_runs') return {select:()=>({in:()=>({order:()=>({limit:async()=>({data:null,error:{message:'relation luma.crew_runs does not exist'}})})})})}; return o.from(t)}, rpc:o.rpc}}})()");
  ev("goTo('admin')"); await wait(500); ev("goTo('adminfeedback')"); await wait(1200); d.querySelector('[data-fbs=""]').click(); await wait(100);
  ok('no crew box at all before migration 101', d.querySelectorAll('.fb-item').length > 0 && [...d.querySelectorAll('.fb-crew')].every(x => x.innerHTML === ''), d.querySelectorAll('.fb-crew').length);
  ok('no page errors', !errors.filter(e => !/navigation to another Document|getContext\(\) method/.test(e)).length, errors.filter(e => !/getContext/.test(e)));
  console.log(`crew_test: ${pass} passed, ${fail} failed`);
  } catch (e) { console.log('TEST ERR', e.message, e.stack.split('\n')[1]); }
  if (server) server.close(); process.exit(0);
})();
