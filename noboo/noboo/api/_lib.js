const { createClient } = require("@supabase/supabase-js");

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  if (!t) return null;
  const { data, error } = await admin.auth.getUser(t);
  return error ? null : data.user;
}

const ACTIVE = ["active", "trialing"];

function isAdmin(user) {
  const list = (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  return !!(user && user.email && user.email_confirmed_at && list.includes(user.email.toLowerCase()));
}

// Quién puede usar la app: admin > regla del administrador (allow/deny por correo) > modo > suscripción
async function accessInfo(user) {
  if (isAdmin(user)) return { access: true, denied: false };
  const email = (user.email || "").toLowerCase();
  if (email && user.email_confirmed_at) {
    const { data } = await admin.from("access_list").select("mode").eq("email", email).maybeSingle();
    if (data && data.mode === "deny") return { access: false, denied: true };
    if (data && data.mode === "allow") return { access: true, denied: false };
  }
  if (process.env.ACCESS_MODE === "invite") return { access: false, denied: false };
  const { data: s } = await admin.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
  return { access: !!s && ACTIVE.includes(s.status), denied: false };
}

async function isActive(user) {
  return (await accessInfo(user)).access;
}

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

// Límite diario de usos de IA por usuario (devuelve false si se supera)
async function takeUsage(uid, n, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("ai_usage").select("n").eq("user_id", uid).eq("day", day).maybeSingle();
  const used = data ? data.n : 0;
  if (used + n > limit) return false;
  await admin.from("ai_usage").upsert({ user_id: uid, day, n: used + n });
  return true;
}

module.exports = { admin, getUser, isActive, isAdmin, accessInfo, cors, takeUsage };
