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

  // Utilisé par le bouton Télécharger (page d'un jeu)
  window.Ads = {
    active: () => ready && !premium && !!AD_DIRECT_LINK,
    open: () => { if (window.Ads.active()) window.open(AD_DIRECT_LINK, "_blank", "noopener"); }
  };

  refresh(false);
  window.addEventListener("auth-changed", () => { if (ready) refresh(true); });

  // La pub ne disparaît pas : si l'emplacement est retiré de la page, il est remis
  new MutationObserver(() => {
    if (ready && !premium && !document.querySelector(".ad-section")) mount();
  }).observe(document.body, { childList: true, subtree: true });
})();
