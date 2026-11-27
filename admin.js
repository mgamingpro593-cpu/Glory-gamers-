// ESPACE ADMIN — jeux (logo + captures depuis la galerie) et notifications
const ADMIN_EMAIL = "glorylvz985@gmail.com";
const MAX_SHOTS = 8;

const gate = document.getElementById("adminGate");
const panel = document.getElementById("adminPanel");
const form = document.getElementById("gameForm");
const formMsg = document.getElementById("formMsg");
const list = document.getElementById("adminList");

const logoPreview = document.getElementById("logoPreview");
const logoInput = document.getElementById("logoInput");
const logoBtn = document.getElementById("logoBtn");
const logoClear = document.getElementById("logoClear");
const shotsPreview = document.getElementById("shotsPreview");
const shotsInput = document.getElementById("shotsInput");
const shotsBtn = document.getElementById("shotsBtn");

const notifForm = document.getElementById("notifForm");
const notifMsg = document.getElementById("notifMsg");
const notifList = document.getElementById("notifList");

let logoData = "";
let shotsData = [];

// ---------- Accès ----------
function tokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp * 1000 < Date.now() + 30000;
  } catch (e) {
    return true;
  }
}

function showGate(message, buttonLabel, onClick) {
  panel.hidden = true;
  gate.hidden = false;
  gate.innerHTML = "";

  const p = document.createElement("p");
  p.textContent = message;
  gate.appendChild(p);

  if (buttonLabel) {
    const b = document.createElement("button");
    b.className = "login-btn";
    b.textContent = buttonLabel;
    b.addEventListener("click", onClick);
    gate.appendChild(b);
  }
}

function checkAccess() {
  if (!window.Auth) return showGate("Chargement de la connexion…");

  const user = Auth.getUser();

  if (!user) {
    return showGate("Connecte-toi avec le compte administrateur pour accéder à cet espace.", "Connexion", Auth.openLogin);
  }
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return showGate("Accès réservé à l'administrateur. Tu es connecté avec " + user.email + ".", "Changer de compte", () => {
      Auth.logout();
      Auth.openLogin();
    });
  }
  if (!user.token || tokenExpired(user.token)) {
    return showGate("Ta session admin a expiré. Reconnecte-toi avec Google.", "Se reconnecter", () => {
      Auth.logout();
      Auth.openLogin();
    });
  }

  gate.hidden = true;
  panel.hidden = false;
  loadList();
  loadNotifs();
  runStatus();
  if (window.loadAdminExtras) window.loadAdminExtras();
}

function setMessage(box, text, type) {
  box.textContent = text;
  box.className = "auth-msg full " + type;
  box.hidden = false;
}

async function post(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error("Connexion au serveur impossible. Vérifie ton internet.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data && data.error) throw new Error(data.error);
    if (response.status === 404) throw new Error("Le serveur (dossier api) n'est pas en ligne : vérifie que le fichier api/[name].js est bien en ligne dans ton projet, puis redéploie.");
    if (response.status === 413) throw new Error("Les images sont trop lourdes pour le serveur.");
    throw new Error("Erreur du serveur (" + response.status + "). Regarde les logs de la fonction dans Vercel.");
  }
  return data || {};
}

// ---------- État du système (aide à trouver pourquoi un ajout échoue) ----------
const statusList = document.getElementById("statusList");

async function runStatus() {
  statusList.innerHTML = "";
  const add = (ok, text) => {
    const li = document.createElement("li");
    li.textContent = (ok ? "✅ " : "❌ ") + text;
    statusList.appendChild(li);
  };

  const user = window.Auth && Auth.getUser();
  let s;
  try {
    const response = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: user && user.token })
    });
    if (response.status === 404) {
      add(false, "Le serveur (dossier api) n'est pas en ligne : vérifie que le fichier api/[name].js est bien en ligne dans ton projet, puis redéploie.");
      return;
    }
    s = await response.json();
  } catch (e) {
    add(false, "Impossible de joindre le serveur : " + e.message);
    return;
  }

  add(true, "Serveur en ligne.");

  if (!s.dbConfigured) add(false, "Base de données non connectée : dans Vercel, onglet Storage, crée Upstash Redis et relie-le au projet, puis redéploie.");
  else if (!s.dbRead) add(false, "Base de données injoignable : " + (s.dbError || "erreur inconnue"));
  else if (s.dbWrite === false) add(false, "Base de données connectée mais écriture impossible : " + (s.dbError || "erreur inconnue"));
  else add(true, "Base de données connectée" + (s.dbWrite ? " (lecture et écriture)." : "."));

  if (s.adminOk) add(true, "Le serveur te reconnaît comme administrateur.");
  else add(false, "Accès admin refusé : " + s.adminReason);
}

document.getElementById("statusRefresh").addEventListener("click", runStatus);

// ---------- Images de la galerie (réduites avant l'envoi) ----------
function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, { square, maxSide, type }) {
  const img = await readImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const dw = Math.round(img.width * scale);
  const dh = Math.round(img.height * scale);
  let w = dw, h = dh, dx = 0, dy = 0;

  if (square) {
    // Le logo est gardé en entier (aucun recadrage) : on le centre dans un carré
    w = h = Math.max(dw, dh);
    dx = Math.round((w - dw) / 2);
    dy = Math.round((h - dh) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);

  let quality = 0.85;
  let data = canvas.toDataURL(type, quality);
  while (type === "image/jpeg" && data.length > 380000 && quality > 0.45) {
    quality -= 0.1;
    data = canvas.toDataURL(type, quality);
  }
  if (data.length > 500000) throw new Error("Image trop lourde.");
  return data;
}

function renderLogo() {
  logoPreview.innerHTML = "";
  if (logoData) {
    const img = document.createElement("img");
    img.src = logoData;
    img.alt = "";
    logoPreview.appendChild(img);
  } else {
    logoPreview.textContent = "Aucun logo";
  }
  logoClear.hidden = !logoData;
  logoBtn.textContent = logoData ? "Changer le logo" : "Choisir le logo";
}

function renderShots() {
  shotsPreview.innerHTML = "";
  shotsData.forEach((data, index) => {
    const box = document.createElement("div");
    box.className = "shot-thumb";
    const img = document.createElement("img");
    img.src = data;
    img.alt = "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", "Retirer");
    remove.addEventListener("click", () => {
      shotsData.splice(index, 1);
      renderShots();
    });
    box.append(img, remove);
    shotsPreview.appendChild(box);
  });
  shotsBtn.disabled = shotsData.length >= MAX_SHOTS;
}

logoBtn.addEventListener("click", () => logoInput.click());
logoClear.addEventListener("click", () => { logoData = ""; renderLogo(); });

logoInput.addEventListener("change", async () => {
  const file = logoInput.files[0];
  logoInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return setMessage(formMsg, "Choisis un fichier image.", "error");

  try {
    let data = await compressImage(file, { square: true, maxSide: 512, type: "image/png" });
    if (data.length > 300000) data = await compressImage(file, { square: true, maxSide: 512, type: "image/jpeg" });
    logoData = data;
    formMsg.hidden = true;
    renderLogo();
  } catch (e) {
    setMessage(formMsg, "Impossible de lire cette image.", "error");
  }
});

shotsBtn.addEventListener("click", () => shotsInput.click());

shotsInput.addEventListener("change", async () => {
  const files = Array.from(shotsInput.files).filter(f => f.type.startsWith("image/"));
  shotsInput.value = "";
  formMsg.hidden = true;

  for (const file of files) {
    if (shotsData.length >= MAX_SHOTS) break;
    try {
      shotsData.push(await compressImage(file, { maxSide: 1280, type: "image/jpeg" }));
      renderShots();
    } catch (e) {
      setMessage(formMsg, "Une image n'a pas pu être lue.", "error");
    }
  }
});

// ---------- Liste des jeux ----------
async function loadList() {
  list.textContent = "Chargement…";
  try {
    const response = await fetch("/api/games");
    renderList(await response.json());
  } catch (e) {
    list.textContent = "Impossible de joindre le serveur (/api/games). Le site doit être en ligne sur Vercel, avec le dossier api.";
  }
}

function renderList(games) {
  list.innerHTML = "";
  if (!games.length) {
    list.textContent = "Aucun jeu ajouté pour le moment.";
    return;
  }

  games.forEach(game => {
    const row = document.createElement("div");
    row.className = "admin-row";

    const name = document.createElement("span");
    name.textContent = game.name + " · " + game.category + (game.premium ? " · ⭐ Premium" : "");

    const actions = document.createElement("div");
    const view = document.createElement("a");
    view.href = "game.html?id=" + encodeURIComponent(game.id);
    view.textContent = "Voir";

    const del = document.createElement("button");
    del.textContent = "Supprimer";
    del.addEventListener("click", async () => {
      if (!confirm("Supprimer « " + game.name + " » ?")) return;
      const user = Auth.getUser();
      try {
        await post("/api/games", { action: "delete", id: game.id, idToken: user && user.token });
        loadList();
      } catch (err) {
        alert(err.message);
      }
    });

    const toggle = document.createElement("button");
    toggle.style.cssText = "background:#29213f;color:#c8b4ff";
    toggle.textContent = game.premium ? "Rendre gratuit" : "Mettre en Premium";
    toggle.addEventListener("click", async () => {
      const user = Auth.getUser();
      try {
        await post("/api/games", { action: "premium", id: game.id, premium: !game.premium, idToken: user && user.token });
        loadList();
      } catch (err) {
        alert(err.message);
      }
    });

    actions.append(view, toggle, del);
    row.append(name, actions);
    list.appendChild(row);
  });
}

// ---------- Ajout d'un jeu ----------
form.addEventListener("submit", async e => {
  e.preventDefault();

  const user = window.Auth && Auth.getUser();
  if (!user || !user.token || tokenExpired(user.token)) return checkAccess();
  if (!logoData) return setMessage(formMsg, "Choisis le logo du jeu.", "error");

  const data = new FormData(form);
  const lines = key => String(data.get(key) || "").split("\n").map(s => s.trim()).filter(Boolean);

  const submit = document.getElementById("gameSubmit");
  submit.disabled = true;

  try {
    const total = 1 + shotsData.length;
    let done = 0;
    const upload = async dataUrl => {
      done++;
      setMessage(formMsg, "Envoi des images (" + done + "/" + total + ")…", "ok");
      return (await post("/api/image", { idToken: user.token, dataUrl })).url;
    };

    const logo = await upload(logoData);
    const screenshots = [];
    for (const shot of shotsData) screenshots.push(await upload(shot));

    setMessage(formMsg, "Enregistrement du jeu…", "ok");
    await post("/api/games", {
      action: "add",
      idToken: user.token,
      notify: data.get("notify") === "on",
      game: {
        name: data.get("name"),
        category: data.get("category"),
        developer: data.get("developer"),
        platform: data.get("platform"),
        size: data.get("size"),
        version: data.get("version"),
        minAndroid: data.get("minAndroid"),
        minRam: data.get("minRam"),
        recRam: data.get("recRam"),
        minStorage: data.get("minStorage"),
        description: data.get("description"),
        info: data.get("info"),
        downloadUrls: lines("downloadUrls"),
        apkUrl: data.get("apkUrl"),
        obbUrl: data.get("obbUrl"),
        dataUrl: data.get("dataUrl"),
        premium: data.get("premium") === "on",
        logo,
        screenshots
      }
    });

    form.reset();
    logoData = "";
    shotsData = [];
    renderLogo();
    renderShots();
    setMessage(formMsg, "Jeu ajouté ! Il apparaît maintenant sur le site.", "ok");
    loadList();
  } catch (err) {
    setMessage(formMsg, err.message + " (détails dans « État du système » en haut de la page)", "error");
    runStatus();
  } finally {
    submit.disabled = false;
  }
});

// ---------- Notifications ----------
async function loadNotifs() {
  notifList.textContent = "Chargement…";
  try {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    renderNotifs(await response.json());
  } catch (e) {
    notifList.textContent = "Impossible de joindre le serveur (/api/notifications).";
  }
}

function renderNotifs(items) {
  notifList.innerHTML = "";
  if (!items.length) {
    notifList.textContent = "Aucune notification envoyée.";
    return;
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "admin-row";

    const label = document.createElement("span");
    label.textContent = item.title + " · " + new Date(item.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

    const actions = document.createElement("div");
    const del = document.createElement("button");
    del.textContent = "Supprimer";
    del.addEventListener("click", async () => {
      const user = Auth.getUser();
      try {
        await post("/api/notifications", { action: "delete", id: item.id, idToken: user && user.token });
        loadNotifs();
      } catch (err) {
        alert(err.message);
      }
    });

    actions.appendChild(del);
    row.append(label, actions);
    notifList.appendChild(row);
  });
}

notifForm.addEventListener("submit", async e => {
  e.preventDefault();

  const user = window.Auth && Auth.getUser();
  if (!user || !user.token || tokenExpired(user.token)) return checkAccess();

  const data = new FormData(notifForm);
  const submit = document.getElementById("notifSubmit");
  submit.disabled = true;
  notifMsg.hidden = true;

  try {
    await post("/api/notifications", {
      action: "send",
      idToken: user.token,
      title: data.get("title"),
      body: data.get("body"),
      url: data.get("url")
    });
    notifForm.reset();
    setMessage(notifMsg, "Notification envoyée ! Les visiteurs la verront dans la cloche.", "ok");
    loadNotifs();
  } catch (err) {
    setMessage(notifMsg, err.message, "error");
  } finally {
    submit.disabled = false;
  }
});

renderLogo();
renderShots();
window.addEventListener("auth-changed", checkAccess);
window.addEventListener("load", checkAccess);
