// API des jeux (fonction serverless Vercel) — /api/games
// GET  : liste publique des jeux ajoutés par l'admin
// POST : ajouter / supprimer un jeu, réservé à l'admin (jeton Google vérifié côté serveur)
const CLIENT_ID = "260988431647-adjv3rtfn9jli63qdvo44gjbb41afudm.apps.googleusercontent.com";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "glorylvz985@gmail.com").toLowerCase();
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "glory_games";
const CATEGORIES = ["Action", "Sport", "Course", "Aventure"];

async function redis(command) {
  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function readGames() {
  const raw = await redis(["GET", KEY]);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeGames(list) {
  return redis(["SET", KEY, JSON.stringify(list)]);
}

// Vérifie auprès de Google que le jeton est valide et appartient bien à l'admin
async function verifyAdmin(idToken) {
  if (!idToken) return false;
  const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
  if (!response.ok) return false;
  const t = await response.json();
  return (
    t.aud === CLIENT_ID &&
    String(t.email_verified) === "true" &&
    String(t.email || "").toLowerCase() === ADMIN_EMAIL &&
    Number(t.exp) * 1000 > Date.now()
  );
}

const text = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

function cleanUrl(v) {
  try {
    const u = new URL(String(v).trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch (e) {
    return "";
  }
}

function cleanList(v, max) {
  return (Array.isArray(v) ? v : []).map(cleanUrl).filter(Boolean).slice(0, max);
}

function slug(name) {
  return (
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "jeu"
  );
}

function cleanGame(g) {
  const name = text(g.name, 80);
  if (!name) throw new Error("Le nom du jeu est obligatoire.");

  const screenshots = cleanList(g.screenshots, 10);
  const category = CATEGORIES.includes(g.category) ? g.category : "Action";

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
    cover: cleanUrl(g.cover) || screenshots[0] || "",
    screenshots,
    downloadUrls: cleanList(g.downloadUrls, 5),
    createdAt: Date.now()
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!REDIS_URL || !REDIS_TOKEN) {
    if (req.method === "GET") return res.status(200).json([]);
    return res.status(500).json({ error: "Base de données non configurée (Upstash Redis dans Vercel > Storage)." });
  }

  try {
    if (req.method === "GET") return res.status(200).json(await readGames());

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

      if (!(await verifyAdmin(body.idToken))) {
        return res.status(401).json({ error: "Accès refusé : reconnecte-toi avec le compte admin." });
      }

      const games = await readGames();

      if (body.action === "add") {
        const game = cleanGame(body.game || {});
        games.push(game);
        await writeGames(games);
        return res.status(200).json(game);
      }

      if (body.action === "delete") {
        await writeGames(games.filter(g => g.id !== body.id));
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
