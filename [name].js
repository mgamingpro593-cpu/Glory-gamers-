// api/[name].js : tout le serveur du site (games, image, notifications, status)
const lib = (() => {
const module = { exports: {} };
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
const MEDIA_RE = /^\/api\/image\?id=([a-f0-9]{32})$/;
function cleanMedia(v) {
  const s = String(v == null ? "" : v).trim();
  return MEDIA_RE.test(s) ? s : cleanUrl(s);
}
function mediaId(url) {
  const m = MEDIA_RE.exec(String(url || ""));
  return m ? m[1] : null;
}
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
const handleGames = (() => {
const module = { exports: {} };
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
          }
        }
        return res.status(200).json(game);
      }
      if (body.action === "delete") {
        const target = games.find(g => g.id === body.id);
        await setJson(KEY, games.filter(g => g.id !== body.id));
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
return module.exports;
})();
const handleImage = (() => {
const module = { exports: {} };
const crypto = require("crypto");
const { hasDb, redis, verifyAdmin, readBody } = lib;
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
return module.exports;
})();
const handleNotifications = (() => {
const module = { exports: {} };
const { hasDb, getJson, setJson, verifyAdmin, text, readBody, pushNotification, NOTIF_KEY } = lib;
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
return module.exports;
})();
const handleStatus = (() => {
const module = { exports: {} };
const { hasDb, redis, readBody, inspectAdmin } = lib;
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const body = req.method === "POST" ? readBody(req) : {};
    const admin = await inspectAdmin(body.idToken);
    const out = {
      api: true,
      dbConfigured: hasDb,
      dbRead: false,
      dbWrite: null,
      dbError: "",
      adminOk: admin.ok,
      adminReason: admin.reason
    };
    if (hasDb) {
      try {
        await redis(["PING"]);
        out.dbRead = true;
        if (admin.ok) {
          await redis(["SET", "glory_health", "ok", "EX", "30"]);
          out.dbWrite = true;
        }
      } catch (e) {
        out.dbError = e.message;
        if (admin.ok) out.dbWrite = false;
      }
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};
return module.exports;
})();
const handlers = {
  games: handleGames,
  image: handleImage,
  notifications: handleNotifications,
  status: handleStatus
};
module.exports = async (req, res) => {
  const name = String((req.query && req.query.name) || "");
  const handler = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : null;
  if (!handler) return res.status(404).json({ error: "Introuvable." });
  return handler(req, res);
};
