// PUBLICITÉS : affichées en permanence, sauf pour les abonnés premium (Gamer Pro / Élite Gamers)
// Tout se règle ici :
const AD_DIRECT_LINK = "https://ardance.org/4/cfd00f67c4c7385ff2c69b400955b213"; // "" pour désactiver
const AD_EXTRA_SRC = "https://bellnewyork.org/14/3d34ad71de499262ce49bad8dbe75665"; // script de pub ; "" pour désactiver

(function () {
  let premium = false;
  let ready = false;

  function mount() {
    if (premium) return;

    // ----- Emplacement visible : sous "Jeux populaires" sur l'accueil, avant le pied de page ailleurs -----
    if (AD_DIRECT_LINK && !document.querySelector(".ad-section")) {
      const section = document.createElement("section");
      section.className = "ad-section";
      section.setAttribute("aria-label", "Publicité");

      const label = document.createElement("span");
      label.className = "ad-label";
      label.textContent = "Publicité";

      const link = document.createElement("a");
      link.className = "ad-direct";
      link.href = AD_DIRECT_LINK;
      link.target = "_blank";
      link.rel = "sponsored noopener noreferrer";
      link.textContent = "Offre sponsorisée ›";

      section.append(label, link);

      const anchor = document.getElementById("popular");
      const footer = document.querySelector("footer");
      if (anchor) anchor.after(section);
      else if (footer) footer.before(section);
      else document.body.appendChild(section);
    }

    // ----- Script de pub : chargé à chaque page pour les non-premium -----
    if (AD_EXTRA_SRC && !document.getElementById("adExtra")) {
      const extra = document.createElement("script");
      extra.id = "adExtra";
      extra.async = true;
      extra.setAttribute("data-cfasync", "false");
      extra.src = AD_EXTRA_SRC;
      document.body.appendChild(extra);
    }
  }

  function unmount() {
    document.querySelectorAll(".ad-section").forEach(el => el.remove());
    // Un script de pub déjà lancé ne peut pas être arrêté : on recharge la page une fois
    if (document.getElementById("adExtra")) window.location.reload();
  }

  function refresh(force) {
    return Account.status(force)
      .then(a => { premium = !!a.premium; })
      .catch(() => { premium = false; })
      .then(() => { ready = true; premium ? unmount() : mount(); });
  }

  const GATE_SECONDS = 8;

  // Écran avant téléchargement pour les non-premium : compte à rebours + publicités
  function gate(url, label) {
    const old = document.getElementById("dlGate");
    if (old) old.remove();
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };

    const modal = el("div", "dl-gate");
    modal.id = "dlGate";
    const box = el("div", "dl-box");
    const close = el("button", "dl-close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Fermer");

    box.append(close, el("h3", "", "Ton téléchargement est presque prêt"), el("p", "dl-sub", "Il démarre dans quelques secondes. Les publicités financent le site."));

    if (AD_DIRECT_LINK) {
      const ads = el("div", "dl-ads");
      for (let i = 0; i < 3; i++) {
        const a = el("a", "dl-ad", "Publicité · Découvrir l'offre ›");
        a.href = AD_DIRECT_LINK;
        a.target = "_blank";
        a.rel = "sponsored noopener noreferrer";
        ads.appendChild(a);
      }
      box.appendChild(ads);
    }

    const go = el("button", "dl-go", "");
    go.type = "button";
    go.disabled = true;
    const prem = el("a", "dl-premium", "💎 Passe premium : téléchargement direct, sans publicité");
    prem.href = "premium.html";
    box.append(go, prem);
    modal.appendChild(box);
    document.body.appendChild(modal);

    let left = GATE_SECONDS;
    const tick = () => {
      if (left > 0) {
        go.textContent = "Patiente " + left + " s…";
        left--;
      } else {
        clearInterval(timer);
        go.disabled = false;
        go.textContent = "⬇ " + (label || "Télécharger maintenant");
      }
    };
    const timer = setInterval(tick, 1000);
    tick();

    const stop = () => { clearInterval(timer); modal.remove(); };
    close.addEventListener("click", stop);
    go.addEventListener("click", () => {
      window.Ads.open();
      stop();
      window.location.href = url;
    });
  }

  // Utilisé par le bouton Télécharger (page d'un jeu)
  window.Ads = {
    active: () => ready && !premium && !!AD_DIRECT_LINK,
    open: () => { if (window.Ads.active()) window.open(AD_DIRECT_LINK, "_blank", "noopener"); },
    gate
  };

  refresh(false);
  window.addEventListener("auth-changed", () => { if (ready) refresh(true); });

  // La pub ne disparaît pas : si l'emplacement est retiré de la page, il est remis
  new MutationObserver(() => {
    if (ready && !premium && !document.querySelector(".ad-section")) mount();
  }).observe(document.body, { childList: true, subtree: true });
})();
