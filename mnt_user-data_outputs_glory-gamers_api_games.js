// API des jeux — /api/games
// GET  : liste publique des jeux ajoutés par l'admin
// POST : ajouter / supprimer un jeu, réservé à l'admin (jeton Google vérifié côté serveur)
const lib = require("../lib/server");
const { hasDb, getJson, setJson, redis, verifyAdmin, text, cleanMedia, cleanUrl, mediaId, num, readBody, slug, pushNotification } = lib;

const KEY = "glory_games";
const CATEGORIES = ["Action", "Sport", "Course", "Aventure"];

const cleanMediaList = (v, max) => (Array.isArray(v) ? v : []).map(cleanMedia).filter(Boolean).slice(0, max);
const cleanLinks = (v, max) => (Array.isArray(v) ? v : []).map(cleanUrl).filter(Boolean).slice(0, max);

function cleanGame(g) {
  const name = text(g.name, 80);
  if (!name) throw new Error("Le nom du jeu est obligatoire.");

  const category = CATEGORIES.includes(g.category) ? g.category : "Action";
  const logo = cleanMedia(g.logo);
  const screenshots = cleanMediaList(g.screenshots, 10);

  return {
    id: slug(name) + "-" + Date.now().toString(36),
    name,
    category,
    genre: category,
    platform: text(g.platform, 30) || "Android",
    size: text(g.size, 30) || "-",
    version: text(g.version, 30) || "1.0",
    developer: text(g.developer, 80),
    description: text(g.description, 3000),
    info: text(g.info, 2000),
    logo,
    cover: cleanMedia(g.cover) || logo || screenshots[0] || "",
    screenshots,
    downloadUrls: cleanLinks(g.downloadUrls, 5),
    minAndroid: num(g.minAndroid, 20),
    minRam: num(g.minRam, 64),
    recRam: num(g.recRam, 64),
    minStorage: num(g.minStorage, 200),
    createdAt: Date.now()
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!hasDb) {
    if (req.method === "GET") return res.status(200).json([]);
    return res.status(500).json({ error: "Base de données non configurée (Upstash Redis dans Vercel > Storage)." });
  }

  try {
    if (req.method === "GET") return res.status(200).json(await getJson(KEY, []));

    if (req.method === "POST") {
      const body = readBody(req);

      if (!(await verifyAdmin(body.idToken))) {
        return res.status(401).json({ error: "Accès refusé : reconnecte-toi avec le compte admin." });
      }

      const games = await getJson(KEY, []);

      if (body.action === "add") {
        const game = cleanGame(body.game || {});
        games.push(game);
        await setJson(KEY, games);

        if (body.notify !== false) {
          try {
            await pushNotification({
              title: "Nouveau jeu : " + game.name,
              body: game.category + (game.developer ? " • " + game.developer : ""),
              url: "game.html?id=" + game.id
            });
          } catch (e) {
            // la notification est facultative
          }
        }
        return res.status(200).json(game);
      }

      if (body.action === "delete") {
        const target = games.find(g => g.id === body.id);
        await setJson(KEY, games.filter(g => g.id !== body.id));

        // supprime aussi les images du jeu
        if (target) {
          const ids = [target.logo, target.cover].concat(target.screenshots || []).map(mediaId).filter(Boolean);
          await Promise.all([...new Set(ids)].map(id => redis(["DEL", "img:" + id])));
        }
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
