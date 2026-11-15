const { admin, getUser, isActive, cors, takeUsage } = require("./_lib");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
const clean = (s, n) => String(s || "").trim().slice(0, n);
const goalOf = (g) => (g === "fat" ? "fat" : "muscle");
const UUID = /^[0-9a-f-]{36}$/i;
const AI_PER_DAY = 60;

// Lo que ve cada jugador de un reto (nunca fotos: no se guardan)
function view(c, uid, entries) {
  const mineIsCreator = c.creator === uid;
  const mine = entries.find((e) => e.user_id === uid);
  const opp = entries.find((e) => e.user_id !== uid);
  const out = {
    id: c.id,
    code: c.code,
    status: c.status,
    myName: mineIsCreator ? c.creator_name : c.opponent_name,
    oppName: mineIsCreator ? c.opponent_name : c.creator_name,
    myGoal: mineIsCreator ? c.creator_goal : c.opponent_goal,
    submittedMe: !!mine,
    submittedOpp: !!opp,
  };
  if (c.status === "done" && mine && opp) {
    const pick = (e) => ({ score: e.score, confidence: e.confidence, note: e.note });
    out.result = { me: pick(mine), opp: pick(opp), winner: c.draw ? "draw" : c.winner === uid ? "me" : "opp" };
  }
  return out;
}

async function loadChallenge(id, uid) {
  if (!UUID.test(String(id || ""))) return null;
  const { data: c } = await admin.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!c || (c.creator !== uid && c.opponent !== uid)) return null;
  const { data: entries } = await admin.from("challenge_entries").select("*").eq("challenge_id", id);
  return { c, entries: entries || [] };
}

async function judge(goal, images) {
  const g = goal === "fat" ? "perder grasa" : "ganar músculo";
  const prompt =
    `Eres un evaluador de progreso físico respetuoso y objetivo. Recibes 2 fotos de la misma persona: la primera es el INICIO y la segunda la ACTUAL. Su objetivo es ${g}. ` +
    `Valora SOLO el cambio visible hacia ese objetivo, no la estética absoluta ni la compares con nadie. ` +
    `Si las fotos no muestran a una persona adulta, no son comparables, o la persona parece menor de edad, responde valid:false. ` +
    `Si la luz, la pose o el encuadre difieren mucho, baja la confianza y dilo en la nota. ` +
    `Responde SOLO JSON: {"valid":true,"score":número entero de 0 a 100 (0 sin cambios visibles, 100 cambio excepcional),"confidence":"alta|media|baja","note":"máximo 20 palabras, tono positivo y objetivo"}`;
  const content = [
    ...images.map((d) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } })),
    { type: "text", text: prompt },
  ];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 300, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const t = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const a = t.indexOf("{"), z = t.lastIndexOf("}");
  try { return JSON.parse(t.slice(a, z + 1)); } catch (e) { return null; }
}

// Cuando los dos han enviado sus fotos: decide ganador (una sola vez) y suma estadísticas
async function finalize(c) {
  const { data: entries } = await admin.from("challenge_entries").select("*").eq("challenge_id", c.id);
  if (!entries || entries.length < 2) return { c, entries: entries || [] };
  const [a, b] = entries;
  const draw = Math.abs(a.score - b.score) <= 3;
  const winner = draw ? null : a.score > b.score ? a.user_id : b.user_id;
  const { data: upd } = await admin.from("challenges").update({ status: "done", winner, draw }).eq("id", c.id).eq("status", "active").select();
  if (upd && upd.length) {
    for (const e of entries) {
      const { data: st } = await admin.from("player_stats").select("*").eq("user_id", e.user_id).maybeSingle();
      await admin.from("player_stats").upsert({
        user_id: e.user_id,
        played: (st ? st.played : 0) + 1,
        wins: (st ? st.wins : 0) + (winner === e.user_id ? 1 : 0),
      });
    }
  }
  const { data: c2 } = await admin.from("challenges").select("*").eq("id", c.id).maybeSingle();
  return { c: c2 || c, entries };
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado" });
  if (!(await isActive(user))) return res.status(402).json({ error: "Necesitas una suscripción activa" });
  const uid = user.id;
  const b = req.body || {};

  try {
    if (b.action === "stats") {
      const { data } = await admin.from("player_stats").select("played,wins").eq("user_id", uid).maybeSingle();
      return res.json({ played: data ? data.played : 0, wins: data ? data.wins : 0 });
    }

    if (b.action === "create") {
      const { data: open } = await admin.from("challenges").select("id").eq("creator", uid).neq("status", "done");
      if (open && open.length >= 5) return res.status(400).json({ error: "Ya tienes 5 retos abiertos" });
      for (let i = 0; i < 5; i++) {
        const { data, error } = await admin
          .from("challenges")
          .insert({ code: genCode(), creator: uid, creator_name: clean(b.name, 30) || "Jugador", creator_goal: goalOf(b.goal) })
          .select()
          .single();
        if (!error && data) return res.json({ challenge: view(data, uid, []) });
      }
      return res.status(500).json({ error: "No se pudo crear el reto" });
    }

    if (b.action === "join") {
      const code = clean(b.code, 10).toUpperCase();
      const { data: c } = await admin.from("challenges").select("*").eq("code", code).maybeSingle();
      if (!c) return res.status(404).json({ error: "Código no encontrado" });
      if (c.creator === uid) return res.status(400).json({ error: "No puedes unirte a tu propio reto" });
      if (c.opponent && c.opponent !== uid) return res.status(409).json({ error: "Este reto ya está completo" });
      let cur = c;
      if (!c.opponent) {
        const { data: upd } = await admin
          .from("challenges")
          .update({ opponent: uid, opponent_name: clean(b.name, 30) || "Jugador", opponent_goal: goalOf(b.goal), status: "active" })
          .eq("id", c.id)
          .is("opponent", null)
          .select();
        if (!upd || !upd.length) return res.status(409).json({ error: "Este reto ya está completo" });
        cur = upd[0];
      }
      const { data: entries } = await admin.from("challenge_entries").select("*").eq("challenge_id", cur.id);
      return res.json({ challenge: view(cur, uid, entries || []) });
    }

    if (b.action === "list") {
      const { data: cs } = await admin
        .from("challenges")
        .select("*")
        .or(`creator.eq.${uid},opponent.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(20);
      const ids = (cs || []).map((c) => c.id);
      const { data: es } = ids.length ? await admin.from("challenge_entries").select("*").in("challenge_id", ids) : { data: [] };
      return res.json({ list: (cs || []).map((c) => view(c, uid, (es || []).filter((e) => e.challenge_id === c.id))) });
    }

    if (b.action === "get") {
      const l = await loadChallenge(b.id, uid);
      if (!l) return res.status(404).json({ error: "Reto no encontrado" });
      return res.json({ challenge: view(l.c, uid, l.entries) });
    }

    if (b.action === "delete") {
      const l = await loadChallenge(b.id, uid);
      if (!l) return res.status(404).json({ error: "Reto no encontrado" });
      await admin.from("challenges").delete().eq("id", l.c.id);
      return res.json({ ok: true });
    }

    if (b.action === "submit") {
      const l = await loadChallenge(b.id, uid);
      if (!l) return res.status(404).json({ error: "Reto no encontrado" });
      if (l.c.status !== "active") return res.status(400).json({ error: "El reto todavía no está activo" });
      if (l.entries.some((e) => e.user_id === uid)) return res.status(409).json({ error: "Ya enviaste tus fotos" });
      const imgs = b.images;
      if (!Array.isArray(imgs) || imgs.length !== 2 || imgs.some((d) => typeof d !== "string" || d.length > 2500000))
        return res.status(400).json({ error: "Fotos no válidas" });
      if (!(await takeUsage(uid, 1, AI_PER_DAY))) return res.status(429).json({ error: "Has llegado al límite de hoy" });

      const mineIsCreator = l.c.creator === uid;
      const goal = mineIsCreator ? l.c.creator_goal : l.c.opponent_goal;
      const name = mineIsCreator ? l.c.creator_name : l.c.opponent_name;
      const j = await judge(goal, imgs);
      if (!j) return res.status(502).json({ error: "No se pudo analizar. Inténtalo de nuevo." });
      if (!j.valid) return res.json({ invalid: true });

      const score = Math.max(0, Math.min(100, Math.round(Number(j.score)) || 0));
      const confidence = ["alta", "media", "baja"].includes(j.confidence) ? j.confidence : "media";
      const { error } = await admin.from("challenge_entries").insert({
        challenge_id: l.c.id, user_id: uid, name, goal, score, confidence, note: clean(j.note, 160),
      });
      if (error) return res.status(409).json({ error: "Ya enviaste tus fotos" });

      const f = await finalize(l.c);
      return res.json({ challenge: view(f.c, uid, f.entries) });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
};
