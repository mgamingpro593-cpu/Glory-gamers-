// PUBLICITÉS (accueil + pages des jeux)
// Tout se règle ici :
const AD_REFRESH_MS = 3000;        // la bannière se régénère toutes les 3 secondes (0 = jamais)
const AD_BANNER_SRC = "https://bellnewyork.org/21/a985f817657bc784ddc663739edf7dc2";
const AD_CONTAINER_ID = "container-a985f817657bc784ddc663739edf7dc2";
const AD_EXTRA_SRC = "https://bellnewyork.org/14/3d34ad71de499262ce49bad8dbe75665"; // "" pour désactiver
const AD_DIRECT_LINK = "https://ardance.org/4/cfd00f67c4c7385ff2c69b400955b213";     // "" pour désactiver

(function () {
  // ----- Emplacement visible : sous "Jeux populaires" sur l'accueil, avant le pied de page ailleurs -----
  const section = document.createElement("section");
  section.className = "ad-section";
  section.setAttribute("aria-label", "Publicité");

  const label = document.createElement("span");
  label.className = "ad-label";
  label.textContent = "Publicité";

  const container = document.createElement("div");
  container.id = AD_CONTAINER_ID;

  section.append(label, container);

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

  // ----- Bannière : (re)chargée à chaque cycle -----
  function loadBanner() {
    container.innerHTML = "";
    document.querySelectorAll('script[data-ad="banner"]').forEach(s => s.remove());

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.setAttribute("fetchpriority", "high");
    script.dataset.ad = "banner";
    script.src = AD_BANNER_SRC;
    document.body.appendChild(script);
  }

  loadBanner();
  if (AD_REFRESH_MS > 0) {
    // on ne régénère pas quand l'onglet est caché
    setInterval(() => { if (!document.hidden) loadBanner(); }, AD_REFRESH_MS);
  }

  // ----- Script supplémentaire : chargé une seule fois -----
  if (AD_EXTRA_SRC) {
    const extra = document.createElement("script");
    extra.async = true;
    extra.setAttribute("data-cfasync", "false");
    extra.src = AD_EXTRA_SRC;
    document.body.appendChild(extra);
  }
})();
