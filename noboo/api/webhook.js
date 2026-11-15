const Stripe = require("stripe");
const { admin } = require("./_lib");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const raw = (req) =>
  new Promise((ok, ko) => {
    const c = [];
    req.on("data", (d) => c.push(d));
    req.on("end", () => ok(Buffer.concat(c)));
    req.on("error", ko);
  });

module.exports = async (req, res) => {
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(await raw(req), req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send("Firma no válida");
  }

  if (ev.type.startsWith("customer.subscription.")) {
    const s = ev.data.object;
    const uid = s.metadata && s.metadata.user_id;
    if (uid) {
      const end = (s.items && s.items.data[0] && s.items.data[0].current_period_end) || s.current_period_end;
      await admin.from("subscriptions").upsert({
        user_id: uid,
        stripe_customer_id: s.customer,
        status: s.status,
        current_period_end: end ? new Date(end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  res.json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
