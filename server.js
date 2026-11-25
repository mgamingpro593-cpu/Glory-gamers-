// api/server.js : tout le serveur du site (games, image, notifications, status, me, users, support)
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
  CLIENT_ID, hasDb, redis, getJson, setJson, verifyAdmin, inspectAdmin, text, cleanUrl, cleanMedia, mediaId,
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
const extra = (() => {
const crypto = require("crypto");
const { CLIENT_ID, hasDb, redis, getJson, setJson, verifyAdmin, text, readBody } = lib;
const USERS = "glory_users";
const SUPPORT = "glory_support";
const SECRET = process.env.SESSION_SECRET || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "glory";
const OWNER = (process.env.ADMIN_EMAIL || "glorylvz985@gmail.com").toLowerCase();
const isOwner = u => !!u && String(u.email || "").toLowerCase() === OWNER;
const COLORS = ["blue", "green", "black"];
const mac = s => crypto.createHmac("sha256", SECRET).update(s).digest("hex");
function makeSession(email) {
  const p = Buffer.from(email).toString("base64url") + "." + (Date.now() + 30 * 86400000);
  return p + "." + mac(p);
}
function readSession(s) {
  const a = String(s || "").split(".");
  if (a.length !== 3) return null;
  const good = Buffer.from(mac(a[0] + "." + a[1]));
  const got = Buffer.from(a[2]);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  if (Number(a[1]) < Date.now()) return null;
  return Buffer.from(a[0], "base64url").toString();
}
async function googleUser(idToken) {
  if (!idToken) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!r.ok) return null;
    const t = await r.json();
    if (t.aud !== CLIENT_ID || String(t.email_verified) !== "true" || Number(t.exp) * 1000 <= Date.now()) return null;
    return { email: String(t.email || "").toLowerCase(), name: t.name || "", picture: t.picture || "" };
  } catch (e) {
    return null;
  }
}
async function identify(body) {
  const g = await googleUser(body.idToken);
  if (g && g.email) return g;
  const email = readSession(body.session);
  return email ? { email, name: "", picture: "" } : null;
}
async function getUser(email) {
  const raw = await redis(["HGET", USERS, email]);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function planOf(u) {
  if (isOwner(u)) return "elite";
  if (!u || !u.plan || u.plan === "free") return "free";
  return u.until && u.until < Date.now() ? "free" : u.plan;
}
const guard = fn => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  if (!hasDb) return res.status(500).json({ error: "Base de données non configurée (Upstash Redis dans Vercel > Storage)." });
  try {
    return await fn(readBody(req), res);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};
const denyAdmin = res => res.status(401).json({ error: "Accès refusé : reconnecte-toi avec le compte admin." });

// /api/me : statut d'abonnement du visiteur connecté (et enregistrement dans la liste des utilisateurs)
const me = guard(async (body, res) => {
  const who = await identify(body);
  if (!who) return res.status(401).json({ error: "Connexion requise." });
  const now = Date.now();
  let u = await getUser(who.email);
  if (!u) u = { email: who.email, plan: "free", until: 0, createdAt: now, lastSeen: 0 };
  const name = text(who.name, 80);
  if ((name && name !== u.name) || now - (u.lastSeen || 0) > 3600000) {
    if (name) u.name = name;
    if (who.picture) u.picture = text(who.picture, 300);
    u.lastSeen = now;
    await redis(["HSET", USERS, who.email, JSON.stringify(u)]);
  }
  const plan = planOf(u);
  if (plan === "elite" && COLORS.includes(body.badgeColor) && u.badgeColor !== body.badgeColor) {
    u.badgeColor = body.badgeColor;
    await redis(["HSET", USERS, who.email, JSON.stringify(u)]);
  }
  return res.status(200).json({ email: who.email, plan, until: isOwner(u) ? 0 : u.until || 0, premium: plan !== "free", badgeColor: u.badgeColor || "blue", session: makeSession(who.email) });
});

// /api/users : liste des utilisateurs et attribution des abonnements (admin)
const users = guard(async (body, res) => {
  if (!(await verifyAdmin(body.idToken))) return denyAdmin(res);
  if (body.action === "list") {
    const raw = await redis(["HGETALL", USERS]);
    const vals = Array.isArray(raw) ? raw.filter((_, i) => i % 2 === 1) : Object.values(raw || {});
    const out = [];
    vals.forEach(v => {
      try {
        const u = JSON.parse(v);
        out.push({ email: u.email, name: u.name || "", plan: planOf(u), until: isOwner(u) ? 0 : u.until || 0, badgeColor: u.badgeColor || "blue", lastSeen: u.lastSeen || 0, createdAt: u.createdAt || 0 });
      } catch (e) {}
    });
    out.sort((a, b) => b.lastSeen - a.lastSeen);
    return res.status(200).json(out);
  }
  if (body.action === "setPlan") {
    const email = text(body.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Adresse e-mail invalide." });
    const plan = ["free", "pro", "elite"].includes(body.plan) ? body.plan : "free";
    const days = Math.max(0, Math.min(3650, parseInt(body.days, 10) || 0));
    const u = (await getUser(email)) || { email, createdAt: Date.now(), lastSeen: 0 };
    u.plan = plan;
    u.until = plan !== "free" && days ? Date.now() + days * 86400000 : 0;
    await redis(["HSET", USERS, email, JSON.stringify(u)]);
    return res.status(200).json({ ok: true, plan, until: u.until });
  }
  return res.status(400).json({ error: "Action inconnue." });
});

// /api/support : questions des joueurs et signalements de bugs
const support = guard(async (body, res) => {
  const list = await getJson(SUPPORT, []);

  if (body.action === "send" || body.action === "mine") {
    const who = await identify(body);
    if (!who) return res.status(401).json({ error: "Connexion requise : reconnecte-toi avec Google." });
    if (body.action === "mine") {
      return res.status(200).json(list.filter(i => i.email === who.email).slice(0, 30)
        .map(i => ({ id: i.id, kind: i.kind, text: i.text, createdAt: i.createdAt, reply: i.reply || "", repliedAt: i.repliedAt || 0 })));
    }
    const msg = text(body.text, 1000);
    if (msg.length < 3) return res.status(400).json({ error: "Écris un message un peu plus long." });
    if (list.filter(i => i.email === who.email && Date.now() - i.createdAt < 600000).length >= 5) {
      return res.status(429).json({ error: "Trop de messages d'un coup : réessaie dans quelques minutes." });
    }
    const u = await getUser(who.email);
    list.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: body.kind === "bug" ? "bug" : "question",
      email: who.email,
      name: who.name || (u && u.name) || who.email.split("@")[0],
      plan: planOf(u || { email: who.email }),
      badgeColor: (u && u.badgeColor) || "blue",
      text: msg,
      page: text(body.page, 80),
      createdAt: Date.now(),
      reply: "",
      repliedAt: 0
    });
    await setJson(SUPPORT, list.slice(0, 300));
    return res.status(200).json({ ok: true });
  }

  if (!(await verifyAdmin(body.idToken))) return denyAdmin(res);
  if (body.action === "list") return res.status(200).json(list);
  if (body.action === "reply") {
    const item = list.find(i => i.id === body.id);
    if (!item) return res.status(404).json({ error: "Message introuvable." });
    item.reply = text(body.text, 1000);
    item.repliedAt = item.reply ? Date.now() : 0;
    await setJson(SUPPORT, list);
    return res.status(200).json({ ok: true });
  }
  if (body.action === "delete") {
    await setJson(SUPPORT, list.filter(i => i.id !== body.id));
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: "Action inconnue." });
});

return { me, users, support };
})();
const handlers = {
  games: handleGames,
  image: handleImage,
  notifications: handleNotifications,
  status: handleStatus,
  me: extra.me,
  users: extra.users,
  support: extra.support
};
module.exports = async (req, res) => {
  const name = String((req.query && req.query.name) || "");
  const handler = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : null;
  if (!handler) return res.status(404).json({ error: "Introuvable." });
  return handler(req, res);
};
