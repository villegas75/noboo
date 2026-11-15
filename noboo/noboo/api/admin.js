const { admin, getUser, isAdmin, cors } = require("./_lib");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE = ["active", "trialing"];

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const me = await getUser(req);
  if (!me || !isAdmin(me)) return res.status(403).json({ error: "No autorizado" });
  const b = req.body || {};
  const inviteMode = process.env.ACCESS_MODE === "invite";

  try {
    if (b.action === "list") {
      const users = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error || !data || !data.users.length) break;
        users.push(...data.users);
        if (data.users.length < 200) break;
      }
      const { data: subs } = await admin.from("subscriptions").select("user_id,status");
      const { data: acl } = await admin.from("access_list").select("*");
      const sm = Object.fromEntries((subs || []).map((s) => [s.user_id, s.status]));
      const am = Object.fromEntries((acl || []).map((a) => [a.email, a]));
      const have = new Set(users.map((u) => (u.email || "").toLowerCase()));

      const rows = users.map((u) => {
        const e = (u.email || "").toLowerCase();
        const rule = am[e] ? am[e].mode : null;
        const sub = sm[u.id] || null;
        const access = rule === "deny" ? false : rule === "allow" ? true : !inviteMode && !!sub && ACTIVE.includes(sub);
        return { id: u.id, email: u.email, created: u.created_at, last: u.last_sign_in_at, confirmed: !!u.email_confirmed_at, sub, rule, access };
      });
      rows.sort((a, c) => (c.created || "").localeCompare(a.created || ""));
      const pending = (acl || []).filter((a) => !have.has(a.email)).map((a) => ({ email: a.email, rule: a.mode, note: a.note }));
      return res.json({ mode: inviteMode ? "invite" : "paid", users: rows, pending });
    }

    if (b.action === "set") {
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL.test(email)) return res.status(400).json({ error: "Correo no válido" });
      if (b.mode === null || b.mode === "none") {
        await admin.from("access_list").delete().eq("email", email);
      } else if (b.mode === "allow" || b.mode === "deny") {
        await admin.from("access_list").upsert({ email, mode: b.mode, note: String(b.note || "").slice(0, 120) });
      } else return res.status(400).json({ error: "Modo no válido" });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
};
