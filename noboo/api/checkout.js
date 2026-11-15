const Stripe = require("stripe");
const { admin, getUser } = require("./_lib");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado" });

  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  const site = process.env.SITE_URL;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    ...(sub && sub.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: user.email }),
    client_reference_id: user.id,
    subscription_data: { trial_period_days: 7, metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${site}/?paid=1`,
    cancel_url: `${site}/`,
  });
  res.json({ url: session.url });
};
