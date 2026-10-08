// LUMA — Supabase helpers for the Bills module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/020_bills.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const BASE_COLS = "id, name, amount, category, recurrence, due_date, note, created_at";
  const COLS = BASE_COLS + ", active"; // `active` comes from migration 021 — fall back to the base columns until it has run
  const NO_ACTIVE = /active|schema cache/i;
  async function withCols(query) {
    const res = await query(COLS);
    return res.error && NO_ACTIVE.test(res.error.message) ? query(BASE_COLS) : res;
  }

  window.LumaBills = {
    async list() {
      return withCols((cols) => db().from("bills").select(cols).order("created_at", { ascending: true }));
    },

    // every payment (due_date of the cycle that was paid, and the amount paid)
    async listPayments() {
      return db().from("bill_payments").select("bill_id, due_date, amount, paid_at").limit(10000);
    },

    // user_id defaults to auth.uid() in the database
    async add(fields) {
      return withCols((cols) => db().from("bills").insert(fields).select(cols).single());
    },

    async update(id, fields) {
      return withCols((cols) => db().from("bills").update(fields).eq("id", id).select(cols).single());
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
