const { admin } = require("./_lib");

// Webhook de RevenueCat: avisa de compras de las tiendas (Apple y Google)
const ACTIVE = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "SUBSCRIPTION_EXTENDED", "NON_RENEWING_PURCHASE"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.REVENUECAT_WEBHOOK_AUTH || req.headers.authorization !== process.env.REVENUECAT_WEBHOOK_AUTH)
    return res.status(401).end();

  const e = (req.body && req.body.event) || {};
  const uid = e.app_user_id;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return res.json({ ignored: true });

  let status = null;
  if (ACTIVE.includes(e.type)) status = "active";
  else if (e.type === "EXPIRATION") status = "expired";
  if (!status) return res.json({ ignored: true }); // p. ej. CANCELLATION: sigue activa hasta que expire

  await admin.from("subscriptions").upsert({
    user_id: uid,
    status,
    current_period_end: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  res.json({ ok: true });
};
