const { getUser, accessInfo, isAdmin, cors } = require("./_lib");

// Dice a la app si esta persona tiene acceso y si es administradora
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado" });
  const i = await accessInfo(user);
  res.json({
    access: i.access,
    denied: i.denied,
    admin: isAdmin(user),
    mode: process.env.ACCESS_MODE === "invite" ? "invite" : "paid",
    contact: process.env.CONTACT_EMAIL || "",
  });
};
