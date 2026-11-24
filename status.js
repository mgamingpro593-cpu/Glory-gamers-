// Diagnostic — /api/status
// Dit si le serveur, la base de données et l'accès admin fonctionnent
const { hasDb, redis, readBody, inspectAdmin } = (() => {
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
