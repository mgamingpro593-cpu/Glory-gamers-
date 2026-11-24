// Images envoyées depuis la galerie — /api/image
// POST : envoyer une image (admin)  →  { url: "/api/image?id=..." }
// GET  : /api/image?id=...  →  l'image
const crypto = require("crypto");
const { hasDb, redis, verifyAdmin, readBody } = require("../lib/server");

const DATA_RE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_CHARS = 520000; // ~380 Ko d'image

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const id = String((req.query && req.query.id) || "");
      if (!hasDb || !/^[a-f0-9]{32}$/.test(id)) return res.status(404).end();

      const raw = await redis(["GET", "img:" + id]);
      if (!raw) return res.status(404).end();

      const image = JSON.parse(raw);
      res.setHeader("Content-Type", image.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(Buffer.from(image.data, "base64"));
    }

    if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      if (!hasDb) return res.status(500).json({ error: "Base de données non configurée (Upstash Redis dans Vercel > Storage)." });

      const body = readBody(req);
      if (!(await verifyAdmin(body.idToken))) {
        return res.status(401).json({ error: "Accès refusé : reconnecte-toi avec le compte admin." });
      }

      const dataUrl = String(body.dataUrl || "");
      if (dataUrl.length > MAX_CHARS) return res.status(413).json({ error: "Image trop lourde." });

      const m = DATA_RE.exec(dataUrl);
      if (!m) return res.status(400).json({ error: "Format d'image invalide (PNG, JPEG ou WebP)." });

      const id = crypto.randomBytes(16).toString("hex");
      await redis(["SET", "img:" + id, JSON.stringify({ mime: m[1], data: m[2] })]);
      return res.status(200).json({ url: "/api/image?id=" + id });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};
