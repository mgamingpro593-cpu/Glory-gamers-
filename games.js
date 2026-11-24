// API des jeux — /api/games
// GET  : liste publique des jeux ajoutés par l'admin
// POST : ajouter / supprimer un jeu, réservé à l'admin (jeton Google vérifié côté serveur)
const lib = (() => {
const module = { exports: {} };
// Code partagé par les fonctions du dossier api/
const crypto = require("crypto");

const CLIENT_ID = "260988431647-adjv3rtfn9jli63qdvo44gjbb41afudm.apps.googleusercontent.com";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "glorylvz985@gmail.com").toLowerCase();
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const hasDb = Boolean(REDIS_URL && REDIS_TOKEN);

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

async function getJson(key, fallback) {
  const raw = await redis(["GET", key]);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function setJson(key, value) {
  return redis(["SET", key, JSON.stringify(value)]);
}

// Vérifie auprès de Google le jeton et explique pourquoi il est refusé
async function inspectAdmin(idToken) {
  if (!idToken) return { ok: false, reason: "pas de jeton : déconnecte-toi puis reconnecte-toi avec Google." };

  let t;
  try {
    const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!response.ok) return { ok: false, reason: "Google a refusé le jeton (session expirée). Déconnecte-toi puis reconnecte-toi." };
    t = await response.json();
  } catch (e) {
    return { ok: false, reason: "le serveur n'arrive pas à joindre Google." };
  }

  if (t.aud !== CLIENT_ID) return { ok: false, reason: "le jeton ne vient pas du bon ID client Google." };
  if (String(t.email_verified) !== "true") return { ok: false, reason: "l'adresse e-mail du compte n'est pas vérifiée par Google." };
  if (Number(t.exp) * 1000 <= Date.now()) return { ok: false, reason: "session expirée. Déconnecte-toi puis reconnecte-toi." };
  if (String(t.email || "").toLowerCase() !== ADMIN_EMAIL) return { ok: false, reason: "le compte " + (t.email || "?") + " n'est pas autorisé." };
  return { ok: true, reason: "" };
}

async function verifyAdmin(idToken) {
  return (await inspectAdmin(idToken)).ok;
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

// Images envoyées depuis la galerie : /api/image?id=...
const MEDIA_RE = /^\/api\/image\?id=([a-f0-9]{32})$/;
function cleanMedia(v) {
  const s = String(v == null ? "" : v).trim();
  return MEDIA_RE.test(s) ? s : cleanUrl(s);
}
function mediaId(url) {
  const m = MEDIA_RE.exec(String(url || ""));
  return m ? m[1] : null;
}

// Liens de notification : page du site (game.html?id=...) ou adresse http(s)
const LINK_RE = /^[a-z0-9._-]+\.html(?:[?#][A-Za-z0-9=&%._#-]*)?$/i;
function cleanLink(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  return LINK_RE.test(s) ? s : cleanUrl(s);
}

function num(v, max) {
  const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
  if (!isFinite(n) || n <= 0 || n > max) return null;
  return Math.round(n * 10) / 10;
}

function readBody(req) {
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  return req.body || {};
}

function slug(name) {
  return (
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "jeu"
  );
}

// Notifications (dernières 50)
const NOTIF_KEY = "glory_notifs";
async function pushNotification(n) {
  const list = await getJson(NOTIF_KEY, []);
  const item = {
    id: Date.now().toString(36) + crypto.randomBytes(3).toString("hex"),
    title: text(n.title, 80),
    body: text(n.body, 240),
    url: cleanLink(n.url),
    createdAt: Date.now()
  };
  list.unshift(item);
  await setJson(NOTIF_KEY, list.slice(0, 50));
  return item;
}

module.exports = {
  hasDb, redis, getJson, setJson, verifyAdmin, inspectAdmin, text, cleanUrl, cleanMedia, mediaId,
  cleanLink, num, readBody, slug, pushNotification, NOTIF_KEY
};

return module.exports;
})();
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
