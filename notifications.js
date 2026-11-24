// Notifications du site — /api/notifications
// GET  : dernières notifications (publiques)
// POST : envoyer / supprimer une notification (admin)
const { hasDb, getJson, setJson, verifyAdmin, text, readBody, pushNotification, NOTIF_KEY } = require("../lib/server");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!hasDb) {
    if (req.method === "GET") return res.status(200).json([]);
    return res.status(500).json({ error: "Base de données non configurée (Upstash Redis dans Vercel > Storage)." });
  }

  try {
    if (req.method === "GET") return res.status(200).json(await getJson(NOTIF_KEY, []));

    if (req.method === "POST") {
      const body = readBody(req);

      if (!(await verifyAdmin(body.idToken))) {
        return res.status(401).json({ error: "Accès refusé : reconnecte-toi avec le compte admin." });
      }

      if (body.action === "send") {
        if (!text(body.title, 80)) return res.status(400).json({ error: "Le titre est obligatoire." });
        return res.status(200).json(await pushNotification(body));
      }

      if (body.action === "delete") {
        const list = await getJson(NOTIF_KEY, []);
        await setJson(NOTIF_KEY, list.filter(n => n.id !== body.id));
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Action inconnue." });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};
