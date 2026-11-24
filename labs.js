// GAME LABS : détection du téléphone + compatibilité des jeux
const tr = (fr, en) => (Prefs.getLang() === "en" ? en : fr);
const DEVICE_KEY = "gg_device";
const MEDIA_RE = /^\/api\/image\?id=[a-f0-9]{32}$/;

const detectedBox = document.getElementById("detected");
const devSystem = document.getElementById("devSystem");
const devAndroid = document.getElementById("devAndroid");
const devRam = document.getElementById("devRam");
const devStorage = document.getElementById("devStorage");
const labsSearch = document.getElementById("labsSearch");
const labsList = document.getElementById("labsList");

let allGames = [];
let dev = { system: "Android", androidVersion: null, ram: null, storage: null };
const focusId = new URLSearchParams(window.location.search).get("game");

// ---------- Détection (approximative) ----------
async function detectDevice() {
  const ua = navigator.userAgent || "";
  const info = { system: "PC", androidVersion: null, ram: null, model: "", cores: navigator.hardwareConcurrency || null, gpu: "", screen: "" };

  if (/Android/i.test(ua)) {
    info.system = "Android";
    const m = ua.match(/Android\s+(\d+)/i);
    if (m) info.androidVersion = parseInt(m[1], 10);
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    info.system = "iOS";
  }

  if (navigator.deviceMemory) info.ram = Math.max(1, navigator.deviceMemory);

  // Chrome sur Android donne le vrai modèle et la vraie version via les Client Hints
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    try {
      const h = await navigator.userAgentData.getHighEntropyValues(["model", "platformVersion"]);
      if (h.model) info.model = h.model;
      if (info.system === "Android" && h.platformVersion) {
        const v = parseInt(h.platformVersion, 10);
        if (v) info.androidVersion = v;
      }
    } catch (e) {}
  }

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) info.gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
  } catch (e) {}

  const ratio = window.devicePixelRatio || 1;
  info.screen = Math.round(screen.width * ratio) + " × " + Math.round(screen.height * ratio);
  return info;
}

function renderDetected(info) {
  detectedBox.innerHTML = "";
  const rows = [
    [tr("Modèle", "Model"), info.model || "—"],
    [tr("Système", "System"), info.system + (info.androidVersion ? " " + info.androidVersion : "")],
    [tr("RAM détectée", "Detected RAM"), info.ram ? "≈ " + info.ram + " " + tr("Go", "GB") : tr("non disponible", "not available")],
    [tr("Cœurs du processeur", "CPU cores"), info.cores || "—"],
    [tr("Processeur graphique", "Graphics chip"), info.gpu || "—"],
    [tr("Écran", "Screen"), info.screen || "—"]
  ];
  rows.forEach(([label, value]) => {
    const box = document.createElement("div");
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    box.append(small, strong);
    detectedBox.appendChild(box);
  });
}

// ---------- Formulaire ----------
function fillOptions() {
  devAndroid.innerHTML = "";
  devAndroid.add(new Option(tr("Je ne sais pas", "I don't know"), ""));
  for (let v = 16; v >= 5; v--) devAndroid.add(new Option("Android " + v, String(v)));

  devRam.innerHTML = "";
  devRam.add(new Option(tr("Je ne sais pas", "I don't know"), ""));
  [1, 2, 3, 4, 6, 8, 12, 16].forEach(v => devRam.add(new Option(v + " " + tr("Go", "GB"), String(v))));
}

function syncForm() {
  devSystem.value = dev.system;
  devAndroid.value = dev.androidVersion ? String(dev.androidVersion) : "";
  devRam.value = dev.ram ? String(dev.ram) : "";
  devStorage.value = dev.storage != null ? String(dev.storage) : "";
  devAndroid.disabled = dev.system !== "Android";
}

function readForm() {
  dev = {
    system: devSystem.value,
    androidVersion: devAndroid.value ? parseInt(devAndroid.value, 10) : null,
    ram: devRam.value ? parseFloat(devRam.value) : null,
    storage: devStorage.value !== "" ? parseFloat(devStorage.value) : null
  };
  devAndroid.disabled = dev.system !== "Android";
  try { localStorage.setItem(DEVICE_KEY, JSON.stringify(dev)); } catch (e) {}
  renderList();
}

[devSystem, devAndroid, devRam, devStorage].forEach(el => el.addEventListener("change", readForm));
devStorage.addEventListener("input", readForm);

document.getElementById("redetect").addEventListener("click", async () => {
  const info = await detectDevice();
  renderDetected(info);
  dev = { system: info.system, androidVersion: info.androidVersion, ram: info.ram, storage: dev.storage };
  syncForm();
  try { localStorage.setItem(DEVICE_KEY, JSON.stringify(dev)); } catch (e) {}
  renderList();
});

// ---------- Liste des jeux ----------
const VERDICTS = {
  ok: () => ["✅ " + tr("Compatible", "Compatible"), "v-ok"],
  limit: () => ["⚠️ " + tr("Jouable, réglages bas", "Playable, low settings"), "v-limit"],
  no: () => ["❌ " + tr("Non compatible", "Not compatible"), "v-no"],
  na: () => ["ℹ️ " + tr("Autre plateforme", "Other platform"), "v-na"],
  unknown: () => ["❔ " + tr("À préciser", "Needs more info"), "v-na"]
};

function renderList() {
  const query = labsSearch.value.trim().toLowerCase();
  const games = allGames.filter(g => g.name.toLowerCase().includes(query));
  labsList.innerHTML = "";

  if (!games.length) {
    const p = document.createElement("p");
    p.className = "profile-note";
    p.textContent = tr("Aucun jeu trouvé.", "No games found.");
    labsList.appendChild(p);
    return;
  }

  games.forEach(game => {
    const result = Compat.evaluate(game, dev, tr);
    const [label, cls] = VERDICTS[result.level]();

    const card = document.createElement("article");
    card.className = "lab-card" + (game.id === focusId ? " focus" : "");
    card.id = "lab-" + game.id;

    const thumb = document.createElement("img");
    thumb.className = "lab-thumb";
    thumb.alt = "";
    const src = game.logo && MEDIA_RE.test(game.logo) ? game.logo : game.cover;
    if (src && (MEDIA_RE.test(src) || /^https?:\/\//i.test(src))) thumb.src = src;

    const main = document.createElement("div");
    main.className = "lab-main";

    const top = document.createElement("div");
    top.className = "lab-top";
    const name = document.createElement("h3");
    name.textContent = game.name;
    const badge = document.createElement("span");
    badge.className = "verdict " + cls;
    badge.textContent = label;
    top.append(name, badge);

    const req = document.createElement("p");
    req.className = "lab-req";
    const reqText = Compat.requirements(game, tr);
    req.textContent = reqText ? tr("Requis : ", "Required: ") + reqText : "";
    req.hidden = !reqText;

    const ul = document.createElement("ul");
    ul.className = "lab-reasons";
    result.reasons.forEach(r => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });

    const link = document.createElement("a");
    link.className = "lab-link";
    link.href = "game.html?id=" + encodeURIComponent(game.id);
    link.textContent = tr("Voir le jeu ›", "View game ›");

    main.append(top, req, ul, link);
    card.append(thumb, main);
    labsList.appendChild(card);
  });
}

labsSearch.addEventListener("input", renderList);

// ---------- Démarrage ----------
(async function init() {
  fillOptions();

  const info = await detectDevice();
  renderDetected(info);

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(DEVICE_KEY)); } catch (e) {}
  dev = saved || { system: info.system, androidVersion: info.androidVersion, ram: info.ram, storage: null };
  syncForm();

  allGames = await loadAllGames();
  renderList();

  if (focusId) {
    const el = document.getElementById("lab-" + focusId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();
