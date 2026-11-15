const { createClient } = require("@supabase/supabase-js");

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  if (!t) return null;
  const { data, error } = await admin.auth.getUser(t);
  return error ? null : data.user;
}

async function isActive(uid) {
  const { data } = await admin.from("subscriptions").select("status").eq("user_id", uid).maybeSingle();
  return !!data && ["active", "trialing"].includes(data.status);
}

module.exports = { admin, getUser, isActive };
