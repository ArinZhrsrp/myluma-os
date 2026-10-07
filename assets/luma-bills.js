// LUMA — Supabase helpers for the Bills module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/020_bills.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, name, amount, category, recurrence, due_date, note, created_at";

  window.LumaBills = {
    async list() {
      return db().from("bills").select(COLS).order("created_at", { ascending: true });
    },

    // every payment (due_date of the cycle that was paid, and the amount paid)
    async listPayments() {
      return db().from("bill_payments").select("bill_id, due_date, amount").limit(10000);
    },

    // user_id defaults to auth.uid() in the database
    async add(fields) {
      return db().from("bills").insert(fields).select(COLS).single();
    },

    async update(id, fields) {
      return db().from("bills").update(fields).eq("id", id).select(COLS).single();
    },

    async remove(id) {
      return db().from("bills").delete().eq("id", id);
    },

    // mark one cycle of a bill paid / unpaid
    async setPaid(billId, dueKey, paid, amount) {
      if (paid) return db().from("bill_payments").upsert({ bill_id: billId, due_date: dueKey, amount }, { onConflict: "bill_id,due_date" });
      return db().from("bill_payments").delete().eq("bill_id", billId).eq("due_date", dueKey);
    },

    // rows = [{ bill_id, due_date, amount }]
    async payMany(rows) {
      return db().from("bill_payments").upsert(rows, { onConflict: "bill_id,due_date" });
    },
  };
})();
