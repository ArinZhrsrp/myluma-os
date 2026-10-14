// Runs the feedback-crew Edge Function end to end with a fake Supabase and a fake Claude (GitHub is real: it reads the public repo).
// Needs Deno. From tests/automation:  deno run -A --node-modules-dir=none edge/crew_flow_test.ts
// (--node-modules-dir=none: this folder has a Node node_modules, which would otherwise hide the function's npm: imports)
const SB = "http://sb.local";
Deno.env.set("SUPABASE_URL", SB); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc"); Deno.env.set("SUPABASE_ANON_KEY", "anon");
Deno.env.set("WEBHOOK_SECRET", "s3cret"); Deno.env.set("ANTHROPIC_API_KEY", "test-key");

const FID = "11111111-1111-4111-8111-111111111111";
const T: Record<string, any[]> = {
  feedback: [
    { id: FID, kind: "idea", module: "Work", part: "Tasks: Gantt chart", message: "When I drag a bar in the Gantt chart the end date jumps one day earlier than where I dropped it", image_path: "u1/shot.png", context: { page: "work", version: "0.41.1", screen: "1440x900" }, status: "new", admin_note: "", created_at: new Date().toISOString() },
    { id: "22222222-2222-4222-8222-222222222222", kind: "bug", module: "Work", part: "Tasks: Gantt chart", message: "gantt end date off by one after drag", image_path: null, context: {}, status: "seen", admin_note: "", created_at: new Date().toISOString() },
  ],
  feedback_replies: [], crew_runs: [], crew_steps: [],
};
const aiCalls: any[] = [];
let n = 0; const uuid = () => crypto.randomUUID();

function filt(rows: any[], q: URLSearchParams) {
  let out = rows;
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    if (op === "eq") out = out.filter(r => String(r[k]) === val);
    else if (op === "neq") out = out.filter(r => String(r[k]) !== val);
    else if (op === "gt") out = out.filter(r => String(r[k]) > val);
    else if (op === "in") { const set = val.replace(/^\(|\)$/g, "").split(",").map(s => s.replace(/"/g, "")); out = out.filter(r => set.includes(String(r[k]))); }
  }
  const lim = q.get("limit"); if (lim) out = out.slice(0, +lim);
  return out;
}
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  if (url.origin === SB) {
    if (url.pathname.startsWith("/storage/v1/object/")) return new Response(new Uint8Array([137, 80, 78, 71, 1, 2, 3]), { headers: { "content-type": "image/png" } });
    if (url.pathname === "/rest/v1/rpc/is_admin") return new Response("false", { headers: { "content-type": "application/json" } });
    const table = url.pathname.replace("/rest/v1/", ""); const rows = T[table];
    const hdr = new Headers(init.headers); const single = /pgrst\.object/.test(hdr.get("Accept") || "");
    const send = (data: any) => new Response(JSON.stringify(single ? data[0] ?? null : data), { status: single && !data[0] ? 406 : 200, headers: { "content-type": "application/json" } });
    if (method === "GET") return send(filt(rows, url.searchParams));
    if (method === "POST") { const b = JSON.parse(init.body); const arr = Array.isArray(b) ? b : [b]; const ins = arr.map(x => ({ id: uuid(), created_at: new Date(Date.now() + n++).toISOString(), status: x.status ?? (table === "crew_steps" ? "working" : "queued"), ...x })); rows.push(...ins); return send(ins); }
    if (method === "PATCH") { const b = JSON.parse(init.body); const hit = filt(rows, url.searchParams); hit.forEach(r => Object.assign(r, b)); return send(hit); }
  }
  if (url.hostname === "api.anthropic.com") {
    const b = JSON.parse(init.body); const user = typeof b.messages[0].content === "string" ? b.messages[0].content : b.messages[0].content.find((c: any) => c.type === "text").text;
    const hasImg = typeof b.messages[0].content !== "string";
    aiCalls.push({ system: b.system.slice(0, 40), hasImg, len: user.length, user });
    let text = "";
    if (/"category": "bug\|idea/.test(user)) text = "```json\n" + JSON.stringify({ category: "bug", severity: "medium", summary: "Dragging a Gantt bar saves the end date a day early.", duplicate_of: "22222222-2222-4222-8222-222222222222", assignments: [{ agent: "engineer", task: "Find why the end date is off by one after a drag." }, { agent: "support", task: "Thank them and say we're on it." }, { agent: "hacker", task: "x" }] }) + "\n```";
    else if (/"likely_cause"/.test(user)) text = JSON.stringify({ summary: "Off-by-one in the Gantt drag handler.", likely_cause: "Date rounding in work.views.js", suggested_fix: "Use Math.round", suggested_status: "planned", draft_reply: "Thanks! We found it and a fix is coming." });
    else if (/Engineer/.test(b.system)) text = "Likely cause: rounding.";
    else text = "Thanks so much for reporting this!";
    return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { headers: { "content-type": "application/json" } });
  }
  return realFetch(input, init);
}) as typeof fetch;

let handler: (r: Request) => Promise<Response>;
(Deno as any).serve = (h: any) => { handler = h; return {}; };
await import("../../../supabase/functions/feedback-crew/index.ts");

let pass = 0, fail = 0; const ok = (name: string, c: boolean, x?: unknown) => { if (c) pass++; else { fail++; console.log("  ✗", name, x ?? ""); } };
const post = (body: any, headers: Record<string, string>) => handler(new Request("http://fn/feedback-crew", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } }));

let r = await post({ record: { id: FID } }, {}); ok("no secret and no sign-in is refused", r.status === 403);
r = await post({ feedback_id: FID }, { Authorization: "Bearer user-jwt" }); ok("a signed-in non-admin is refused", r.status === 403, await r.text());
r = await post({ record: { id: "nope" } }, { "x-webhook-secret": "s3cret" }); ok("a bad id is refused", r.status === 400);
const t0 = Date.now();
r = await post({ type: "INSERT", record: { id: FID } }, { "x-webhook-secret": "s3cret" });
const res = await r.json(); ok("the webhook starts a run", r.status === 202 && !!res.run_id, res);
const run = T.crew_runs[0];
ok("the run finished", run.status === "done", run);
ok("category, severity, summary saved", run.category === "bug" && run.severity === "medium" && /Gantt/.test(run.summary), run);
ok("duplicate spotted", run.duplicate_of === "22222222-2222-4222-8222-222222222222");
ok("merge fields saved", run.likely_cause && run.suggested_fix && run.suggested_status === "planned" && /fix is coming/.test(run.draft_reply), run);
ok("model recorded", run.model === "claude:claude-sonnet-5-5", run.model);
ok("unknown agents are dropped", T.crew_steps.length === 2 && T.crew_steps.every(s => ["engineer", "support"].includes(s.agent)), T.crew_steps.map(s => s.agent));
ok("steps finished with output", T.crew_steps.every(s => s.status === "done" && s.output), T.crew_steps);
const eng = aiCalls.find(c => /Engineer/.test(c.system));
ok("engineer sees the screenshot", eng?.hasImg === true);
ok("engineer gets real code from the repo", /===== app\/modules\/work\//.test(eng?.user || ""), (eng?.user || "").slice(-400));
ok("code stays in budget", (eng?.len || 0) < 60000, eng?.len);
const sup = aiCalls.find(c => /Support/.test(c.system));
ok("support gets the FAQ", /How do I get started\?/.test(sup?.user || ""));
ok("support does not get the image", sup?.hasImg === false);
ok("the user's text is marked as untrusted", /untrusted text/.test(aiCalls[0].user));
// a second start while one is running is not doubled: simulate a stuck run
T.crew_runs.push({ id: uuid(), feedback_id: FID, status: "working", created_at: new Date().toISOString() });
r = await post({ record: { id: FID } }, { "x-webhook-secret": "s3cret" }); const j = await r.json();
ok("no second run while one is going", j.already_running === true && T.crew_runs.length === 2, j);
console.log(`${pass} passed, ${fail} failed (${Date.now() - t0} ms)`);
console.log("engineer prompt files:", [...(eng?.user || "").matchAll(/===== (\S+)/g)].map(m => m[1]).join(", "));
Deno.exit(fail ? 1 : 0);
