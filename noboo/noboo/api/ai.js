const { admin, getUser, isActive, cors } = require("./_lib");

const DAILY_LIMIT = 60; // peticiones de IA por usuario y día

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado" });
  if (!(await isActive(user))) return res.status(402).json({ error: "Necesitas una suscripción activa" });

  const { prompt, images = [] } = req.body || {};
  if (!prompt || String(prompt).length > 8000 || !Array.isArray(images) || images.length > 3)
    return res.status(400).json({ error: "Petición no válida" });

  const day = new Date().toISOString().slice(0, 10);
  const { data: u } = await admin.from("ai_usage").select("n").eq("user_id", user.id).eq("day", day).maybeSingle();
  const n = u ? u.n : 0;
  if (n >= DAILY_LIMIT) return res.status(429).json({ error: "Has llegado al límite de hoy" });
  await admin.from("ai_usage").upsert({ user_id: user.id, day, n: n + 1 });

  const content = [
    ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
    { type: "text", text: String(prompt) },
  ];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 4000, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) return res.status(502).json({ error: "Error de IA" });
  res.json({ text: (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("") });
};
