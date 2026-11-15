const Stripe = require("stripe");
const { admin, getUser, cors } = require("./_lib");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado" });

  // Cancela la suscripción de Stripe (si tiene) para no seguir cobrando
  try {
    const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (sub && sub.stripe_customer_id) {
      const list = await stripe.subscriptions.list({ customer: sub.stripe_customer_id, status: "all" });
      for (const s of list.data) {
        if (["active", "trialing", "past_due"].includes(s.status)) await stripe.subscriptions.cancel(s.id);
      }
    }
  } catch (e) {}

  // Borra la cuenta; sus datos se eliminan en cascada
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return res.status(500).json({ error: "No se pudo eliminar" });
  res.json({ ok: true });
};
