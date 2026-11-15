const Stripe = require("stripe");
const { admin, getUser } = require("./_lib");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado" });

  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!sub || !sub.stripe_customer_id) return res.status(404).json({ error: "Sin suscripción" });

  const s = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: process.env.SITE_URL,
  });
  res.json({ url: s.url });
};
