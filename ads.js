// PUBLICITÉS, TÉLÉCHARGEMENT AVEC PUB ET PREMIUM
// Tout se règle ici :
const AD_DIRECT_LINK = "https://ardance.org/4/cfd00f67c4c7385ff2c69b400955b213"; // bouton « Offre sponsorisée » ("" pour le retirer)
const AD_LOOP_SRC = "https://bellnewyork.org/14/3d34ad71de499262ce49bad8dbe75665"; // script de pub rechargé en boucle
const AD_LOOP_MS = 18000;     // toutes les 18 secondes, sans jamais s'arrêter (0 = une seule fois)
const AD_GATE_URL = "https://bellnewyork.org/14/3d34ad71de499262ce49bad8dbe75665"; // page ouverte avant un téléchargement gratuit ("" = pas de pub avant)
const AD_GATE_SECONDS = 8;    // attente avant de pouvoir télécharger
const PREMIUM_LINK = "";      // lien pour s'abonner (WhatsApp, Telegram, paiement…)
// Les abonnés se gèrent dans Espace admin > Abonnés Premium : rien à écrire ici.

(function () {
  const tr = (fr, en) => (window.Prefs && Prefs.getLang() === "en" ? en : fr);
  const norm = s => String(s || "").trim().toLowerCase();
  const JSON_HEADERS = { "Content-Type": "application/json" };
  const gameId = new URLSearchParams(window.location.search).get("id");

  // ---------- Statut Premium (vérifié par le serveur, gardé 6 h pour l'affichage) ----------
  const CACHE_KEY = "gg_premium_cache";
  const CACHE_MS = 6 * 3600 * 1000;
  const state = { premium: false };
  const isPremium = () => state.premium;

  function readCache(email) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && c.email === norm(email) && Date.now() - c.at < CACHE_MS) return c;
    } catch (e) {}
    return null;
  }

  function writeCache(email, premium) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ email: norm(email), premium, at: Date.now() })); } catch (e) {}
  }

  async function refreshPremium() {
    const user = window.Auth && Auth.getUser();
    if (!user) {
      state.premium = false;
      applyPremium();
      return;
    }

    const cached = readCache(user.email);
    if (cached) {
      state.premium = cached.premium;
      applyPremium();
    }
    if (!user.token) return;

    try {
      const response = await fetch("/api/premium", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "me", idToken: user.token })
      });
      const data = await response.json();
      if (response.ok && data.email) { // réponse définitive du serveur
        state.premium = !!data.premium;
        writeCache(data.email, state.premium);
        applyPremium();
      }
    } catch (e) {}
  }

  function premiumClick() {
    if (PREMIUM_LINK) window.open(PREMIUM_LINK, "_blank");
    else alert(tr("L'abonnement Premium sera disponible très bientôt.", "Premium will be available very soon."));
  }

  // ---------- Styles de cette partie ----------
  const style = document.createElement("style");
  style.textContent = `
    .premium-promo{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 auto 12px;padding:14px 16px;max-width:420px;border-radius:14px;background:linear-gradient(135deg,#2b1f55,#1d3550);border:1px solid #8b5cf6;color:#fff}
    .premium-promo strong{font-size:15px}
    .premium-promo span{font-size:12px;color:#d6d6ea}
    .premium-btn{padding:10px 18px;border:0;border-radius:10px;background:linear-gradient(135deg,#f5b942,#f08a24);color:#1a1200;font-weight:800;font-size:13px;cursor:pointer}
    .premium-tag{position:absolute;top:10px;right:10px;z-index:2;padding:5px 9px;border-radius:5px;font-size:9px;font-weight:700;background:linear-gradient(135deg,#f5b942,#f08a24);color:#1a1200}
    .gate-modal{position:fixed;inset:0;z-index:250;background:#000b;display:grid;place-items:center;padding:20px}
    .gate-modal[hidden]{display:none}
    .gate-box{position:relative;width:100%;max-width:400px;max-height:92vh;overflow:auto;background:var(--surface,#151526);color:var(--white,#fff);border:1px solid #34344c;border-radius:18px;padding:30px 22px 24px;text-align:center}
    .gate-close{position:absolute;top:10px;right:10px;width:34px;height:34px;border:0;border-radius:50%;background:var(--surface-light,#202039);color:inherit;cursor:pointer}
    .gate-box h2{margin-bottom:6px;font-size:20px}
    .gate-game{color:var(--muted,#a5a5ba);font-size:13px;margin-bottom:18px}
    .gate-premium{padding:16px;border-radius:14px;background:linear-gradient(135deg,#2b1f55,#1d3550);border:1px solid #8b5cf6;margin-bottom:16px;color:#fff}
    .gate-premium p{font-size:13px;color:#d6d6ea;margin:6px 0 12px}
    .gate-or{color:var(--muted,#a5a5ba);font-size:12px;margin:2px 0 14px}
    .gate-ad-btn,.gate-dl-btn{width:100%;padding:12px;border:0;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer}
    .gate-ad-btn{background:#29213f;color:#c8b4ff}
    .gate-ad-btn:disabled{opacity:.6;cursor:default}
    .gate-dl-btn{margin-top:10px;background:var(--purple,#8b5cf6);color:#fff}
    .gate-dl-btn:disabled{background:var(--surface-light,#202039);color:var(--muted,#a5a5ba);cursor:not-allowed}
    .gate-link{display:block;margin-top:10px;padding:12px;border-radius:12px;background:var(--purple,#8b5cf6);color:#fff;font-weight:700;font-size:14px;text-decoration:none}
    .gate-count{margin-top:12px;font-size:12px;color:var(--muted,#a5a5ba);min-height:16px}
  `;
  document.head.appendChild(style);

  // ---------- Emplacement visible : sous "Jeux populaires" sur l'accueil, avant le pied de page ailleurs ----------
  const section = document.createElement("section");
  section.className = "ad-section";
  section.setAttribute("aria-label", "Publicité");

  const label = document.createElement("span");
  label.className = "ad-label";
  label.textContent = "Publicité";
  section.appendChild(label);

  const promo = document.createElement("div");
  promo.className = "premium-promo";
  promo.innerHTML =
    "<strong>⭐ Premium</strong>" +
    "<span>" + tr("Sans publicité, téléchargements directs.", "No ads, direct downloads.") + "</span>";
  const promoBtn = document.createElement("button");
  promoBtn.type = "button";
  promoBtn.className = "premium-btn";
  promoBtn.textContent = tr("Passer Premium", "Go Premium");
  promoBtn.addEventListener("click", premiumClick);
  promo.appendChild(promoBtn);
  section.appendChild(promo);

  if (AD_DIRECT_LINK) {
    const link = document.createElement("a");
    link.className = "ad-direct";
    link.href = AD_DIRECT_LINK;
    link.target = "_blank";
    link.rel = "sponsored noopener noreferrer";
    link.textContent = "Offre sponsorisée ›";
    section.appendChild(link);
  }

  const anchor = document.getElementById("popular");
  if (anchor) anchor.after(section);
  else document.querySelector("footer").before(section);

  // Les abonnés Premium ne voient plus la zone de pub
  function applyPremium() {
    section.hidden = isPremium();
  }
  applyPremium();

  // ---------- Pub en boucle (ne s'arrête jamais, sauf pour les abonnés) ----------
  function loadLoopAd() {
    if (isPremium()) return;
    document.querySelectorAll('script[data-ad="loop"]').forEach(s => s.remove());

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.dataset.ad = "loop";
    script.src = AD_LOOP_SRC;
    document.body.appendChild(script);
  }

  setTimeout(loadLoopAd, 1500); // laisse le temps de reconnaître un abonné connecté
  if (AD_LOOP_MS > 0) {
    setInterval(() => { if (!document.hidden) loadLoopAd(); }, AD_LOOP_MS);
  }

  // ---------- Fenêtre de téléchargement ----------
  const modal = document.createElement("div");
  modal.className = "gate-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="gate-box" role="dialog" aria-modal="true">' +
      '<button class="gate-close" type="button" aria-label="' + tr("Fermer", "Close") + '">✕</button>' +
      '<h2 class="gate-title"></h2>' +
      '<p class="gate-game"></p>' +
      '<div class="gate-premium"><strong>⭐ Premium</strong><p class="gate-premium-text"></p>' +
        '<button type="button" class="premium-btn">' + tr("Passer Premium", "Go Premium") + "</button></div>" +
      '<div class="gate-free">' +
        '<p class="gate-or">' + tr("ou télécharge gratuitement :", "or download for free:") + "</p>" +
        '<button type="button" class="gate-ad-btn">' + tr("Voir la publicité", "Watch the ad") + "</button>" +
        '<button type="button" class="gate-dl-btn" disabled>' + tr("Télécharger", "Download") + "</button>" +
      "</div>" +
      '<div class="gate-links"></div>' +
      '<p class="gate-count"></p>' +
    "</div>";
  document.body.appendChild(modal);

  const $ = sel => modal.querySelector(sel);
  const titleEl = $(".gate-title");
  const gameEl = $(".gate-game");
  const premText = $(".gate-premium-text");
  const secPremium = $(".gate-premium");
  const secFree = $(".gate-free");
  const secLinks = $(".gate-links");
  const adBtn = $(".gate-ad-btn");
  const dlBtn = $(".gate-dl-btn");
  const count = $(".gate-count");
  let pendingUrl = "";
  let readyAt = 0;
  let timer = null;

  function closeGate() {
    modal.hidden = true;
    clearInterval(timer);
  }

  function open(mode, name) {
    clearInterval(timer);
    gameEl.textContent = name;
    count.textContent = "";
    secPremium.style.display = mode === "links" ? "none" : "";
    secFree.style.display = mode === "free" ? "" : "none";
    secLinks.style.display = mode === "links" ? "" : "none";
    modal.hidden = false;
  }

  // Jeu gratuit, visiteur gratuit : pub d'abord, puis téléchargement
  function showFree(url, name) {
    pendingUrl = url;
    open("free", name);
    titleEl.textContent = tr("Avant de télécharger", "Before you download");
    premText.textContent = tr("Sans publicité, téléchargements directs et soutien au site.", "No ads, direct downloads and support for the site.");
    adBtn.disabled = false;
    adBtn.hidden = !AD_GATE_URL;
    dlBtn.disabled = !!AD_GATE_URL; // sans pub configurée, le téléchargement est direct
  }

  // Jeu Premium, visiteur non abonné
  function showLocked(name) {
    open("locked", name);
    titleEl.textContent = tr("Jeu réservé aux abonnés Premium", "Premium-only game");
    premText.textContent = tr("Abonne-toi pour télécharger ce jeu, sans publicité.", "Subscribe to download this game, with no ads.");
    count.textContent = tr("Déjà abonné ? Déconnecte-toi puis reconnecte-toi avec le bon compte Google.", "Already subscribed? Log out and log in with the right Google account.");
  }

  // Abonné : liens de téléchargement (donnés par le serveur pour les jeux Premium)
  async function showLinks(name, urls) {
    open("links", name);
    titleEl.textContent = tr("Ton téléchargement", "Your download");
    secLinks.innerHTML = "";
    count.textContent = tr("Chargement…", "Loading…");

    try {
      if (!urls) {
        const user = window.Auth && Auth.getUser();
        const response = await fetch("/api/download", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ id: gameId, idToken: user && user.token })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) return showLocked(name);
        if (!response.ok) throw new Error(data.error || "Erreur " + response.status);
        urls = data.urls || [];
      }

      count.textContent = urls.length ? "" : tr("Aucun lien de téléchargement pour l'instant.", "No download link yet.");
      urls.forEach((u, i) => {
        const a = document.createElement("a");
        a.className = "gate-link";
        a.href = u;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = tr("Télécharger", "Download") + (urls.length > 1 ? " (" + tr("lien", "link") + " " + (i + 1) + ")" : "") + " ↓";
        secLinks.appendChild(a);
      });
    } catch (e) {
      count.textContent = e.message;
    }
  }

  function tick() {
    const left = Math.ceil((readyAt - Date.now()) / 1000);
    if (left > 0) {
      count.textContent = tr("Ton téléchargement sera prêt dans " + left + " s…", "Your download will be ready in " + left + " s…");
    } else {
      clearInterval(timer);
      dlBtn.disabled = false;
      count.textContent = tr("C'est prêt ! Appuie sur Télécharger.", "Ready! Tap Download.");
    }
  }

  adBtn.addEventListener("click", () => {
    const tab = window.open(AD_GATE_URL, "_blank");
    if (!tab) {
      count.textContent = tr("Autorise les fenêtres pop-up puis réessaie.", "Allow pop-ups and try again.");
      return;
    }
    try { tab.opener = null; } catch (e) {}
    adBtn.disabled = true;
    readyAt = Date.now() + AD_GATE_SECONDS * 1000;
    tick();
    timer = setInterval(tick, 500);
  });

  dlBtn.addEventListener("click", () => {
    if (dlBtn.disabled) return;
    window.open(pendingUrl, "_blank", "noopener");
    closeGate();
  });

  $(".premium-btn").addEventListener("click", premiumClick);
  $(".gate-close").addEventListener("click", closeGate);
  modal.addEventListener("click", e => { if (e.target === modal) closeGate(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeGate(); });

  // ---------- Jeu affiché sur la page (pour savoir s'il est réservé aux abonnés) ----------
  let currentGame = null;
  if (gameId && window.loadAllGames) {
    loadAllGames().then(games => { currentGame = games.find(g => g.id === gameId) || null; }).catch(() => {});
  }

  // Intercepte le bouton Télécharger de la page d'un jeu (sans toucher à game.js)
  document.addEventListener("click", e => {
    const btn = e.target.closest && e.target.closest(".detail-download");
    if (!btn) return;

    const premiumGame = !!(currentGame && currentGame.premium);
    if (!premiumGame && !btn.dataset.url) return; // pas de lien : comportement normal
    if (!premiumGame && isPremium()) return;      // abonné + jeu gratuit : téléchargement direct, comme avant

    e.preventDefault();
    e.stopImmediatePropagation();

    const heading = document.querySelector(".detail-head h1");
    const name = heading ? heading.textContent : "";

    const go = async () => {
      await refreshPremium();
      if (isPremium()) return premiumGame ? showLinks(name) : showLinks(name, [btn.dataset.url]);
      if (premiumGame) return showLocked(name);
      showFree(btn.dataset.url, name);
    };
    if (window.Auth && !Auth.getUser()) Auth.requireLogin(go);
    else go();
  }, true);

  // ---------- Étiquette « Premium » sur les cartes de l'accueil ----------
  const grid = document.getElementById("gamesGrid");
  if (grid && window.loadAllGames) {
    let premiumIds = new Set();
    const badge = () => grid.querySelectorAll(".game-card").forEach(card => {
      const box = card.querySelector(".game-image");
      if (box && premiumIds.has(card.dataset.id) && !box.querySelector(".premium-tag")) {
        const tag = document.createElement("span");
        tag.className = "premium-tag";
        tag.textContent = "⭐ PREMIUM";
        box.appendChild(tag);
      }
    });
    loadAllGames().then(games => {
      premiumIds = new Set(games.filter(g => g.premium).map(g => g.id));
      badge();
      new MutationObserver(badge).observe(grid, { childList: true });
    }).catch(() => {});
  }

  window.addEventListener("auth-changed", refreshPremium);
  refreshPremium();
})();
