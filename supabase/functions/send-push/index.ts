// LUMA — send-push Edge Function
//
// Delivers a Web Push message to every device a user has subscribed, whenever a
// row is inserted into luma.notifications. It is meant to be called by a
// Supabase Database Webhook (see README → "Background reminders & push").
//
// Secrets (supabase secrets set …):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com),
//   WEBHOOK_SECRET  — the same value you put in the webhook's  x-webhook-secret  header

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "luma" } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  // Database Webhook payload: { type: "INSERT", table, schema, record, old_record }
  const payload = await req.json().catch(() => null);
  const n = payload?.record;
  if (!n?.user_id) return new Response("ignored");

  // A burst of chat messages should buzz once, not once per message: only push for
  // the first message of a burst — skip it if the same sender already sent a
  // message in this conversation during the previous minute. (The bell and the
  // in-app toast still show every message.)
  if (n.type === "message" && n.ref && n.actor_id && n.created_at) {
    const since = new Date(new Date(n.created_at).getTime() - 60_000).toISOString();
    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", n.ref)
      .eq("sender_id", n.actor_id)
      .gte("created_at", since)
      .lt("created_at", n.created_at);
    if (count) return new Response("skipped: message burst");
  }

  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", n.user_id);
  if (error || !subs?.length) return new Response("no subscriptions");

  const message = JSON.stringify({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body ?? "",
    link: n.link ?? "",
  });

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
        { TTL: 3600 },
      );
    } catch (e) {
      // 404 / 410 = the browser unsubscribed or the subscription expired: forget it
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        console.error("push failed", s.endpoint, e?.statusCode ?? e);
      }
    }
  }));

  return new Response("sent");
});
