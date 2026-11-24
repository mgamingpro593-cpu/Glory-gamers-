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
  hasDb, redis, getJson, setJson, verifyAdmin, text, cleanUrl, cleanMedia, mediaId,
  cleanLink, num, readBody, slug, pushNotification, NOTIF_KEY
};
