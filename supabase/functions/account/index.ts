// LUMA — account Edge Function: permanently deletes an account (database rows, stored files, and the sign-in itself).
//
//   • An administrator can delete any account that is not an administrator:   { "action": "delete", "user_id": "<id>" }
//   • A person can delete their own account (not used by the app yet):         { "action": "delete", "confirm": "<their email>" }
// It needs the service role (it removes files and the sign-in), which is why this is a function and not SQL.
// Every row of the person's data goes with the sign-in, because all tables are linked to it with "on delete cascade" (tested).
//
// Deploy:  supabase functions deploy account      (JWT verification stays ON; SUPABASE_SERVICE_ROLE_KEY is provided automatically)

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const BUCKETS = ["luma-documents", "luma-backgrounds", "luma-feedback"];   // the real bucket names; each keeps a person's files under a folder named after their id

// every file (at any depth) under a folder
async function listAll(service: any, bucket: string, folder: string, depth = 0): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await service.storage.from(bucket).list(folder, { limit: 1000 });
  if (error || !data) return out;
  for (const item of data) {
    const path = `${folder}/${item.name}`;
    if (item.id) out.push(path);                                   // a file
    else if (depth < 4) out.push(...(await listAll(service, bucket, path, depth + 1)));   // a folder
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await asCaller.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!u?.user) return json({ error: "Please sign in again." }, 401);
  const body = await req.json().catch(() => null);
  if (!body || body.action !== "delete") return json({ error: "Bad request" }, 400);

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const luma = service.schema("luma");
  const caller = u.user.id, target = String(body.user_id || caller);
  if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ error: "Bad user id" }, 400);

  const { data: callerAdmin } = await luma.from("admin_users").select("user_id").eq("user_id", caller).maybeSingle();
  const { data: targetAdmin } = await luma.from("admin_users").select("user_id").eq("user_id", target).maybeSingle();
  const { data: prof } = await luma.from("profiles").select("email").eq("id", target).maybeSingle();
  if (!prof) return json({ error: "No such account." }, 404);

  if (target === caller) {
    if (callerAdmin) return json({ error: "An administrator account can not be deleted here." }, 403);
    if (String(body.confirm || "").trim().toLowerCase() !== String(prof.email || "").toLowerCase()) return json({ error: "Type your email address to confirm." }, 400);
  } else {
    if (!callerAdmin) return json({ error: "Not allowed." }, 403);
    if (targetAdmin) return json({ error: "An administrator account can not be deleted." }, 403);
  }

  try {
    let files = 0;
    for (const bucket of BUCKETS) {
      const paths = await listAll(service, bucket, target);
      for (let i = 0; i < paths.length; i += 100) await service.storage.from(bucket).remove(paths.slice(i, i + 100));
      files += paths.length;
    }
    const { error } = await service.auth.admin.deleteUser(target);
    if (error) return json({ error: error.message }, 500);
    await luma.from("admin_audit").insert({ admin_id: caller, action: "delete_account", target_user: target, target_email: prof.email || "", detail: { self: target === caller, files_removed: files } });
    return json({ ok: true, files_removed: files });
  } catch (e) {
    console.error("account delete failed:", (e as Error).message);
    return json({ error: "Could not delete the account: " + (e as Error).message }, 500);
  }
});
