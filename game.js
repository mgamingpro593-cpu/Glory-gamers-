// PAGE DÉTAIL D'UN JEU
const root = document.getElementById("gameDetail");
const id = new URLSearchParams(window.location.search).get("id");

const MEDIA_RE = /^\/api\/image\?id=[a-f0-9]{32}$/;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
const safeMedia = u => (MEDIA_RE.test(String(u || "")) || /^https?:\/\//i.test(String(u || "")) ? String(u) : "");
const para = s => esc(s).replace(/\n/g, "<br>");

root.innerHTML = '<p class="no-results">Chargement…</p>';

loadAllGames().then(games => {
  const game = games.find(g => g.id === id);

  if (!game) {
    root.innerHTML =
      '<a href="index.html" class="back-link">‹ Retour aux jeux</a>' +
      '<p class="no-results">Jeu introuvable.</p>';
    return;
  }
  renderGame(game);
});

function renderGame(game) {
  document.title = game.name + " - Glory Gamers";

  const en = Prefs.getLang() === "en";
  const unit = en ? "GB" : "Go";
  const fmt = n => (en ? String(n) : String(n).replace(".", ","));
  const gb = n => (n ? fmt(n) + " " + unit : "");

  const links = (game.downloadUrls || (game.downloadUrl ? [game.downloadUrl] : [])).map(safeUrl).filter(Boolean);
  const shots = (game.screenshots || []).map(safeMedia).filter(Boolean);

  const files = [
    ["Télécharger l'APK", game.apkUrl],
    ["Télécharger l'OBB", game.obbUrl],
    ["Télécharger les DATA", game.dataUrl]
  ].filter(f => safeUrl(f[1])).map(f => ({ label: f[0], url: safeUrl(f[1]) }));
  links.forEach((url, i) => files.push({ label: "Télécharger" + (links.length > 1 ? " (lien " + (i + 1) + ")" : ""), url }));

  const downloadHTML = game.premium
    ? '<button class="detail-download" data-premium="1">🔒 Télécharger (Premium) ↓</button>'
    : files.length
    ? files.map(f => '<button class="detail-download" data-url="' + esc(f.url) + '">' + esc(f.label) + " ↓</button>").join("")
    : '<button class="detail-download" data-url="">Télécharger ↓</button>';

  const meta = [
    ["Plateforme", game.platform],
    ["Taille", game.size],
    ["Version", game.version],
    ["Catégorie", game.category],
    ["Développeur", game.developer],
    ["Android minimum", game.minAndroid ? game.minAndroid + "+" : ""],
    ["RAM minimum", gb(game.minRam)],
    ["RAM recommandée", gb(game.recRam)],
    ["Espace requis", gb(game.minStorage)]
  ].filter(m => m[1]).map(m => '<div><small>' + m[0] + '</small><strong>' + esc(m[1]) + '</strong></div>').join("");

  const shotsHTML = shots.map((src, i) =>
    '<button data-src="' + esc(src) + '" aria-label="Agrandir la capture ' + (i + 1) + '">' +
    '<img src="' + esc(src) + '" alt="Capture d\'écran ' + (i + 1) + ' de ' + esc(game.name) + '" loading="lazy"></button>'
  ).join("");

  // Logo (image envoyée depuis la galerie) ou ancienne image de couverture
  const logo = MEDIA_RE.test(game.logo || "") ? game.logo : "";
  const cover = safeMedia(game.cover) || shots[0] || "";
  const coverHTML = logo
    ? '<div class="detail-cover logo-mode" style="--bg:url(\'' + logo + '\')"><img src="' + logo + '" alt="' + esc(game.name) + '"></div>'
    : cover
      ? '<img class="detail-cover" src="' + esc(cover) + '" alt="Image de ' + esc(game.name) + '">'
      : '<div></div>';

  root.innerHTML =
    '<a href="index.html#games" class="back-link">‹ Retour aux jeux</a>' +
    '<section class="detail-top">' +
      coverHTML +
      '<div class="detail-head">' +
        '<span class="tag">' + esc(game.category) + '</span>' +
        (game.premium ? ' <span class="tag" style="background:linear-gradient(135deg,#f5b942,#f08a24);color:#1a1200">⭐ Premium</span>' : '') +
        '<h1>' + esc(game.name) + '</h1>' +
        '<p class="detail-genre">' + esc(game.genre || game.category) + '</p>' +
        '<div class="detail-meta">' + meta + '</div>' +
        downloadHTML +
        '<a class="labs-link" href="labs.html?game=' + encodeURIComponent(game.id) + '">🧪 Vérifier la compatibilité avec mon téléphone</a>' +
      '</div>' +
    '</section>' +
    (game.description ? '<section class="detail-block"><h2>Description</h2><p>' + para(game.description) + '</p></section>' : '') +
    (game.info ? '<section class="detail-block"><h2>Informations</h2><p>' + para(game.info) + '</p></section>' : '') +
    (shots.length ? '<section class="detail-block"><h2>Captures d\'écran</h2><div class="shots">' + shotsHTML + '</div></section>' : '');

  // Le téléchargement demande d'être connecté avec Google
  document.querySelectorAll(".detail-download").forEach(btn => {
    btn.addEventListener("click", () => {
      Auth.requireLogin(() => {
        if (game.premium) {
          premiumDownload(game);
        } else if (btn.dataset.url) {
          if (window.Ads && Ads.active()) {
            Ads.gate(btn.dataset.url, btn.textContent.replace(/ ↓$/, ""));
          } else {
            window.open(btn.dataset.url, "_blank", "noopener");
          }
        } else {
          alert(Prefs.t("Le lien de téléchargement de " + game.name + " sera ajouté prochainement."));
        }
      });
    });
  });

  // Agrandir les captures
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const closeLightbox = () => lightbox.classList.remove("show");

  document.querySelectorAll(".shots button").forEach(b => {
    b.addEventListener("click", () => {
      lightboxImg.src = b.dataset.src;
      lightbox.classList.add("show");
    });
  });
  lightbox.addEventListener("click", e => { if (e.target !== lightboxImg) closeLightbox(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
}


// Jeu réservé aux abonnés : le serveur donne les liens seulement aux abonnés
function dlWindow(title, text, nodes) {
  const old = document.getElementById("dlGate");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.className = "dl-gate";
  modal.id = "dlGate";
  const box = document.createElement("div");
  box.className = "dl-box";

  const close = document.createElement("button");
  close.className = "dl-close";
  close.type = "button";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Fermer");
  const h = document.createElement("h3");
  h.textContent = title;
  const p = document.createElement("p");
  p.className = "dl-sub";
  p.textContent = text;

  box.append(close, h, p);
  nodes.forEach(n => box.appendChild(n));
  modal.appendChild(box);
  document.body.appendChild(modal);

  const stop = () => modal.remove();
  close.addEventListener("click", stop);
  modal.addEventListener("click", e => { if (e.target === modal) stop(); });
}

async function premiumDownload(game) {
  try {
    const data = await Account.api("/api/download", { id: game.id });
    const files = data.files || [];
    const nodes = files.map(f => {
      const a = document.createElement("a");
      a.className = "dl-go";
      a.href = f.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.cssText = "display:flex;align-items:center;justify-content:center;text-decoration:none";
      a.textContent = "⬇ " + f.label;
      return a;
    });
    dlWindow(
      Prefs.t("Ton téléchargement"),
      files.length ? game.name : Prefs.t("Aucun lien de téléchargement pour l'instant."),
      nodes
    );
  } catch (e) {
    const a = document.createElement("a");
    a.className = "dl-premium";
    a.href = "premium.html";
    a.textContent = "💎 Voir les abonnements";
    if (/Premium|réservé/i.test(e.message)) {
      dlWindow(Prefs.t("Jeu réservé aux abonnés Premium"), Prefs.t("Abonne-toi pour télécharger ce jeu, sans publicité."), [a]);
    } else {
      alert(e.message);
    }
  }
}
